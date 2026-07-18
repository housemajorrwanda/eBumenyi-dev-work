function llmConfig() {
  return {
    baseUrl: process.env.LLM_BASE_URL || "http://localhost:11434/v1",
    model: process.env.LLM_MODEL || "llama3.2",
    apiKey: process.env.LLM_API_KEY?.trim(),
    timeoutMs: Number(process.env.LLM_TIMEOUT_MS) || 20000,
  };
}

function isGroqHost(baseUrl: string): boolean {
  return baseUrl.includes("groq.com");
}

function isOllamaHost(baseUrl: string): boolean {
  return !isGroqHost(baseUrl);
}

function disableToolValidationForProvider(baseUrl: string): boolean {
  const v = process.env.LLM_DISABLE_TOOL_VALIDATION?.trim().toLowerCase();
  if (v === "true") return true;
  if (v === "false") return false;
  return isGroqHost(baseUrl);
}

function llmHeaders(apiKey?: string): HeadersInit {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) h.Authorization = `Bearer ${apiKey}`;
  return h;
}

export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content?: string; tool_calls?: ToolCallMessage[] }
  | { role: "tool"; tool_call_id: string; content: string };

export type ToolDef = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties?: Record<string, unknown>;
      required?: string[];
    };
  };
};

export type ToolCallOut = { id: string; name: string; arguments: string };

export type ToolCallMessage = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

type Choice = {
  message: {
    content?: string | null;
    tool_calls?: Array<{
      id?: string;
      function: {
        name: string;
        arguments?: string | Record<string, unknown>;
        index?: number;
      };
    }>;
  };
};

export type LLMResponse = { content: string } | { toolCalls: ToolCallOut[] };

export function normalizeToolCallNameAndArgs(
  name: string,
  argsStr: string,
): { name: string; arguments: string } {
  const n = name.trim();
  const a = argsStr?.trim() || "{}";
  const bracketIdx = n.indexOf(" [");
  if (bracketIdx > 0 && n.endsWith("]")) {
    const baseName = n.slice(0, bracketIdx).trim();
    const jsonPart = n.slice(bracketIdx + 1).trim();
    try {
      const parsed: unknown = JSON.parse(jsonPart);
      let obj: Record<string, unknown> = {};
      if (
        Array.isArray(parsed) &&
        parsed[0] != null &&
        typeof parsed[0] === "object"
      ) {
        obj = parsed[0] as Record<string, unknown>;
      } else if (
        parsed != null &&
        typeof parsed === "object" &&
        !Array.isArray(parsed)
      ) {
        obj = parsed as Record<string, unknown>;
      }
      let existing: Record<string, unknown> = {};
      try {
        existing = JSON.parse(a) as Record<string, unknown>;
      } catch {
        existing = {};
      }
      return {
        name: baseName,
        arguments: JSON.stringify({ ...existing, ...obj }),
      };
    } catch {
      /* keep original */
    }
  }
  return { name: n, arguments: a };
}

function parseToolCall(
  t: NonNullable<Choice["message"]["tool_calls"]>[number],
): ToolCallOut {
  const rawName = t.function?.name ?? "";
  const raw = t.function?.arguments;
  const argsStr =
    typeof raw === "string" ? raw : raw != null ? JSON.stringify(raw) : "{}";
  const id = t.id ?? `call_${t.function?.index ?? 0}_${rawName}`;
  const { name, arguments: mergedArgs } = normalizeToolCallNameAndArgs(
    rawName,
    argsStr,
  );
  return { id, name, arguments: mergedArgs };
}

const MAX_RETRIES = 3;
const RETRY_BASE_MS = 2000;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(
        `LLM request timed out after ${timeoutMs}ms`,
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function chatOllamaStreamContent(
  baseUrl: string,
  apiKey: string | undefined,
  body: Record<string, unknown>,
  timeoutMs: number,
): Promise<string> {
  const res = await fetchWithTimeout(
    `${baseUrl}/chat/completions`,
    {
      method: "POST",
      headers: llmHeaders(apiKey),
      body: JSON.stringify({ ...body, stream: true }),
    },
    timeoutMs,
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LLM request failed: ${res.status} ${err}`);
  }
  if (!res.body) throw new Error("LLM stream returned no body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") continue;
      try {
        const chunk = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        const piece = chunk.choices?.[0]?.delta?.content;
        if (piece) content += piece;
      } catch {
        /* ignore malformed SSE chunks */
      }
    }
  }

  return content.trim();
}

export async function chat(
  messages: ChatMessage[],
  tools?: ToolDef[],
  options?: { timeoutMs?: number },
): Promise<LLMResponse> {
  const { baseUrl, model, apiKey, timeoutMs: defaultTimeoutMs } = llmConfig();
  const timeoutMs = options?.timeoutMs ?? defaultTimeoutMs;
  const toolNudge: ChatMessage = {
    role: "system",
    content:
      "When calling tools: use only the exact function name from the tools list. Put every parameter inside the arguments JSON object — never append JSON or arrays to the function name.",
  };

  let messagesForRequest: ChatMessage[] = messages;
  let attemptedToolNudge = false;

  const body: Record<string, unknown> = {
    model,
    stream: false,
  };
  if (tools?.length) {
    body.tools = tools;
    if (isGroqHost(baseUrl)) {
      body.tool_choice = "auto";
      body.parallel_tool_calls = false;
      if (disableToolValidationForProvider(baseUrl)) {
        body.disable_tool_validation = true;
      }
      const t = process.env.LLM_TEMPERATURE;
      if (t !== undefined && t !== "") {
        body.temperature = Number(t);
      } else {
        body.temperature = 0.2;
      }
    }
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    body.messages = messagesForRequest;

    const useOllamaStream =
      isOllamaHost(baseUrl) && !tools?.length && attempt === 0;
    if (useOllamaStream) {
      try {
        const content = await chatOllamaStreamContent(
          baseUrl,
          apiKey,
          body,
          timeoutMs,
        );
        return { content };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        throw lastError;
      }
    }

    const res = await fetchWithTimeout(
      `${baseUrl}/chat/completions`,
      {
        method: "POST",
        headers: llmHeaders(apiKey),
        body: JSON.stringify(body),
      },
      timeoutMs,
    );

    if (res.status === 429) {
      const err = await res.text();
      lastError = new Error(`LLM request failed: ${res.status} ${err}`);
      if (attempt < MAX_RETRIES) {
        // Respect Retry-After header if present, otherwise exponential backoff
        const retryAfter = res.headers.get("retry-after");
        const waitMs = retryAfter
          ? parseFloat(retryAfter) * 1000
          : RETRY_BASE_MS * Math.pow(2, attempt);
        await sleep(waitMs);
        continue;
      }
      throw lastError;
    }

    if (res.status === 400) {
      const err = await res.text();
      lastError = new Error(`LLM request failed: ${res.status} ${err}`);
      if (
        tools?.length &&
        err.includes("tool_use_failed") &&
        !attemptedToolNudge &&
        attempt < MAX_RETRIES
      ) {
        attemptedToolNudge = true;
        messagesForRequest = [toolNudge, ...messages];
        await sleep(300);
        continue;
      }
      throw lastError;
    }

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`LLM request failed: ${res.status} ${err}`);
    }

    const data = (await res.json()) as { choices?: Choice[] };
    const choice = data.choices?.[0];
    if (!choice) throw new Error("LLM returned no choices");
    const msg = choice.message;
    if (msg.tool_calls?.length) {
      return { toolCalls: msg.tool_calls.map(parseToolCall) };
    }
    return { content: msg.content?.trim() ?? "" };
  }

  throw lastError ?? new Error("LLM request failed after retries");
}
