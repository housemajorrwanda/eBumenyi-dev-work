/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Body,
  Get,
  Middlewares,
  Post,
  Query,
  Request,
  Route,
  Tags,
  Security,
} from "tsoa";
import { Request as ExpressRequest } from "express";
import { checkRole } from "../middlewares";
import { roles } from "../utils/roles";
import { signCloudinaryUrl } from "../utils/cloudinary";
// import upload from "../utils/cloudinary";
import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 } from "uuid";

// Must match the base path that express.static uses in index.ts
const UPLOADS_BASE =
  process.env.UPLOAD_PATH || path.join(process.cwd(), "uploads");

const VIDEO_EXTENSIONS = new Set([
  ".mp4",
  ".mov",
  ".avi",
  ".mkv",
  ".webm",
  ".m4v",
  ".3gp",
  ".flv",
  ".wmv",
]);

function isVideoUpload(file: Express.Multer.File): boolean {
  if (file.mimetype.startsWith("video/")) return true;
  const ext = path.extname(file.originalname).toLowerCase();
  return VIDEO_EXTENSIONS.has(ext);
}

const CHUNK_DIR = ".chunks";
const MAX_VIDEO_CHUNKS = 512; // 512 × 4MB ≈ 2GB

function isValidUploadId(uploadId: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    uploadId,
  );
}

function getChunkDir(uploadId: string): string {
  return path.join(UPLOADS_BASE, "videos", CHUNK_DIR, uploadId);
}

function isAllowedVideoFileName(fileName: string): boolean {
  const ext = path.extname(fileName).toLowerCase();
  return VIDEO_EXTENSIONS.has(ext);
}

interface FileUploadResponse {
  statusCode: number;
  message: string;
  data: {
    url: string;
    publicId: string;
    originalName: string;
    size: number;
    format: string;
  } | null;
}

interface MultipleFileUploadResponse {
  statusCode: number;
  message: string;
  data: Array<{
    url: string;
    publicId: string;
    originalName: string;
    size: number;
    format: string;
    fieldName: string;
  }>;
}

// Enhanced local disk storage for videos
const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(UPLOADS_BASE, "videos");

    console.log("📁 Video upload destination:", uploadPath);

    try {
      fs.mkdirSync(uploadPath, { recursive: true });
      console.log("✅ Upload directory created/verified:", uploadPath);
    } catch (error) {
      console.error("❌ Failed to create upload directory:", error);
    }

    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `${v4()}${ext}`;
    console.log("📄 Generated filename:", filename);
    cb(null, filename);
  },
});

// Video-only upload middleware
const videoUpload = multer({
  storage: videoStorage,
  limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2GB
  fileFilter: (req, file, cb) => {
    if (isVideoUpload(file)) {
      cb(null, true);
    } else {
      cb(new Error("Only video files are allowed for video upload"));
    }
  },
});

// Chunked video upload — each part ≤ 8MB so it passes through reverse proxies
const chunkStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const uploadId = req.body?.uploadId as string | undefined;
    if (!uploadId || !isValidUploadId(uploadId)) {
      cb(new Error("Valid uploadId (UUID) is required"), "");
      return;
    }
    const dir = getChunkDir(uploadId);
    try {
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    } catch (error) {
      cb(error as Error, "");
    }
  },
  filename: (req, _file, cb) => {
    const idx = String(req.body?.chunkIndex ?? "0");
    cb(null, `part-${idx}`);
  },
});

const chunkUpload = multer({
  storage: chunkStorage,
  limits: { fileSize: 8 * 1024 * 1024 },
});

// General file upload (non-video) middleware
const generalUpload = multer({
  storage: multer.memoryStorage(), // Use memory storage for Cloudinary
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB for non-videos
  fileFilter: (req, file, cb) => {
    // Reject videos in general upload
    if (file.mimetype.startsWith("video/")) {
      cb(new Error("Videos should use video upload endpoint"));
    } else {
      cb(null, true);
    }
  },
});

@Route("/api/upload")
@Tags("File Upload")
export class FileUploadController {
  /**
   * Upload a single file - Videos go to local storage, others to Cloudinary
   * @summary Upload single file
   */
  @Post("/single")
  @Security("jwt")
  @Middlewares(
    checkRole(
      roles.STAFF,
      roles.CHO,
      roles.TRAINER,
      roles.ADMIN,
      roles.TRAINEE,
    ),
  )
  public async uploadSingleFile(
    @Request() req: ExpressRequest,
  ): Promise<FileUploadResponse> {
    try {
      // First, check if it's a video and handle accordingly
      const contentType = req.headers["content-type"] || "";

      if (contentType.includes("multipart/form-data")) {
        // Use appropriate middleware based on file type detection
        return new Promise((resolve, reject) => {
          // First parse with video upload to check if it's a video
          videoUpload.single("file")(req, {} as any, async (err: any) => {
            if (
              err &&
              err.message &&
              err.message.includes("Only video files are allowed")
            ) {
              // Not a video, try general upload
              generalUpload.single("file")(req, {} as any, async (err: any) => {
                if (err) {
                  reject(err);
                  return;
                }

                if (!req.file) {
                  resolve({
                    statusCode: 400,
                    message: "No file provided",
                    data: null,
                  });
                  return;
                }

                // Upload to Cloudinary for non-video files
                try {
                  const result = await this.uploadToCloudinary(req.file);
                  resolve({
                    statusCode: 200,
                    message: "File uploaded to Cloudinary successfully",
                    data: result,
                  });
                } catch (error) {
                  reject(error);
                }
              });
            } else if (err) {
              reject(err);
            } else {
              // Video file processed successfully
              if (!req.file) {
                resolve({
                  statusCode: 400,
                  message: "No file provided",
                  data: null,
                });
                return;
              }

              const file = req.file;

              // Verify file was saved locally
              const filePath = path.join(file.destination, file.filename);
              const fileExists = fs.existsSync(filePath);

              if (!fileExists) {
                resolve({
                  statusCode: 500,
                  message: "Video file was not saved properly",
                  data: null,
                });
                return;
              }

              resolve({
                statusCode: 200,
                message: "Video saved locally successfully",
                data: {
                  url: `/uploads/videos/${file.filename}`,
                  publicId: `videos/${file.filename}`,
                  originalName: file.originalname,
                  size: file.size,
                  format: file.mimetype,
                },
              });
            }
          });
        });
      } else {
        return {
          statusCode: 400,
          message: "Invalid content type. Use multipart/form-data",
          data: null,
        };
      }
    } catch (error: any) {
      console.error("❌ File upload error:", error);
      return this.handleUploadError(error);
    }
  }

  /**
   * Upload video file specifically to local storage
   * @summary Upload video file
   */
  @Post("/video")
  @Security("jwt")
  @Middlewares(
    videoUpload.single("video"),
    checkRole(
      roles.STAFF,
      roles.CHO,
      roles.TRAINER,
      roles.ADMIN,
      roles.TRAINEE,
    ),
  )
  public async uploadVideo(
    @Request() req: ExpressRequest,
  ): Promise<FileUploadResponse> {
    try {
      if (!req.file) {
        return {
          statusCode: 400,
          message: "No video file provided",
          data: null,
        };
      }

      const file = req.file;

      // Verify file was saved locally
      const filePath = path.join(file.destination, file.filename);
      const fileExists = fs.existsSync(filePath);

      if (!fileExists) {
        return {
          statusCode: 500,
          message: "Video file was not saved properly",
          data: null,
        };
      }

      console.log(`🎥 Video uploaded successfully:`, {
        originalName: file.originalname,
        filename: file.filename,
        size: (file.size / (1024 * 1024)).toFixed(2) + "MB",
        path: filePath,
      });

      return {
        statusCode: 200,
        message: "Video uploaded successfully",
        data: {
          url: `/uploads/videos/${file.filename}`,
          publicId: `videos/${file.filename}`,
          originalName: file.originalname,
          size: file.size,
          format: file.mimetype,
        },
      };
    } catch (error: any) {
      console.error("❌ Video upload error:", error);
      return this.handleUploadError(error);
    }
  }

  /**
   * Upload one chunk of a large video (use with /video/complete).
   * Send form fields uploadId, chunkIndex, totalChunks, fileName before the chunk file.
   */
  @Post("/video/chunk")
  @Security("jwt")
  @Middlewares(
    chunkUpload.single("chunk"),
    checkRole(
      roles.STAFF,
      roles.CHO,
      roles.TRAINER,
      roles.ADMIN,
      roles.TRAINEE,
    ),
  )
  public async uploadVideoChunk(
    @Request() req: ExpressRequest,
  ): Promise<{
    statusCode: number;
    message: string;
    data: { uploadId: string; chunkIndex: number; totalChunks: number } | null;
  }> {
    try {
      const uploadId = String(req.body?.uploadId ?? "");
      const chunkIndex = Number(req.body?.chunkIndex);
      const totalChunks = Number(req.body?.totalChunks);
      const fileName = String(req.body?.fileName ?? "");

      if (!isValidUploadId(uploadId)) {
        return {
          statusCode: 400,
          message: "Invalid uploadId",
          data: null,
        };
      }
      if (
        !Number.isInteger(chunkIndex) ||
        !Number.isInteger(totalChunks) ||
        chunkIndex < 0 ||
        totalChunks < 1 ||
        totalChunks > MAX_VIDEO_CHUNKS ||
        chunkIndex >= totalChunks
      ) {
        return {
          statusCode: 400,
          message: "Invalid chunkIndex or totalChunks",
          data: null,
        };
      }
      if (!fileName || !isAllowedVideoFileName(fileName)) {
        return {
          statusCode: 400,
          message: "Invalid video fileName",
          data: null,
        };
      }
      if (!req.file) {
        return {
          statusCode: 400,
          message: "No chunk data provided",
          data: null,
        };
      }

      fs.writeFileSync(
        path.join(getChunkDir(uploadId), "meta.json"),
        JSON.stringify({ fileName, totalChunks }),
      );

      return {
        statusCode: 200,
        message: "Chunk uploaded",
        data: { uploadId, chunkIndex, totalChunks },
      };
    } catch (error: any) {
      console.error("❌ Video chunk upload error:", error);
      return {
        statusCode: 500,
        message: error.message || "Chunk upload failed",
        data: null,
      };
    }
  }

  /**
   * Merge uploaded chunks into the final video file on disk.
   */
  @Post("/video/complete")
  @Security("jwt")
  @Middlewares(
    checkRole(
      roles.STAFF,
      roles.CHO,
      roles.TRAINER,
      roles.ADMIN,
      roles.TRAINEE,
    ),
  )
  public async completeVideoUpload(
    @Body()
    body: {
      uploadId: string;
      totalChunks: number;
      fileName: string;
    },
  ): Promise<FileUploadResponse> {
    const { uploadId, totalChunks, fileName } = body;

    if (!isValidUploadId(uploadId)) {
      return { statusCode: 400, message: "Invalid uploadId", data: null };
    }
    if (
      !Number.isInteger(totalChunks) ||
      totalChunks < 1 ||
      totalChunks > MAX_VIDEO_CHUNKS
    ) {
      return {
        statusCode: 400,
        message: "Invalid totalChunks",
        data: null,
      };
    }
    if (!fileName || !isAllowedVideoFileName(fileName)) {
      return {
        statusCode: 400,
        message: "Invalid video fileName",
        data: null,
      };
    }

    const chunkDir = getChunkDir(uploadId);
    if (!fs.existsSync(chunkDir)) {
      return {
        statusCode: 400,
        message: "Upload session not found",
        data: null,
      };
    }

    try {
      for (let i = 0; i < totalChunks; i++) {
        const partPath = path.join(chunkDir, `part-${i}`);
        if (!fs.existsSync(partPath)) {
          return {
            statusCode: 400,
            message: `Missing chunk ${i} of ${totalChunks}`,
            data: null,
          };
        }
      }

      const ext = path.extname(fileName).toLowerCase();
      const finalName = `${v4()}${ext}`;
      const finalPath = path.join(UPLOADS_BASE, "videos", finalName);

      const fd = fs.openSync(finalPath, "w");
      try {
        for (let i = 0; i < totalChunks; i++) {
          const partPath = path.join(chunkDir, `part-${i}`);
          const data = fs.readFileSync(partPath);
          fs.writeSync(fd, data);
        }
      } finally {
        fs.closeSync(fd);
      }

      fs.rmSync(chunkDir, { recursive: true, force: true });

      const stats = fs.statSync(finalPath);
      console.log(`🎥 Video assembled from chunks:`, {
        originalName: fileName,
        filename: finalName,
        size: (stats.size / (1024 * 1024)).toFixed(2) + "MB",
      });

      return {
        statusCode: 200,
        message: "Video uploaded successfully",
        data: {
          url: `/uploads/videos/${finalName}`,
          publicId: `videos/${finalName}`,
          originalName: fileName,
          size: stats.size,
          format: "video/mp4",
        },
      };
    } catch (error: any) {
      console.error("❌ Video complete error:", error);
      return this.handleUploadError(error);
    }
  }

  /**
   * Upload multiple files to Cloudinary (non-videos only)
   * @summary Upload multiple files
   */
  @Post("/multiple")
  @Security("jwt")
  @Middlewares(
    generalUpload.array("files", 10),
    checkRole(
      roles.STAFF,
      roles.CHO,
      roles.TRAINER,
      roles.ADMIN,
      roles.TRAINEE,
    ),
  )
  public async uploadMultipleFiles(
    @Request() req: ExpressRequest,
  ): Promise<MultipleFileUploadResponse> {
    try {
      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        return {
          statusCode: 400,
          message: "No files provided",
          data: [],
        };
      }

      const files = req.files as Express.Multer.File[];
      const uploadResults = [];

      for (const file of files) {
        try {
          const result = await this.uploadToCloudinary(file);
          uploadResults.push({
            ...result,
            fieldName: file.fieldname,
          });
        } catch (error) {
          console.error(`❌ Failed to upload ${file.originalname}:`, error);
          // Continue with other files even if one fails
        }
      }

      return {
        statusCode: 200,
        message: `${uploadResults.length}/${files.length} files uploaded successfully`,
        data: uploadResults,
      };
    } catch (error: any) {
      console.error("❌ Multiple files upload error:", error);
      return {
        statusCode: 500,
        message: error?.message || "File upload failed",
        data: [],
      };
    }
  }

  /**
   * Helper method to upload files to Cloudinary
   */
  private async uploadToCloudinary(file: Express.Multer.File): Promise<any> {
    // Since we're using memory storage, we need to upload the buffer to Cloudinary
    const { v2: cloudinary } = await import("cloudinary");

    // Images → "image" resource type (Cloudinary transformations available)
    // PDFs / documents → "raw" resource type so Cloudinary returns a plain
    // delivery URL accessible without a paid image-rendering add-on.
    // Using "auto" for PDFs causes Cloudinary to treat them as images and
    // return a 401 Unauthorized unless the account has the PDF viewer add-on.
    const resourceType: "image" | "raw" = file.mimetype.startsWith("image/")
      ? "image"
      : "raw";

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: resourceType,
          folder: "chw",
          public_id: `${v4()}_${file.originalname}`,
          type: "upload",
          access_mode: "public",
        },
        (error: any, result: any) => {
          if (error) {
            reject(error);
          } else {
            resolve({
              url: result?.secure_url || result?.url,
              publicId: result?.public_id,
              originalName: file.originalname,
              size: file.size,
              format: file.mimetype,
            });
          }
        },
      );

      uploadStream.end(file.buffer);
    });
  }

  /**
   * Handle upload errors consistently
   */
  private handleUploadError(error: any): FileUploadResponse {
    // Check if it's a file size error
    if (error.message && error.message.includes("File size too large")) {
      const sizeMatch = error.message.match(/Got (\d+)/);
      const maxMatch = error.message.match(/Maximum is (\d+)/);
      const actualSize = sizeMatch ? parseInt(sizeMatch[1]) : 0;
      const maxSize = maxMatch ? parseInt(maxMatch[1]) : 0;

      return {
        statusCode: 400,
        message: `File too large: ${(actualSize / (1024 * 1024)).toFixed(2)}MB. Maximum allowed is ${(maxSize / (1024 * 1024)).toFixed(2)}MB.`,
        data: null,
      };
    }

    // Handle unsupported file type errors
    if (error.message && error.message.includes("Unsupported")) {
      return {
        statusCode: 400,
        message: `Unsupported file type: ${error.message}`,
        data: null,
      };
    }

    return {
      statusCode: 500,
      message: error?.message || "File upload failed",
      data: null,
    };
  }

  /**
   * Return a time-limited signed Cloudinary URL for a given asset URL.
   * Use this for raw/authenticated assets (e.g. PDFs) that return 401 on direct access.
   * @summary Get signed URL for a Cloudinary asset
   */
  @Get("/sign")
  @Security("jwt")
  public async getSignedUrl(
    @Query() url: string,
  ): Promise<{ statusCode: number; signedUrl: string }> {
    const signedUrl = signCloudinaryUrl(url);
    return { statusCode: 200, signedUrl };
  }

  // ... keep the existing methods for image, document, etc. but update them to use generalUpload
  /**
   * Upload image file specifically (with image validation)
   * @summary Upload image file
   */
  @Post("/image")
  @Security("jwt")
  @Middlewares(
    generalUpload.single("image"),
    checkRole(
      roles.STAFF,
      roles.CHO,
      roles.TRAINER,
      roles.ADMIN,
      roles.TRAINEE,
    ),
  )
  public async uploadImage(
    @Request() req: ExpressRequest,
  ): Promise<FileUploadResponse> {
    try {
      if (!req.file) {
        return {
          statusCode: 400,
          message: "No image file provided",
          data: null,
        };
      }

      const file = req.file;

      // Check if it's an image
      if (!file.mimetype.startsWith("image/")) {
        return {
          statusCode: 400,
          message: "File must be an image",
          data: null,
        };
      }

      const result = await this.uploadToCloudinary(file);

      return {
        statusCode: 200,
        message: "Image uploaded successfully",
        data: result,
      };
    } catch (error: any) {
      console.error("❌ Image upload error:", error);
      return this.handleUploadError(error);
    }
  }

  /**
   * Upload audio file to Cloudinary
   * @summary Upload audio file
   */
  @Post("/audio")
  @Security("jwt")
  @Middlewares(
    generalUpload.single("audio"),
    checkRole(
      roles.STAFF,
      roles.CHO,
      roles.TRAINER,
      roles.ADMIN,
      roles.TRAINEE,
    ),
  )
  public async uploadAudio(
    @Request() req: ExpressRequest,
  ): Promise<FileUploadResponse> {
    try {
      if (!req.file) {
        return {
          statusCode: 400,
          message: "No audio file provided",
          data: null,
        };
      }

      const file = req.file;

      // Accept any audio MIME type
      if (
        !file.mimetype.startsWith("audio/") &&
        !["application/ogg"].includes(file.mimetype)
      ) {
        return {
          statusCode: 400,
          message: "File must be an audio file",
          data: null,
        };
      }

      const result = await this.uploadToCloudinary(file);

      return {
        statusCode: 200,
        message: "Audio uploaded successfully",
        data: result,
      };
    } catch (error: any) {
      console.error("❌ Audio upload error:", error);
      return this.handleUploadError(error);
    }
  }

  /**
   * Upload document file specifically (PDF, DOC, etc.)
   * @summary Upload document file
   */
  @Post("/document")
  @Security("jwt")
  @Middlewares(
    generalUpload.single("document"),
    checkRole(
      roles.STAFF,
      roles.CHO,
      roles.TRAINER,
      roles.ADMIN,
      roles.TRAINEE,
    ),
  )
  public async uploadDocument(
    @Request() req: ExpressRequest,
  ): Promise<FileUploadResponse> {
    try {
      if (!req.file) {
        return {
          statusCode: 400,
          message: "No document file provided",
          data: null,
        };
      }

      const file = req.file;

      // Check if it's a document
      const allowedDocTypes = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "text/plain",
        "text/csv",
      ];

      if (!allowedDocTypes.includes(file.mimetype)) {
        return {
          statusCode: 400,
          message: `File type not supported. Allowed types: PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, TXT, CSV. Received: ${file.mimetype}`,
          data: null,
        };
      }

      const result = await this.uploadToCloudinary(file);

      return {
        statusCode: 200,
        message: "Document uploaded successfully",
        data: result,
      };
    } catch (error: any) {
      console.error("❌ Document upload error:", error);
      return this.handleUploadError(error);
    }
  }
}
