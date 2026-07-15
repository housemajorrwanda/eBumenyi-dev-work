import { IChapter, ICourse, IPaged, IResponse, IDashboardStatsResponse } from "@/types";
import api from "./api";
import { getBackendURL, getUploadApiBaseURL } from "@/config/api.config";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function postWithRetry(
  url: string,
  init: RequestInit,
  attempts = 5,
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const res = await fetch(url, init);
      if (res.ok || (res.status >= 400 && res.status < 500 && res.status !== 408)) {
        return res;
      }
      if ([408, 502, 503, 504].includes(res.status) && attempt < attempts - 1) {
        await sleep(1000 * (attempt + 1));
        continue;
      }
      return res;
    } catch (err) {
      lastError = err;
      if (attempt < attempts - 1) {
        await sleep(1000 * (attempt + 1));
        continue;
      }
    }
  }
  throw lastError ?? new Error("Upload request failed");
}

export const getAllCourses = async (params?: string): Promise<IPaged<ICourse[]>> => {
  const queryParams = params ? params : "";
  return (await api.get(`/courses${queryParams}`)).data;
};

export const getAllCoursesStats = async (): Promise<IDashboardStatsResponse> => {
  return (await api.get('/courses/dashboard/statistics')).data;
};

export const getAllCoursesNoPagination = async (params?: string): Promise<IResponse<ICourse[]>> => {
  const queryParams = params ? params : "";
  return (await api.get(`/courses/all${queryParams}`)).data;
};

export const getCourseById = async (id: string): Promise<IResponse<ICourse>> => {
  return (await api.get(`/courses/${id}`)).data;
};

export const createCourse = async (
  data: Record<string, unknown>
): Promise<unknown> => {
  return (await api.post("/courses/super", data, {
    headers: {
      'Content-Type': 'application/json',
    },
  })).data;
};

export const updateCourse = async (
  id: string,
  data: Record<string, unknown>,
): Promise<unknown> => {
  return (await api.put(`/courses/super/${id}`, data, {
    headers: {
      'Content-Type': 'application/json',
    },
  })).data;
};

export const notifyCourseUsers = async (
  courseId: string,
  roles?: Array<'TRAINEE' | 'TESTER' | 'CHO' | 'TRAINER' | 'STAFF' | 'ADMIN'>,
): Promise<IResponse<{ course: ICourse; notifiedCount: number; eventType: string }>> => {
  return (await api.post(`/courses/${courseId}/notify-users`, { roles })).data;
};

export const deleteCourse = async (id: string): Promise<number> => {
  return (await api.delete(`/courses/${id}`)).data;
};

const VIDEO_EXTS = new Set(["mp4", "avi", "mov", "mkv", "webm", "flv", "wmv", "m4v", "3gp"]);

function detectSlideFileKind(file: File): "video" | "pdf" | "image" {
  // Prefer MIME type, fall back to extension (file.type can be empty on some browsers/OS)
  const mime = file.type.toLowerCase();
  if (mime.startsWith("video/")) return "video";
  if (mime === "application/pdf") return "pdf";

  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  if (VIDEO_EXTS.has(ext)) return "video";
  if (ext === "pdf") return "pdf";
  return "image";
}

/**
 * Upload a single slide file to the server and return a persisted URL.
 *
 * Endpoint routing (each uses a dedicated multer parser so the stream
 * is only consumed once — chaining two parsers breaks on non-video files):
 *   video  → POST /upload/video/chunk + /upload/video/complete (large files)
 *            or POST /upload/video (small files)  field: "video"
 *   pdf    → POST /upload/document field: "document" → Cloudinary secure_url
 *   image  → POST /upload/image    field: "image"   → Cloudinary secure_url
 */

/** 1MB chunks + fresh fetch per chunk avoids proxy cumulative body limits. */
const VIDEO_CHUNK_SIZE = 1024 * 1024;
const VIDEO_CHUNK_THRESHOLD = VIDEO_CHUNK_SIZE;

async function uploadVideoInChunks(file: File): Promise<string> {
  const uploadId = crypto.randomUUID();
  const totalChunks = Math.ceil(file.size / VIDEO_CHUNK_SIZE);
  const uploadBase = getUploadApiBaseURL();
  const token = localStorage.getItem("accessToken") ?? "";

  for (let i = 0; i < totalChunks; i++) {
    const start = i * VIDEO_CHUNK_SIZE;
    const end = Math.min(start + VIDEO_CHUNK_SIZE, file.size);
    const blob = file.slice(start, end);

    const form = new FormData();
    form.append("uploadId", uploadId);
    form.append("chunkIndex", String(i));
    form.append("totalChunks", String(totalChunks));
    form.append("fileName", file.name);
    form.append("chunk", blob, `part-${i}`);

    const res = await postWithRetry(`${uploadBase}/upload/video/chunk`, {
      method: "POST",
      headers: {
        Authorization: token,
        Accept: "application/json",
      },
      body: form,
      credentials: "include",
      cache: "no-store",
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Chunk ${i}/${totalChunks - 1} failed (HTTP ${res.status}): ${body}`);
    }

    // Brief pause so Traefik/socat can reset between chunks
    if (i < totalChunks - 1) {
      await sleep(150);
    }
  }

  const completeRes = await postWithRetry(`${uploadBase}/upload/video/complete`, {
    method: "POST",
    headers: {
      Authorization: token,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({ uploadId, totalChunks, fileName: file.name }),
  });

  if (!completeRes.ok) {
    const body = await completeRes.text();
    throw new Error(`Complete failed (HTTP ${completeRes.status}): ${body}`);
  }

  const response = await completeRes.json();
  let url: string = response?.data?.url;
  if (!url) throw new Error("Upload succeeded but no URL was returned");
  if (url.startsWith("/")) {
    url = `${getBackendURL()}${url}`;
  }
  return url;
}

export const uploadSlideFile = async (file: File): Promise<string> => {
  const kind = detectSlideFileKind(file);

  if (kind === "video" && file.size > VIDEO_CHUNK_THRESHOLD) {
    return uploadVideoInChunks(file);
  }

  let endpoint: string;
  let fieldName: string;

  if (kind === "video") {
    endpoint = "/upload/video";
    fieldName = "video";
  } else if (kind === "pdf") {
    endpoint = "/upload/document";
    fieldName = "document";
  } else {
    endpoint = "/upload/image";
    fieldName = "image";
  }

  const form = new FormData();
  form.append(fieldName, file);

  const response = await api.post(endpoint, form, {
    // Video files can be large; allow up to 10 minutes (matches API timeout)
    timeout: kind === "video" ? 600_000 : undefined,
  });

  let url: string = response.data?.data?.url;
  if (!url) throw new Error("Upload succeeded but no URL was returned");

  // Video uploads return a server-relative path (e.g. /uploads/videos/uuid.mp4).
  // Prefix with the backend base URL so it works from the browser.
  if (url.startsWith("/")) {
    url = `${getBackendURL()}${url}`;
  }

  return url;
};

import { IMyCoursesResponse, IMyCertificatesResponse, IMyCertificate, EnrolledCourse } from "@/types";

export const getCourseSectionsWithChapters = async (courseId: string): Promise<IResponse<ICourse>> => {
  return (await api.get(`/courses/${courseId}/sections`)).data;
};

export const getChapterSlides = async (chapterId: string): Promise<IResponse<IChapter>> => {
  return (await api.get(`/courses/chapters/${chapterId}/slides`)).data;
};

export const getChapterMidTestId = async (chapterId: string): Promise<string | null> => {
  try {
    const res = await api.get(`/courses/chapters/${chapterId}/midtest`);
    return res.data?.data?.id ?? null;
  } catch {
    return null;
  }
};

export const getCoursesWithProgress = async (): Promise<ICourse[]> => {
  const res = await api.get("/courses/myall");
  return (res.data?.data as ICourse[]) ?? [];
};

export const getMyCourses = async (): Promise<IMyCoursesResponse> => {
  return (await api.get("/courses/myall")).data;
};

export const getMyCertificates = async (): Promise<IMyCertificatesResponse> => {
  // Step 1: get enrolled courses
  const coursesRes = await api.get("/courses/myall");
  const enrolledCourses: EnrolledCourse[] =
    coursesRes.data?.data?.enrolledCourses ?? [];

  // Step 2: for each completed course, fetch its certificate
  const completedCourses = enrolledCourses.filter((c) => c.isCompleted);
  const certResults = await Promise.allSettled(
    completedCourses.map((c) =>
      api.get(`/certificate/my-certificate/course/${c.courseId}`)
    )
  );

  const certificates: IMyCertificate[] = certResults
    .filter((r) => r.status === "fulfilled")
    .map((r) => {
      const res = (r as PromiseFulfilledResult<{ data: { data: IMyCertificate & { course?: { title?: string } } } }>).value;
      const raw = res.data?.data;
      return {
        id: raw?.id ?? "",
        courseId: raw?.courseId ?? "",
        // Backend returns course title inside a nested course object or not at all.
        // Fall back to matching against enrolledCourses by courseId.
        courseTitle:
          raw?.course?.title ??
          enrolledCourses.find((c) => c.courseId === raw?.courseId)?.courseTitle ??
          "Isomo",
        pdf: raw?.pdf ?? "",
        createdAt: raw?.createdAt ?? "",
        updatedAt: raw?.updatedAt ?? "",
      };
    })
    .filter((c) => c.id !== "");

  return {
    message: "ok",
    statusCode: 200,
    data: certificates,
  };
};
