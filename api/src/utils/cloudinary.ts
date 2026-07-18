import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import multer from "multer";
import { v4 } from "uuid";
import { appEnv } from "../config/env";

cloudinary.config({
  api_key: appEnv.cloudinaryApiKey,
  api_secret: appEnv.cloudinaryApiSecret,
  cloud_name: appEnv.cloudName,
});
const storage = new CloudinaryStorage({
  // multer-storage-cloudinary expects older cloudinary types; cast to any to avoid TS type mismatch
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cloudinary: cloudinary as any,
  params: (req, file) => {
    // Determine resource type based on file mimetype
    let resourceType = "auto";
    const publicId = v4(); // plain UUID — no extension, no original filename

    if (file.mimetype.startsWith("video/")) {
      resourceType = "video";
    } else if (file.mimetype === "application/pdf") {
      // Use "image" (not "auto"/"raw") so Cloudinary delivers through its image pipeline.
      // Free/untrusted accounts have raw delivery blocked; image delivery is unrestricted.
      // Cloudinary auto-appends ".pdf" to the URL when resource_type is "image" and the
      // uploaded file is a PDF, so the stored URL is still a usable .pdf link.
      resourceType = "image";
    }
    // DOCX/PPTX remain "auto" (raw) — they don't need inline viewing so the restriction
    // doesn't matter; they'll be downloaded rather than previewed.

    return {
      public_id: publicId,
      folder: "chw",
      resource_type: resourceType,
      // Prevent multer-storage-cloudinary from appending the original filename to our UUID
      use_filename: false,
      unique_filename: false,
    };
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit
  },
});
export default upload;

/**
 * Given any Cloudinary delivery URL, return a Cloudinary Admin API download URL.
 *
 * This uses api.cloudinary.com (not the CDN) and authenticates with API key + secret,
 * so it completely bypasses any CDN-level delivery restrictions (401 errors).
 *
 * URL format: https://res.cloudinary.com/{cloud}/{resource_type}/upload/[v{n}/]{public_id}
 */
export function getCloudinaryDownloadUrl(
  url: string,
  forceResourceType?: "image" | "raw" | "video",
): string {
  // Detect resource type from URL path segment (overridable for fallback attempts)
  const resourceMatch = url.match(/\/([^/]+)\/upload\//);
  const resourceType =
    forceResourceType ??
    ((resourceMatch?.[1] ?? "raw") as "image" | "video" | "raw");

  // Extract everything after /upload/, decode URI encoding, strip version prefix vNNNN/
  const afterUpload = url.split("/upload/")[1];
  if (!afterUpload) return url;
  let publicId = decodeURIComponent(afterUpload.replace(/^v\d+\//, ""));

  // "raw" resources store the file extension as a literal part of the public_id, but
  // "image"/"video" resources store the format separately — the extension seen in the
  // delivery URL is auto-appended by Cloudinary, not part of the actual stored public_id.
  // Leaving it in for image/video lookups makes the Admin API search for a public_id that
  // doesn't exist, which 404s ("Resource not found") even though the asset is really there.
  let format = "";
  if (resourceType !== "raw") {
    const lastDot = publicId.lastIndexOf(".");
    if (lastDot > publicId.lastIndexOf("/")) {
      format = publicId.slice(lastDot + 1);
      publicId = publicId.slice(0, lastDot);
    }
  }

  // private_download_url generates https://api.cloudinary.com/v1_1/{cloud}/{type}/download?...
  // It includes api_key, timestamp, and HMAC signature — always accessible regardless of CDN policy.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (cloudinary.utils as any).private_download_url(publicId, format, {
    resource_type: resourceType,
    attachment: false,
  });
}

/** @deprecated Use getCloudinaryDownloadUrl instead */
export function signCloudinaryUrl(url: string): string {
  return getCloudinaryDownloadUrl(url);
}
