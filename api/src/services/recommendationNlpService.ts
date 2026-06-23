import { chat } from "./llmAdapter";

export type RecReason =
  | "no_attempt"
  | "below_pass"
  | "barely_passed"
  | "fast_pace_review"
  | "incomplete_slides";

export type Severity = "high" | "moderate" | "low";

export interface RecommendationChapterInput {
  chapterId: string;
  sectionId: string;
  chapterTitle: string;
  chapterNumber: number;
  bestMarks: number | null;
  marksToPass: number | null;
  attemptCount: number;
  reasons: RecReason[];
  severity: Severity;
}

export interface ConversationalMessage {
  id: string;
  role: "assistant";
  content: string;
  chapterId?: string;
  sectionId?: string;
  actionLabel?: string;
  severity?: Severity;
}

export interface ConversationalRecommendationResult {
  messages: ConversationalMessage[];
  generatedByNlp: boolean;
}

type RecommendationNlpInput = {
  studentFirstName: string;
  courseTitle: string;
  completedQuickly: boolean;
  chapters: RecommendationChapterInput[];
};

const SYSTEM_PROMPT = `You are a warm, supportive learning coach on the eBumenyi CHW training platform.
Write ONLY in Kinyarwanda (Ikinyarwanda). Sound natural and conversational — like a helpful colleague, not a report.

Rules:
- Use ONLY the facts provided in the user message. Never invent scores, chapter titles, or reasons.
- Address the trainee by their first name when given.
- Be encouraging but honest when performance was weak.
- Keep each message short (1–3 sentences).
- Return valid JSON only — no markdown, no code fences.

JSON shape:
{
  "messages": [
    { "kind": "intro", "content": "..." },
    { "kind": "chapter", "chapterNumber": 1, "content": "..." },
    { "kind": "closing", "content": "..." }
  ]
}

Use "kind": "intro" once at the start.
Use "kind": "chapter" once per recommended chapter (chapterNumber must match the input).
Use "kind": "closing" once at the end with brief encouragement.
If there are no chapters to recommend, only return intro + closing (no chapter messages).`;

function firstNameFrom(fullNames: string): string {
  const trimmed = fullNames.trim();
  if (!trimmed) return "mukoresha";
  return trimmed.split(/\s+/)[0] ?? trimmed;
}

function reasonPhraseRw(
  reasons: RecReason[],
  attemptCount: number,
  bestMarks: number | null,
  marksToPass: number | null,
): string {
  const visible = reasons.filter((r) => r !== "no_attempt");
  if (visible.length === 0 && attemptCount === 0) {
    return "ntiwigeze ukora ikizamini cy'iki cyiciro";
  }
  const parts: string[] = [];
  if (reasons.includes("below_pass") && bestMarks != null && marksToPass != null) {
    parts.push(`amanota yawe (${bestMarks}) yari hasi y'agenzura (${marksToPass})`);
  } else if (reasons.includes("barely_passed")) {
    parts.push("wanyereye gusa ku kizamini");
  }
  if (reasons.includes("incomplete_slides")) {
    parts.push("amashusho menshi ntiyarangije neza");
  }
  if (reasons.includes("fast_pace_review")) {
    parts.push("bisaba gusubiramo vuba");
  }
  return parts.join(", ") || "bisaba gusubiramo";
}

function buildFallbackMessages(input: RecommendationNlpInput): ConversationalMessage[] {
  const name = input.studentFirstName;
  const { courseTitle, completedQuickly, chapters } = input;
  const messages: ConversationalMessage[] = [];

  if (chapters.length === 0) {
    messages.push({
      id: "intro",
      role: "assistant",
      content: completedQuickly
        ? `Muraho ${name}! Warangije «${courseTitle}» vuba cyane, ariko ukoze neza ku masomo ya hagati. Komeza utyo — urimo gukora neza!`
        : `Muraho ${name}! Nasanze ko umusaruro wawe kuri «${courseTitle}» ni mwiza. Urakoze cyane — komeza utyo!`,
    });
    messages.push({
      id: "closing",
      role: "assistant",
      content: "Niba ushaka gusubiramo ibice by'isomo, kanda hepfo ujye ku isomo.",
      actionLabel: "Jya ku isomo",
    });
    return messages;
  }

  messages.push({
    id: "intro",
    role: "assistant",
    content: completedQuickly
      ? `Muraho ${name}! Urangije «${courseTitle}», ariko nabyibutse ko warangije vuba — reba neza ibi bice nkurikira.`
      : `Muraho ${name}! Nasanze ibitabo byawe bya «${courseTitle}» — mfite inama nke zishobora kugufasha gukomeza neza.`,
  });

  chapters.forEach((ch, index) => {
    const why = reasonPhraseRw(
      ch.reasons,
      ch.attemptCount,
      ch.bestMarks,
      ch.marksToPass,
    );
    messages.push({
      id: `chapter-${ch.chapterId}`,
      role: "assistant",
      content: `Icyiciro ${ch.chapterNumber}\n${ch.chapterTitle}\n\n${why}. Subiramo umenye neza.`,
      chapterId: ch.chapterId,
      sectionId: ch.sectionId,
      actionLabel: "Jya ku cyiciro",
      severity: ch.severity,
    });
  });

  messages.push({
    id: "closing",
    role: "assistant",
    content: `Ushobora gusubiramo buri cyiciro cyangwa ukajya ku isomo «${courseTitle}» uhereye aho ukeneye. Niba ukeneye ubufasha, ntuzuyaze kutubaza!`,
    actionLabel: "Jya ku isomo",
  });

  return messages;
}

type LlmMessageKind = "intro" | "chapter" | "closing";

type LlmMessagePayload = {
  kind: LlmMessageKind;
  content?: string;
  chapterNumber?: number;
};

function parseLlmJson(raw: string): LlmMessagePayload[] | null {
  const trimmed = raw.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[0]) as { messages?: LlmMessagePayload[] };
    if (!Array.isArray(parsed.messages) || parsed.messages.length === 0) return null;
    const valid = parsed.messages.every(
      (m) =>
        m &&
        typeof m === "object" &&
        (m.kind === "intro" || m.kind === "chapter" || m.kind === "closing") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0,
    );
    return valid ? parsed.messages : null;
  } catch {
    return null;
  }
}

function mapLlmToMessages(
  llmMessages: LlmMessagePayload[],
  input: RecommendationNlpInput,
): ConversationalMessage[] | null {
  const chapterByNumber = new Map(
    input.chapters.map((c) => [c.chapterNumber, c]),
  );
  const result: ConversationalMessage[] = [];
  let chapterIdx = 0;

  for (let i = 0; i < llmMessages.length; i++) {
    const m = llmMessages[i];
    const content = m.content!.trim();

    if (m.kind === "intro") {
      result.push({ id: "intro", role: "assistant", content });
      continue;
    }

    if (m.kind === "chapter") {
      const num = m.chapterNumber;
      const ch =
        (num != null ? chapterByNumber.get(num) : undefined) ??
        input.chapters[chapterIdx];
      if (!ch) continue;
      chapterIdx += 1;
      result.push({
        id: `chapter-${ch.chapterId}`,
        role: "assistant",
        content,
        chapterId: ch.chapterId,
        sectionId: ch.sectionId,
        actionLabel: "Jya ku cyiciro",
        severity: ch.severity,
      });
      continue;
    }

    if (m.kind === "closing") {
      result.push({
        id: "closing",
        role: "assistant",
        content,
        actionLabel: input.chapters.length > 0 ? "Jya ku isomo" : "Jya ku isomo",
      });
    }
  }

  if (result.length === 0) return null;

  const hasClosing = result.some((m) => m.id === "closing");
  if (!hasClosing) {
    result.push({
      id: "closing",
      role: "assistant",
      content: "Komeza utyo — niba ukeneye gusubiramo, kanda hepfo ujye ku isomo.",
      actionLabel: "Jya ku isomo",
    });
  }

  return result;
}

function buildLlmUserPrompt(input: RecommendationNlpInput): string {
  const chapterLines = input.chapters.map((c) => {
    const reasons = c.reasons.join(", ") || "review";
    const marks =
      c.attemptCount > 0
        ? `attempts=${c.attemptCount}, bestMarks=${c.bestMarks}, passMark=${c.marksToPass}`
        : "no mid-test attempt yet";
    return `- Chapter ${c.chapterNumber}: "${c.chapterTitle}" | severity=${c.severity} | ${marks} | reasons=${reasons}`;
  });

  return [
    `Trainee first name: ${input.studentFirstName}`,
    `Course: "${input.courseTitle}"`,
    `Completed quickly (rushed): ${input.completedQuickly}`,
    `Recommended chapters (${input.chapters.length}):`,
    chapterLines.length ? chapterLines.join("\n") : "(none — good performance)",
    "",
    "Write conversational Kinyarwanda messages as JSON.",
  ].join("\n");
}

export function extractStudentFirstName(fullNames: string | null | undefined): string {
  return firstNameFrom(fullNames ?? "");
}

export async function generateConversationalRecommendations(
  input: RecommendationNlpInput,
): Promise<ConversationalRecommendationResult> {
  const fallback = buildFallbackMessages(input);

  try {
    const response = await chat([
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildLlmUserPrompt(input) },
    ]);

    if ("content" in response && response.content) {
      const llmMessages = parseLlmJson(response.content);
      if (llmMessages) {
        const mapped = mapLlmToMessages(llmMessages, input);
        if (mapped && mapped.length > 0) {
          return { messages: mapped, generatedByNlp: true };
        }
      }
    }
  } catch (err) {
    console.warn(
      "[recommendationNlp] LLM unavailable, using template fallback:",
      err instanceof Error ? err.message : err,
    );
  }

  return { messages: fallback, generatedByNlp: false };
}
