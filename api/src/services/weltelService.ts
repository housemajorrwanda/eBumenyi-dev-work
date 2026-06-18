import axios, { isAxiosError } from "axios";
import { randomBytes } from "crypto";
import jwt, { type SignOptions } from "jsonwebtoken";
import AppError from "../utils/error";
import { encryptJwt } from "../utils/encryptJwt";
import { normalizeRwandaPhone } from "../utils/normalizeRwandaPhone";
import { prisma } from "../utils/client";

/** @deprecated Use normalizeRwandaPhone — kept for existing imports */
export { normalizeRwandaPhone as normalizePhoneForWeltel };

export type WeltelLoginJwtPayload = {
  name: string;
  phone: string;
  locale: "en" | "rw";
};

type WeltelTokenPayload = {
  value?: string;
};

type WeltelLoginUser = {
  id: number;
  name?: string;
  username?: string;
  role?: string;
  projectId?: number;
  contact?: unknown;
};

type WeltelLoginResponse = {
  user?: WeltelLoginUser;
  project?: unknown;
  token?: string | (WeltelTokenPayload & { userId?: number });
  accessToken?: string;
  access_token?: string;
  authToken?: string;
  data?: {
    token?: string | WeltelTokenPayload;
    accessToken?: string;
    access_token?: string;
  };
};

export type WeltelPaginateOptions = {
  currPage: number;
  currPageSize: number;
};

export type WeltelSortOptions = {
  name: string;
  value: string;
};

export type WeltelListFilterOptions = {
  name: string;
  username: string;
  primaryPhone: string;
  email: string;
  healthCentre: string;
  clinicId: string;
  role: string;
  position: string;
  programActive: string;
  uniqueId: string;
  clinicGroup: unknown[];
};

type WeltelContactPayload = {
  primaryPhone: string;
  alternatePhone: null;
  email: string;
};

type CreateWeltelHcpPayload = {
  name: string;
  preferredName: string;
  clinicId: null;
  programId: null;
  uniqueId: null;
  healthCentre: string;
  contact: WeltelContactPayload;
  addInfo: null;
  comment: null;
  phoneMakeModel: null;
  cellularProvider: null;
  pinNotifications: boolean;
  clinic_groups_map: unknown[];
  position: null;
  programActive: 1;
  role: "CLINICIAN";
  localeCode: "en-us";
  username: string;
};

let cachedToken: string | null = null;
let cachedLoginUserId: number | null = null;
let cachedLoginUser: WeltelLoginUser | null = null;

function getWeltelConfig() {
  const baseUrl = process.env.WELTEL_API_BASE_URL?.replace(/\/$/, "");
  const username = process.env.WELTEL_USERNAME;
  const password = process.env.WELTEL_PASSWORD;
  const projectId = process.env.WELTEL_PROJECT_ID || "1";

  if (!baseUrl || !username || !password) {
    throw new AppError(
      "WelTel is not configured (WELTEL_API_BASE_URL, WELTEL_USERNAME, WELTEL_PASSWORD)",
      503,
    );
  }

  return { baseUrl, username, password, projectId };
}

function tokenValue(
  token: string | WeltelTokenPayload | undefined,
): string | undefined {
  if (!token) return undefined;
  if (typeof token === "string") return token;
  return token.value;
}

function extractToken(data: WeltelLoginResponse): string {
  const token =
    tokenValue(data.token) ??
    data.accessToken ??
    data.access_token ??
    data.authToken ??
    tokenValue(data.data?.token) ??
    data.data?.accessToken ??
    data.data?.access_token;

  if (!token) {
    throw new AppError("WelTel login did not return a token", 502);
  }

  return token;
}

function weltelErrorMessage(data: unknown, fallback: string): string {
  if (typeof data === "string" && data.trim()) {
    const preMatch = data.match(/<pre>([^<]+)<\/pre>/i);
    if (preMatch?.[1]) {
      return preMatch[1].trim();
    }
    if (!data.includes("<!DOCTYPE")) {
      return data.trim();
    }
  }
  if (data && typeof data === "object") {
    const body = data as Record<string, unknown>;
    if (typeof body.message === "string" && body.message) {
      return body.message;
    }
    if (typeof body.error === "string" && body.error) {
      return body.error;
    }
    if (body.error && typeof body.error === "object") {
      const nested = body.error as Record<string, unknown>;
      if (typeof nested.message === "string" && nested.message) {
        return nested.message;
      }
      return JSON.stringify(nested);
    }
  }
  return fallback;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof AppError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function hcpCreatePath(projectId: string): string {
  const configured = process.env.WELTEL_HCP_CREATE_PATH?.replace(
    "{projectId}",
    projectId,
  );
  return configured ?? `/projects/${projectId}/users`;
}

function defaultListFilterOptions(): WeltelListFilterOptions {
  return {
    name: "",
    username: "",
    primaryPhone: "",
    email: "",
    healthCentre: "",
    clinicId: "",
    role: "CLINICIAN",
    position: "",
    programActive: "1",
    uniqueId: "",
    clinicGroup: [],
  };
}

function buildUsersListQueryString(
  paginateOptions: WeltelPaginateOptions,
  filterOverrides?: Partial<WeltelListFilterOptions>,
): string {
  const paginate = encodeURIComponent(JSON.stringify(paginateOptions));
  const sort = encodeURIComponent(
    JSON.stringify({
      name: "role",
      value: "ascend",
    } satisfies WeltelSortOptions),
  );
  const filter = encodeURIComponent(
    JSON.stringify({ ...defaultListFilterOptions(), ...filterOverrides }),
  );
  return `paginateOptions=${paginate}&sortOptions=${sort}&filterOptions=${filter}`;
}

function unwrapWeltelUserResponse(
  body: Record<string, unknown>,
): Record<string, unknown> {
  const nested = body.data;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    return { ...(nested as Record<string, unknown>) };
  }
  return { ...body };
}

function phoneDigitsForMatch(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("250")) {
    return digits.slice(3);
  }
  if (digits.startsWith("0")) {
    return digits.slice(1);
  }
  return digits;
}

function isDuplicatePhoneError(error: unknown): boolean {
  const message =
    error instanceof AppError
      ? error.message
      : error instanceof Error
        ? error.message
        : String(error);
  return /already exists/i.test(message);
}

function isWeltelBrokenRecordError(message: string): boolean {
  return /undefined \(reading 'message'\)/i.test(message);
}

function axiosResponseDetail(error: unknown): {
  status?: number;
  body: unknown;
  message: string;
} {
  if (isAxiosError(error) && error.response) {
    const body = error.response.data;
    return {
      status: error.response.status,
      body,
      message: weltelErrorMessage(
        body,
        error.message ?? "WelTel request failed",
      ),
    };
  }
  if (error instanceof AppError) {
    return { status: error.status, body: undefined, message: error.message };
  }
  return {
    body: undefined,
    message: error instanceof Error ? error.message : String(error),
  };
}

function extractUsersList(data: unknown): Array<{
  id?: number;
  primaryPhone?: string;
  contact?: { primaryPhone?: string };
}> {
  if (Array.isArray(data)) {
    return data;
  }
  if (data && typeof data === "object") {
    const body = data as Record<string, unknown>;
    for (const key of ["users", "data", "rows", "items", "list"]) {
      if (Array.isArray(body[key])) {
        return body[key] as Array<{
          id?: number;
          primaryPhone?: string;
          contact?: { primaryPhone?: string };
        }>;
      }
    }
  }
  return [];
}

function buildCreateHcpPayload(input: {
  name: string;
  primaryPhone: string;
  email: string;
  username: string;
}): CreateWeltelHcpPayload {
  return {
    name: input.name,
    preferredName: "",
    clinicId: null,
    programId: null,
    uniqueId: null,
    healthCentre: "",
    contact: {
      primaryPhone: normalizeRwandaPhone(input.primaryPhone),
      alternatePhone: null,
      email: input.email,
    },
    addInfo: null,
    comment: null,
    phoneMakeModel: null,
    cellularProvider: null,
    pinNotifications: true,
    clinic_groups_map: [],
    position: null,
    programActive: 1,
    role: "CLINICIAN",
    localeCode: "en-us",
    username: input.username,
  };
}

export class WeltelService {
  public static clearTokenCache(): void {
    cachedToken = null;
    cachedLoginUserId = null;
    cachedLoginUser = null;
  }

  private static cacheLoginResponse(data: WeltelLoginResponse): string {
    const token = extractToken(data);
    cachedToken = token;

    if (data.user?.id != null) {
      cachedLoginUserId = data.user.id;
      cachedLoginUser = data.user;
    } else {
      const tokenObj = typeof data.token === "object" ? data.token : undefined;
      if (tokenObj?.userId != null) {
        cachedLoginUserId = tokenObj.userId;
      }
    }

    return token;
  }

  public static async login(): Promise<string> {
    const { baseUrl, username, password } = getWeltelConfig();

    try {
      const { data } = await axios.post<WeltelLoginResponse>(
        `${baseUrl}/login`,
        { username, password },
        { headers: { "Content-Type": "application/json" } },
      );
      return WeltelService.cacheLoginResponse(data);
    } catch (error) {
      throw WeltelService.toAppError(error, "WelTel login failed");
    }
  }

  public static async getLoggedInWeltelUserId(): Promise<number> {
    if (cachedLoginUserId != null) {
      return cachedLoginUserId;
    }
    await WeltelService.login();
    if (cachedLoginUserId == null) {
      throw new AppError("WelTel login did not return a user id", 502);
    }
    return cachedLoginUserId;
  }

  public static async getAuthToken(): Promise<string> {
    if (cachedToken) {
      return cachedToken;
    }
    return WeltelService.login();
  }

  private static authHeaders(token: string): Record<string, string> {
    // rw-chw1 accepts the login token on Authentication / authentication.
    return { Authentication: token, authentication: token };
  }

  public static getEnvInfo() {
    const { baseUrl, username, projectId } = getWeltelConfig();

    return {
      baseUrl,
      username,
      projectId,
      passwordConfigured: !!process.env.WELTEL_PASSWORD,
      loggedInUserId: cachedLoginUserId,
    };
  }

  public static async getProjectUser(weltelUserId?: number) {
    const { projectId } = getWeltelConfig();
    const id = weltelUserId ?? (await WeltelService.getLoggedInWeltelUserId());

    const data = await WeltelService.weltelGet<unknown>(
      `/projects/${projectId}/users/${id}`,
    );

    return {
      message: "WelTel user fetched successfully",
      statusCode: 200,
      data: {
        env: WeltelService.getEnvInfo(),
        weltelUserId: id,
        loginUser: cachedLoginUser,
        weltelUser: data,
      },
    };
  }

  public static async testConnection() {
    if (!WeltelService.isConfigured()) {
      throw new AppError(
        "WelTel is not configured (WELTEL_API_BASE_URL, WELTEL_USERNAME, WELTEL_PASSWORD)",
        503,
      );
    }

    const token = await WeltelService.login();
    const userId = await WeltelService.getLoggedInWeltelUserId();
    const result = await WeltelService.getProjectUser(userId);

    return {
      message: "WelTel connection and authorization OK",
      statusCode: 200,
      data: {
        ...result.data,
        authOk: true,
        tokenPreview: `${token.slice(0, 8)}...`,
      },
    };
  }

  private static toAppError(error: unknown, fallback: string): AppError {
    if (isAxiosError(error)) {
      const { status, message } = axiosResponseDetail(error);
      return new AppError(message, status ?? 502);
    }
    if (error instanceof AppError) {
      return error;
    }
    return new AppError(fallback, 502);
  }

  private static async weltelRequest<T>(
    method: "get" | "post" | "put",
    path: string,
    body?: unknown,
    retryOnUnauthorized = true,
  ): Promise<T> {
    const { baseUrl } = getWeltelConfig();
    const token = await WeltelService.getAuthToken();

    try {
      const { data } = await axios.request<T>({
        method,
        url: `${baseUrl}${path}`,
        data: body,
        headers: {
          ...WeltelService.authHeaders(token),
          "Content-Type": "application/json",
        },
      });
      return data;
    } catch (error) {
      if (
        retryOnUnauthorized &&
        isAxiosError(error) &&
        error.response?.status === 401
      ) {
        WeltelService.clearTokenCache();
        await WeltelService.login();
        return WeltelService.weltelRequest<T>(method, path, body, false);
      }
      throw WeltelService.toAppError(error, "WelTel request failed");
    }
  }

  private static async weltelGet<T>(
    path: string,
    retryOnUnauthorized = true,
  ): Promise<T> {
    return WeltelService.weltelRequest<T>(
      "get",
      path,
      undefined,
      retryOnUnauthorized,
    );
  }

  private static async weltelPost<T>(path: string, body: unknown): Promise<T> {
    return WeltelService.weltelRequest<T>("post", path, body);
  }

  private static async weltelPut<T>(path: string, body: unknown): Promise<T> {
    return WeltelService.weltelRequest<T>("put", path, body);
  }

  public static generateUniqueUsername(): string {
    const suffix = `${Date.now().toString(36)}${randomBytes(4).toString("hex")}`;
    return `hcp${suffix}`;
  }

  public static async generateUniqueYopmailEmail(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const suffix = `${Date.now().toString(36)}${randomBytes(3).toString("hex")}`;
      const email = `chw.${suffix}@yopmail.com`;
      const taken = await prisma.user.findFirst({
        where: { email },
        select: { id: true },
      });
      if (!taken) {
        return email;
      }
    }
    return `chw.${Date.now()}${randomBytes(4).toString("hex")}@yopmail.com`;
  }

  public static extractWeltelUserId(data: unknown): number {
    if (!data || typeof data !== "object") {
      throw new AppError("WelTel did not return a user id", 502);
    }

    const body = data as {
      id?: number | string;
      userId?: number | string;
      user?: { id?: number | string };
    };

    const raw = body.id ?? body.userId ?? body.user?.id;
    const parsed = typeof raw === "string" ? Number.parseInt(raw, 10) : raw;

    if (!parsed || Number.isNaN(parsed)) {
      throw new AppError("WelTel did not return a user id", 502);
    }

    return parsed;
  }

  public static isConfigured(): boolean {
    return !!(
      process.env.WELTEL_API_BASE_URL &&
      process.env.WELTEL_USERNAME &&
      process.env.WELTEL_PASSWORD
    );
  }

  public static isLoginJwtConfigured(): boolean {
    return !!(
      process.env.WELTEL_SECRET &&
      process.env.WELTEL_ENCRYPTION_KEY &&
      WeltelService.getWeltelLoginBaseUrl()
    );
  }

  private static getWeltelEncryptionKey(): string {
    const key = process.env.WELTEL_ENCRYPTION_KEY;
    if (!key) {
      throw new AppError(
        "WelTel login JWT encryption is not configured (WELTEL_ENCRYPTION_KEY)",
        503,
      );
    }

    const keyBytes = Buffer.from(key, "hex");
    if (keyBytes.length !== 32) {
      throw new AppError(
        "WELTEL_ENCRYPTION_KEY must be a 32-byte hex string (64 hex characters)",
        503,
      );
    }

    return key;
  }

  private static getWeltelLoginBaseUrl(): string {
    const configured = process.env.WELTEL_LOGIN_URL?.replace(/\/$/, "");
    if (configured) {
      return configured;
    }

    const apiBase = process.env.WELTEL_API_BASE_URL?.replace(/\/$/, "");
    if (apiBase) {
      return `${apiBase.replace(/\/api\/v1$/i, "")}/login`;
    }

    return "https://rw-chw1.weltelhealth.net/login";
  }

  private static normalizeWeltelLocale(
    language: string | null | undefined,
  ): "en" | "rw" {
    return language === "en" ? "en" : "rw";
  }

  /**
   * Sign and AES-256-GCM-encrypt a jwtKey for WelTel SSO login (payload: name + phone + locale).
   */
  public static generateLoginJwtKey(payload: WeltelLoginJwtPayload): string {
    const secret = process.env.WELTEL_SECRET;
    if (!secret) {
      throw new AppError(
        "WelTel login JWT is not configured (WELTEL_SECRET)",
        503,
      );
    }

    const options: SignOptions = {
      expiresIn: (process.env.WELTEL_JWT_EXPIRES_IN ??
        "24h") as SignOptions["expiresIn"],
    };

    const phone = normalizeRwandaPhone(payload.phone);

    const rawJwt = jwt.sign(
      {
        name: payload.name,
        phone,
        locale: payload.locale,
      },
      secret,
      options,
    );

    return encryptJwt(rawJwt, WeltelService.getWeltelEncryptionKey());
  }

  public static buildLoginUrl(
    jwtKey: string,
    locale: "en" | "rw",
  ): string {
    const base = WeltelService.getWeltelLoginBaseUrl();
    const url = new URL(base);
    url.searchParams.set("jwtKey", jwtKey);
    url.searchParams.set("locale", locale);
    return url.toString();
  }

  /**
   * Build WelTel login URL for an ebumenyi user (name + phone from profile).
   */
  public static async getLoginUrlForEbumenyiUser(userId: string) {
    if (!WeltelService.isLoginJwtConfigured()) {
      throw new AppError(
        "WelTel login JWT is not configured (WELTEL_SECRET, WELTEL_ENCRYPTION_KEY, WELTEL_LOGIN_URL or WELTEL_API_BASE_URL)",
        503,
      );
    }

    const [user, userSettings] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { fullNames: true, phoneNumber: true },
      }),
      prisma.userSettings.findUnique({
        where: { userId },
        select: { language: true },
      }),
    ]);

    if (!user) {
      throw new AppError("User not found", 404);
    }

    if (!user.fullNames?.trim() || !user.phoneNumber?.trim()) {
      throw new AppError(
        "Profile must include fullNames and phoneNumber before opening WelTel",
        400,
      );
    }

    const phone = normalizeRwandaPhone(user.phoneNumber.trim());

    if (phone !== user.phoneNumber.trim()) {
      await prisma.user.update({
        where: { id: userId },
        data: { phoneNumber: phone },
      });
    }

    const locale = WeltelService.normalizeWeltelLocale(userSettings?.language);

    const jwtKey = WeltelService.generateLoginJwtKey({
      name: user.fullNames.trim(),
      phone,
      locale,
    });

    const loginUrl = WeltelService.buildLoginUrl(jwtKey, locale);

    return {
      message: "WelTel login URL generated",
      statusCode: 200,
      data: {
        loginUrl,
        jwtKey,
        name: user.fullNames.trim(),
        phone,
      },
    };
  }

  /**
   * Create a clinician in WelTel from name + phone only.
   * Email and username are generated automatically.
   */
  public static async findHealthcareProviderByPhone(
    phone: string,
  ): Promise<number | null> {
    const needle = phoneDigitsForMatch(phone);
    const { data } = await WeltelService.getUsers({ currPageSize: 1000 });
    const list = extractUsersList(data);

    for (const row of list) {
      const rowPhone =
        row.primaryPhone ??
        (row.contact && typeof row.contact === "object"
          ? row.contact.primaryPhone
          : undefined);
      if (!rowPhone || row.id == null) {
        continue;
      }
      if (phoneDigitsForMatch(rowPhone) === needle) {
        return row.id;
      }
    }

    return null;
  }

  public static async provisionHealthcareProvider(input: {
    name: string;
    phone: string;
    email?: string;
  }): Promise<{ weltelUserId: number; email: string; username: string }> {
    const phone = normalizeRwandaPhone(input.phone);
    const email =
      input.email ?? (await WeltelService.generateUniqueYopmailEmail());
    const username = WeltelService.generateUniqueUsername();

    try {
      const weltelUserId = await WeltelService.createHealthcareProvider({
        name: input.name,
        primaryPhone: phone,
        email,
        username,
      });
      return { weltelUserId, email, username };
    } catch (error) {
      if (!isDuplicatePhoneError(error)) {
        throw error;
      }

      const linkedId = await WeltelService.findHealthcareProviderByPhone(phone);
      if (linkedId == null) {
        throw error;
      }

      await WeltelService.updateHealthcareProvider(linkedId, {
        name: input.name,
        primaryPhone: phone,
        email,
      });

      return { weltelUserId: linkedId, email, username };
    }
  }

  /** No-op PUT; catches WelTel records that cannot be updated via API. */
  private static async assertWeltelUserUpdatable(
    weltelUserId: number,
  ): Promise<void> {
    const { projectId } = getWeltelConfig();
    const path = `/projects/${projectId}/users/${weltelUserId}`;
    const user = unwrapWeltelUserResponse(
      await WeltelService.weltelGet<Record<string, unknown>>(path),
    );

    try {
      await WeltelService.weltelPut<unknown>(path, user);
    } catch (error) {
      const { status, message, body } = axiosResponseDetail(error);
      if (status === 400 && isWeltelBrokenRecordError(message)) {
        console.warn(
          `[WelTel] user ${weltelUserId} was created but cannot be updated via API (invalid WelTel record). Fix or delete user ${weltelUserId} in WelTel admin.`,
        );
        return;
      }
      console.warn(
        `[WelTel] updatability check failed for user ${weltelUserId}:`,
        message,
        body,
      );
    }
  }

  /**
   * Update clinician in WelTel — PUT only (no POST /users/{id} or /rw/users/{id}).
   * Flow: GET user → merge name/contact → PUT full user object.
   */
  public static async updateHealthcareProvider(
    weltelUserId: number,
    input: {
      name?: string;
      primaryPhone?: string;
      email?: string;
    },
  ): Promise<void> {
    const { baseUrl, projectId } = getWeltelConfig();

    if (
      input.name === undefined &&
      input.primaryPhone === undefined &&
      input.email === undefined
    ) {
      console.info("[WelTel] update skipped — no fields to change", {
        weltelUserId,
      });
      return;
    }

    const path = `/projects/${projectId}/users/${weltelUserId}`;
    const raw = await WeltelService.weltelGet<Record<string, unknown>>(path);
    const user = unwrapWeltelUserResponse(raw);

    if (input.name !== undefined) {
      user.name = input.name;
    }

    const contact =
      user.contact && typeof user.contact === "object"
        ? { ...(user.contact as Record<string, unknown>) }
        : {
            alternatePhone: null,
            primaryPhone: "",
            email: "",
          };

    if (input.primaryPhone !== undefined) {
      contact.primaryPhone = normalizeRwandaPhone(input.primaryPhone);
    }
    if (input.email !== undefined) {
      contact.email = input.email;
    }
    user.contact = contact;

    const editorId = await WeltelService.getLoggedInWeltelUserId().catch(
      () => null,
    );
    if (editorId != null) {
      user.editedBy = editorId;
    }

    console.info("[WelTel] update request", {
      method: "PUT",
      path,
      patch: input,
      payloadSummary: {
        id: user.id,
        name: user.name,
        contact: user.contact,
      },
    });

    try {
      const result = await WeltelService.weltelPut<unknown>(path, user);
      console.info("[WelTel] update response OK", {
        path,
        weltelUserId,
        name: (result as { name?: string })?.name ?? user.name,
      });
    } catch (error) {
      const { status, message, body } = axiosResponseDetail(error);

      const hint =
        status === 403
          ? "WelTel rejected the update (forbidden)."
          : status === 400 && isWeltelBrokenRecordError(message)
            ? `WelTel user ${weltelUserId} is not updatable via API (broken record). Delete or fix this user in WelTel admin, clear weltelUserId in ebumenyi, then backfill again.`
            : undefined;

      console.error("[WelTel] update response FAILED", {
        method: "PUT",
        url: `${baseUrl}${path}`,
        status,
        message,
        responseBody: body,
        hint,
      });

      throw new AppError(
        hint ?? `WelTel update failed (${status ?? "error"}): ${message}`,
        status ?? 502,
      );
    }
  }

  private static async createHealthcareProvider(input: {
    name: string;
    primaryPhone: string;
    email: string;
    username: string;
  }): Promise<number> {
    const path = hcpCreatePath(getWeltelConfig().projectId);
    const payload = buildCreateHcpPayload(input);

    try {
      const data = await WeltelService.weltelPost<unknown>(path, payload);
      const weltelUserId = WeltelService.extractWeltelUserId(data);
      await WeltelService.assertWeltelUserUpdatable(weltelUserId);
      return weltelUserId;
    } catch (error) {
      const message = getErrorMessage(error);
      const status =
        error instanceof AppError
          ? error.status
          : isAxiosError(error)
            ? error.response?.status
            : undefined;

      throw new AppError(
        `WelTel create failed at ${path} (${status ?? "error"}): ${message}`,
        status ?? 502,
      );
    }
  }

  public static async getUsers(options?: {
    currPage?: number;
    currPageSize?: number;
    role?: string;
  }) {
    const { projectId } = getWeltelConfig();

    const paginateOptions: WeltelPaginateOptions = {
      currPage: options?.currPage ?? 1,
      currPageSize: options?.currPageSize ?? 1000,
    };

    const query = buildUsersListQueryString(paginateOptions, {
      role: options?.role ?? "CLINICIAN",
    });
    const data = await WeltelService.weltelGet<unknown>(
      `/projects/${projectId}/users?${query}`,
    );

    return {
      message: "WelTel users fetched successfully",
      statusCode: 200,
      data,
    };
  }
}
