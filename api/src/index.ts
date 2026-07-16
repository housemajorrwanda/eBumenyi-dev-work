/* eslint-disable @typescript-eslint/no-explicit-any */
import "reflect-metadata";
import express, {
  json,
  urlencoded,
  Response as ExResponse,
  Request as ExRequest,
  NextFunction,
} from "express";
import path from "path";
// Explanation: This line intentionally causes an error because...
// @ts-ignore
import { RegisterRoutes } from "../build/routes";
import swaggerUi from "swagger-ui-express";
import cors from "cors";
import { TUser } from "./utils/interfaces/common";
import AppError, { ValidationError } from "./utils/error";
import { ValidateError } from "@tsoa/runtime";
import { NotificationService } from "./services/NotificationService";
import { UserService } from "./services/userService";
import { DashboardService } from "./services/dashboardService";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { SocketService } from "./services/socket.service";
import { ChatNamespaces } from "./services/socket.namespaces";
import { SocketLogger } from "./utils/socketLogger";
import { CacheWarmer } from "./utils/cacheWarmer";
import { CounterSyncCron } from "./services/counterSyncCron";
import { ReminderScheduler } from "./services/reminderScheduler";
import { WeltelBackfillService } from "./services/weltelBackfillService";
import cron from "node-cron";
import axios from "axios";
import DbdictionaryController from "./controllers/DbdictionaryController";
import monitoringRouter from "./controllers/monitoringController";
import slideNarrationRouter from "./routes/slideNarration.routes";
import {
  generateDatabaseDictionary,
  generateHTMLDictionary,
} from "./utils/dbDictionary";
import { connectWithRetry } from "./utils/db";
import { initializeRequestCache } from "./utils/requestCache";
declare module "express" {
  interface Request {
    user?: TUser;
  }
}

const app = express();
const PORT = process.env.PORT || 9000;

// Skip body parsing for upload routes to allow multipart/form-data to pass through
// Limits set to 10MB for JSON/form bodies (uploads handled separately via multipart)
app.use((req, res, next) => {
  if (req.path === "/api/upload/video/complete") {
    return urlencoded({ extended: true, limit: "1mb" })(req, res, next);
  }
  if (
    req.path.startsWith("/api/upload") ||
    req.path === "/api/hospitals/import"
  ) {
    return next();
  }
  urlencoded({ extended: true, limit: "10mb" })(req, res, next);
});

app.use((req, res, next) => {
  if (req.path === "/api/upload/video/complete") {
    return json({ limit: "1mb" })(req, res, next);
  }
  if (
    req.path.startsWith("/api/upload") ||
    req.path === "/api/hospitals/import"
  ) {
    return next();
  }
  json({ limit: "10mb" })(req, res, next);
});

// Set request timeout for long-running operations (10 minutes)
app.use((req, res, next) => {
  req.setTimeout(600000); // 10 minutes
  res.setTimeout(600000);
  next();
});

// Initialize request cache early to store expensive lookups during request lifecycle
app.use(initializeRequestCache);

app.use(
  cors({
    origin: [
      "https://chw-web.vercel.app",
      "https://www.ebumenyi.online",
      "https://dev.ebumenyi.online",
      "https://apitest.ebumenyi.online",
      "http://localhost:4173",
      "http://localhost:5173",
      "http://localhost:3000",
      "http://localhost:8081",
      "http://localhost:19006",
      "http://10.10.119.36",
      "http://10.10.119.36:3000",
      "http://10.10.119.36:9000",
      "http://10.104.251.146:3000",
      "http://10.104.251.146:5173",
      "http://197.243.110.153",
      "http://197.243.110.153:3000",
      "https://irucare-micro-service-api-production.up.railway.app",
      "https://meeting.ebumenyi.online",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
    ],
  }),
);

// Middleware to handle setting auth token cookie after login
app.use((req: ExRequest, res: ExResponse, next: NextFunction) => {
  // Intercept the res.json method to add cookie before sending response
  const originalJson = res.json.bind(res);
  res.json = function (body: any) {
    // Check if this is a signin response with a token
    if (
      (req.path === "/api/auth/signin/staff" ||
        req.path === "/api/auth/signin/student" ||
        req.path === "/api/auth/signin/student/id-phone") &&
      body?.data?.token &&
      req.method === "POST"
    ) {
      // Set the auth token as a cookie accessible to JavaScript
      // This allows cross-domain token sharing between subdomains
      const cookieOptions: any = {
        secure: true, // Always use secure for HTTPS (required for production)
        sameSite: "Lax",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: "/",
        httpOnly: false, // Allow JavaScript to access (required for reading in browser)
      };

      // Set domain for cross-subdomain access (e.g., .ebumenyi.online)
      // Only set domain in production or when explicitly configured
      if (process.env.COOKIE_DOMAIN) {
        cookieOptions.domain = process.env.COOKIE_DOMAIN;
      }

      res.cookie("accessToken", body.data.token, cookieOptions);
    }
    return originalJson(body);
  };
  next();
});

// Serve static files from uploads directory
// In Docker: UPLOAD_PATH=/app/uploads. In local dev: fallback to process.cwd()/uploads
app.use(
  "/uploads",
  express.static(
    process.env.UPLOAD_PATH || path.join(process.cwd(), "uploads"),
  ),
);

// MAIN API ROUTES

app.use("/docs", swaggerUi.serve, async (_req: ExRequest, res: ExResponse) => {
  return res.send(
    //@ts-ignore
    swaggerUi.generateHTML(await import("../build/swagger.json")),
  );
});

const server = createServer(app);

// Initialize Socket.IO in both modes
const io = new SocketIOServer(server, {
  cors: {
    origin: [
      "https://chw-web.vercel.app",
      "https://www.ebumenyi.online",
      "https://dev.ebumenyi.online",
      "https://apitest.ebumenyi.online",
      "http://localhost:4173",
      "http://localhost:5173",
      "http://localhost:3000",
      "http://localhost:8081",
      "http://localhost:19006",
      "http://10.10.119.36",
      "http://10.10.119.36:3000",
      "http://10.10.119.36:9000",
      "http://10.104.251.146:3000",
      "http://10.104.251.146:5173",
      "http://197.243.110.153",
      "http://197.243.110.153:3000",
      "https://irucare-micro-service-api-production.up.railway.app",
      "https://meeting.ebumenyi.online",
    ],
    methods: ["GET", "POST"],
    credentials: true,
  },
});
app.set("io", io);

// Initialize socket service and handlers
const socketService = new SocketService(io);
const chatNamespaces = new ChatNamespaces(io, socketService);

app.set("socketService", socketService);

// Setup the three chat namespaces: /direct, /group, /community
chatNamespaces.setupNamespaces();

// Socket.IO connection handling
console.log("\n" + "=".repeat(80));
console.log("🚀 SOCKET.IO SERVER INITIALIZED");
console.log("=".repeat(80) + "\n");

io.on("connection", async (socket) => {
  // Authentication already handled by SocketService middleware
  // socket.data.userId and socket.data.user are set by middleware
  const userId = socket.data.userId;
  const user = socket.data.user;

  if (!userId) {
    socket.disconnect();
    return;
  }

  try {
    // Log connection
    SocketLogger.logConnection(socket, userId, user);

    // Track connection
    socketService.trackUserConnection(userId, socket.id);

    // Join user's personal room
    socket.join(socketService.getUserRoom(userId));

    // Setup default event handlers (join, leave, typing)
    socketService.setupDefaultHandlers(socket);

    // Messaging and notification handlers are now in ChatNamespaces
    // (direct, group, community namespaces)

    // Allow clients to query current online status for a list of user IDs
    socket.on("user:get_status", (data: { userIds: string[] }) => {
      if (!Array.isArray(data?.userIds)) return;
      const statuses = data.userIds.map((uid) => ({
        userId: uid,
        isOnline: socketService.isUserOnline(uid),
        lastSeen: socketService.getUserLastSeen(uid)?.toISOString() ?? null,
      }));
      socket.emit("user:status_response", statuses);
    });

    // Emit connected event with user info
    socket.emit("connected", {
      message: "Socket connected!",
      userId: userId,
      email: user?.email,
      fullNames: user?.fullNames,
    });

    // Load and send initial notifications
    try {
      const notifications =
        await NotificationService.getUserNotifications(userId);
      socket.emit("notifications", notifications);
    } catch (error) {
      console.error("Error loading initial notifications:", error);
    }

    // Handle request for notifications (from context on reconnect)
    socket.on("get_notifications", async () => {
      try {
        const notifications =
          await NotificationService.getUserNotifications(userId);
        socket.emit("notifications", notifications);
      } catch (error) {
        console.error("Error loading notifications on request:", error);
      }
    });

    // Mark notification as read
    socket.on("mark_as_read", async (data) => {
      try {
        const { notificationId } = data;

        await NotificationService.markAsRead(notificationId, userId);
        socket.emit("notification_marked_read", { notificationId });

        const unreadCount = await NotificationService.getUnreadCount(userId);
        socket.emit("unread_count_updated", { unreadCount });
      } catch (error) {
        console.error("Error marking notification as read:", error);
        socket.emit("error", {
          message: "Failed to mark notification as read",
        });
      }
    });

    // Mark all notifications as read
    socket.on("mark_all_as_read", async () => {
      try {
        await NotificationService.markAllAsRead(userId);
        socket.emit("all_notifications_marked_read");
        socket.emit("unread_count_updated", { unreadCount: 0 });
      } catch (error) {
        console.error("Error marking all notifications as read:", error);
        socket.emit("error", {
          message: "Failed to mark all notifications as read",
        });
      }
    });

    // Delete notification
    socket.on("delete_notification", async (data) => {
      try {
        const { notificationId } = data;

        const deleted = await NotificationService.deleteNotification(
          notificationId,
          userId,
        );
        if (deleted) {
          socket.emit("notification_deleted", { notificationId });
          const unreadCount = await NotificationService.getUnreadCount(userId);
          socket.emit("unread_count_updated", { unreadCount });
        }
      } catch (error) {
        socket.emit("error", { message: "Failed to delete notification" });
      }
    });

    // Clear all notifications
    socket.on("clear_all_notifications", async () => {
      try {
        await NotificationService.clearAllNotifications(userId);
        socket.emit("all_notifications_cleared");
        socket.emit("unread_count_updated", { unreadCount: 0 });
      } catch (error) {
        console.error("Error clearing all notifications:", error);
        socket.emit("error", {
          message: "Failed to clear all notifications",
        });
      }
    });

    // Dashboard real-time events
    socket.on("request_dashboard_stats", async () => {
      try {
        await DashboardService.sendDashboardStatsToUser(io, userId);
      } catch (error) {
        console.error("Error handling dashboard stats request:", error);
        socket.emit("error", { message: "Failed to fetch dashboard stats" });
      }
    });

    socket.on("request_recent_activities", async () => {
      try {
        const { CourseService } = await import("./services/courseService");
        const stats = await CourseService.getDashboardStatistics();
        socket.emit("recent_activities", stats.data.recentActivities);
      } catch (error) {
        console.error("Error handling recent activities request:", error);
        socket.emit("error", {
          message: "Failed to fetch recent activities",
        });
      }
    });
  } catch (error) {
    console.error("Socket connection error:", error);
    socket.disconnect();
  }

  socket.on("disconnect", (reason) => {
    socketService.trackUserDisconnection(userId, socket.id, reason);
  });
});

// Initialize dashboard listeners
DashboardService.initializeDashboardListeners(io);

// Proxy Cloudinary assets through the API so the browser never hits Cloudinary directly.
// Strategy: try fetching the original res.cloudinary.com URL first (server-side, bypasses CORS/browser
// restrictions). If that returns non-200, fall back to the Admin API download URL which uses
// api_key + HMAC signature auth.
// IMPORTANT: must be registered BEFORE RegisterRoutes so TSOA doesn't intercept /api/upload/*
app.get(
  "/api/upload/proxy",
  async (req: ExRequest, res: ExResponse, next: NextFunction) => {
    const url = req.query.url as string;
    if (!url || !url.startsWith("https://res.cloudinary.com/")) {
      return res.status(400).json({ message: "Invalid or missing url param" });
    }

    const readableBody = async (
      stream: NodeJS.ReadableStream,
    ): Promise<string> => {
      const chunks: Buffer[] = [];
      return new Promise((resolve) => {
        stream.on("data", (c) =>
          chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)),
        );
        stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        stream.on("error", () => resolve("(stream error)"));
      });
    };

    // Determine the correct Content-Type to serve.
    // Cloudinary sometimes returns application/octet-stream for raw files,
    // which causes browsers to download rather than render inline.
    const isPdf = url.toLowerCase().includes(".pdf");
    const contentType = isPdf ? "application/pdf" : undefined;

    try {
      // Step 1: try original res.cloudinary.com URL directly (works if server-side is allowed)
      console.log("[PROXY] Fetching direct URL:", url);
      const directRes = await axios.get(url, {
        responseType: "stream",
        validateStatus: () => true,
      });
      console.log("[PROXY] Direct fetch status:", directRes.status);

      if (directRes.status === 200) {
        res.setHeader(
          "Content-Type",
          contentType ||
            String(
              directRes.headers["content-type"] ?? "application/octet-stream",
            ),
        );
        res.setHeader("Content-Disposition", "inline");
        (directRes.data as NodeJS.ReadableStream).pipe(res);
        return;
      }

      // Drain direct response stream before trying next approach
      await readableBody(directRes.data);

      // Step 2: fall back to Cloudinary Admin API download URL (api_key + signature).
      // Try all three resource types — PDFs uploaded with resource_type:"auto" may be
      // stored as "image" in Cloudinary even when the delivery URL shows "raw".
      const { getCloudinaryDownloadUrl } = await import("./utils/cloudinary");

      const urlResourceType = (url.match(/\/([^/]+)\/upload\//)?.[1] ??
        "raw") as "image" | "raw" | "video";
      const resourceTypesToTry: Array<"image" | "raw" | "video"> = [
        urlResourceType,
        ...(["raw", "image", "video"].filter(
          (t) => t !== urlResourceType,
        ) as Array<"image" | "raw" | "video">),
      ];

      let lastAdminStatus = 0;
      let lastErrorBody = "";
      let adminSucceeded = false;

      for (const resType of resourceTypesToTry) {
        const downloadUrl = getCloudinaryDownloadUrl(url, resType);
        console.log(
          `[PROXY] Trying Admin API resource_type=${resType}:`,
          downloadUrl,
        );
        const adminRes = await axios.get(downloadUrl, {
          responseType: "stream",
          validateStatus: () => true,
        });
        lastAdminStatus = adminRes.status;
        console.log(
          `[PROXY] Admin API status (resource_type=${resType}):`,
          adminRes.status,
        );

        if (adminRes.status === 200) {
          res.setHeader(
            "Content-Type",
            contentType ||
              String(
                adminRes.headers["content-type"] ?? "application/octet-stream",
              ),
          );
          res.setHeader("Content-Disposition", "inline");
          (adminRes.data as NodeJS.ReadableStream).pipe(res);
          adminSucceeded = true;
          break;
        }
        lastErrorBody = await readableBody(adminRes.data);
      }

      if (adminSucceeded) return;

      // All resource types failed
      console.error(
        "[PROXY] All Admin API attempts failed:",
        lastAdminStatus,
        lastErrorBody,
      );
      return res.status(lastAdminStatus || 502).json({
        message: "Failed to fetch file from Cloudinary",
        directStatus: directRes.status,
        adminStatus: lastAdminStatus,
        cloudinaryError: (() => {
          try {
            return JSON.parse(lastErrorBody);
          } catch {
            return lastErrorBody;
          }
        })(),
      });
    } catch (err: any) {
      console.error("[PROXY] Unexpected error:", err?.message);
      return res
        .status(500)
        .json({ message: "Proxy error: " + (err?.message ?? "unknown") });
    }
  },
);

// Quick: generate a signed Cloudinary URL for a given asset URL (bypasses account-level delivery restrictions)
// IMPORTANT: must be registered BEFORE RegisterRoutes so TSOA doesn't intercept /api/upload/*
app.get(
  "/api/upload/sign",
  async (req: ExRequest, res: ExResponse, next: NextFunction) => {
    try {
      const url = req.query.url as string;
      if (!url) {
        return res
          .status(400)
          .json({ statusCode: 400, message: "url query param is required" });
      }
      const { getCloudinaryDownloadUrl } = await import("./utils/cloudinary");
      const signedUrl = getCloudinaryDownloadUrl(url);
      return res.status(200).json({ statusCode: 200, signedUrl });
    } catch (err) {
      next(err);
    }
  },
);

// CHO CHW-candidate search (area-filtered, max 10)
app.get(
  "/api/cho-groups/mine/chw-candidates",
  async (req: ExRequest, res: ExResponse, next: NextFunction) => {
    try {
      const { expressAuthentication } = await import("./utils/authentication");
      await expressAuthentication(req, "jwt");
      const userId = req.user?.id as string;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const { CHOGroupService } = await import("./services/choGroupService");
      const search = req.query.search as string | undefined;
      const candidates = await CHOGroupService.searchCHWCandidates(
        userId,
        search,
      );
      return res.status(200).json({
        statusCode: 200,
        message: "Candidates retrieved successfully",
        data: candidates,
      });
    } catch (err) {
      next(err);
    }
  },
);

// Register main API routes
RegisterRoutes(app);
app.use("/api/slides", slideNarrationRouter);
app.use("/api", DbdictionaryController);
app.use("/api/monitoring", monitoringRouter);

// Quick: public endpoint to fetch user by phone without waiting for TSOA route generation
app.get(
  "/api/user/by-phone/:phoneNumber",
  async (req: ExRequest, res: ExResponse, next: NextFunction) => {
    try {
      const { phoneNumber } = req.params;
      const result = await UserService.getUserByPhone(phoneNumber);
      return res.status(result.statusCode ?? 200).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// Quick: course analytics endpoint without waiting for TSOA route generation
app.get(
  "/api/export/dashboard/course/analytics",
  async (req: ExRequest, res: ExResponse, next: NextFunction) => {
    try {
      const { district, province, gender, year, month, role } =
        req.query as Record<string, string>;
      const { CourseService } = await import("./services/courseService");
      const result = await CourseService.getCourseAnalytics({
        district,
        province,
        gender,
        year,
        month,
        role,
      });
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// Quick: student analytics endpoint without waiting for TSOA route generation
app.get(
  "/api/export/dashboard/student/analytics",
  async (req: ExRequest, res: ExResponse, next: NextFunction) => {
    try {
      const { district, province, gender, year, month, role } =
        req.query as Record<string, string>;
      const { CourseService } = await import("./services/courseService");
      const result = await CourseService.getStudentAnalytics({
        district,
        province,
        gender,
        year,
        month,
        role,
      });
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// Quick: course duration stats endpoint without waiting for TSOA route generation
app.get(
  "/api/export/dashboard/course-duration",
  async (req: ExRequest, res: ExResponse, next: NextFunction) => {
    try {
      const { district, province, gender, year, month, role } =
        req.query as Record<string, string>;
      const { CourseService } = await import("./services/courseService");
      const result = await CourseService.getCourseDurationStats({
        district,
        province,
        gender,
        year,
        month,
        role,
      });
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// Quick: export reviews endpoint without waiting for TSOA route generation
app.get(
  "/api/export/reviews",
  async (req: ExRequest, res: ExResponse, next: NextFunction) => {
    try {
      const { UnifiedExportService } =
        await import("./services/unifiedExportService");
      const {
        exportAll,
        includeFeedbacks,
        includeSystemReviews,
        includeCourseReviews,
        includeSectionReviews,
        includeChapterReviews,
        searchq,
        district,
        sector,
        startDate,
        endDate,
      } = req.query;

      const filters = {
        searchq: searchq as string,
        district: district as string,
        sector: sector as string,
        dateRange:
          startDate && endDate
            ? {
                startDate: startDate as string,
                endDate: endDate as string,
              }
            : undefined,
      };

      const exportOptions = {
        exportAll: exportAll === "true",
        includeFeedbacks: includeFeedbacks === "true",
        includeSystemReviews: includeSystemReviews === "true",
        includeCourseReviews: includeCourseReviews === "true",
        includeSectionReviews: includeSectionReviews === "true",
        includeChapterReviews: includeChapterReviews === "true",
      };

      const hasSelection =
        exportOptions.exportAll ||
        exportOptions.includeFeedbacks ||
        exportOptions.includeSystemReviews ||
        exportOptions.includeCourseReviews ||
        exportOptions.includeSectionReviews ||
        exportOptions.includeChapterReviews;

      if (!hasSelection) {
        return res
          .status(400)
          .json({ error: "Please select at least one type to export" });
      }

      try {
        return await UnifiedExportService.exportSelectedReviews(
          exportOptions,
          filters,
          res,
        );
      } catch (error) {
        if (
          error instanceof Error &&
          error.message ===
            "No data found for the selected export options with current filters"
        ) {
          return res.status(404).json({
            success: false,
            error: "No data found",
            message:
              "No data found for the selected export options with current filters. Please adjust your filters or selection criteria.",
          });
        }
        throw error;
      }
    } catch (err) {
      next(err);
    }
  },
);

// Quick: export summary endpoint without waiting for TSOA route generation
app.get(
  "/api/export/summary",
  async (req: ExRequest, res: ExResponse, next: NextFunction) => {
    try {
      const { UnifiedExportService } =
        await import("./services/unifiedExportService");
      const {
        exportAll,
        includeFeedbacks,
        includeSystemReviews,
        includeCourseReviews,
        includeSectionReviews,
        includeChapterReviews,
        searchq,
        district,
        sector,
        startDate,
        endDate,
      } = req.query;

      const filters = {
        searchq: searchq as string,
        district: district as string,
        sector: sector as string,
        dateRange:
          startDate && endDate
            ? {
                startDate: startDate as string,
                endDate: endDate as string,
              }
            : undefined,
      };

      const exportOptions = {
        exportAll: exportAll === "true",
        includeFeedbacks: includeFeedbacks === "true",
        includeSystemReviews: includeSystemReviews === "true",
        includeCourseReviews: includeCourseReviews === "true",
        includeSectionReviews: includeSectionReviews === "true",
        includeChapterReviews: includeChapterReviews === "true",
      };

      const result = await UnifiedExportService.getUnifiedExportSummary(
        exportOptions,
        filters,
      );
      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  },
);

// Quick: CHW dashboard KPI stats
app.get(
  "/api/export/dashboard/chw-stats",
  async (req: ExRequest, res: ExResponse, next: NextFunction) => {
    try {
      const { district, province, gender, year, month, role } =
        req.query as Record<string, string | undefined>;
      const filters = { district, province, gender, year, month, role };
      const { CourseService } = await import("./services/courseService");
      const result = await CourseService.getCHWDashboardStats(filters);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);

app.get(
  "/api/export/dashboard/recent-activity",
  async (req: ExRequest, res: ExResponse, next: NextFunction) => {
    try {
      const { district, province, gender, year, month, role } =
        req.query as Record<string, string | undefined>;
      const filters = { district, province, gender, year, month, role };
      const { CourseService } = await import("./services/courseService");
      const result = await CourseService.getRecentActivityFeed(filters);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);

app.get(
  "/api/export/dashboard/demographics/analytics",
  async (req: ExRequest, res: ExResponse, next: NextFunction) => {
    try {
      const { district, province, gender, year, month, role } =
        req.query as Record<string, string | undefined>;
      const filters = { district, province, gender, year, month, role };
      const { CourseService } = await import("./services/courseService");
      const result = await CourseService.getDemographicsAnalytics(filters);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);

app.get(
  "/api/export/dashboard/test-score/analytics",
  async (req: ExRequest, res: ExResponse, next: NextFunction) => {
    try {
      const { district, province, gender, year, month, role } =
        req.query as Record<string, string | undefined>;
      const filters = { district, province, gender, year, month, role };
      const { CourseService } = await import("./services/courseService");
      const result = await CourseService.getTestScoreAnalytics(filters);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);

app.get(
  "/api/export/dashboard/communications/analytics",
  async (req: ExRequest, res: ExResponse, next: NextFunction) => {
    try {
      const { district, province, gender, year, month, role } =
        req.query as Record<string, string | undefined>;
      const filters = { district, province, gender, year, month, role };
      const { CourseService } = await import("./services/courseService");
      const result = await CourseService.getCommunicationsAnalytics(filters);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);

app.get("/health", (_req: ExRequest, res: ExResponse) => {
  res.status(200).json({ status: "ok", time: new Date().toISOString() });
});

// Serve database dictionary UI at root
app.get("/", async (_req: ExRequest, res: ExResponse) => {
  try {
    const dictionary = await generateDatabaseDictionary();
    res.setHeader("Content-Type", "text/html");
    res.send(generateHTMLDictionary(dictionary));
  } catch (error) {
    res.status(500).send("Failed to generate database dictionary UI");
  }
});

// Schedule health check every 10 minutes
cron.schedule("*/10 * * * *", async () => {
  try {
    const url = process.env.HEALTH_URL || `http://localhost:${PORT}/health`;
    const response = await axios.get(url);
    console.log(`[HEALTH CHECK] Success:`, response.data);
  } catch (error: unknown) {
    let responseData;
    let message;
    if (typeof error === "object" && error !== null) {
      if (
        "response" in error &&
        error.response &&
        typeof error.response === "object" &&
        "data" in error.response
      ) {
        responseData = (error.response as { data?: unknown }).data;
      }
      if ("message" in error && typeof error.message === "string") {
        message = error.message;
      }
    }
    console.error("[HEALTH CHECK] Failed:", responseData || message || error);
  }
});

// Schedule cache warming every 6 hours
cron.schedule("0 */6 * * *", async () => {
  console.log("\n[CACHE WARMER] Running scheduled cache warm-up...");
  try {
    await CacheWarmer.warmCache();
  } catch (error) {
    console.error("[CACHE WARMER] Failed to warm cache:", error);
  }
});

app.use(function errorHandler(
  err: unknown,
  req: ExRequest,
  res: ExResponse,
  next: NextFunction,
): ExResponse | void {
  console.log(err);
  if (err instanceof AppError) {
    return res.status(err.status).json({
      status: err.status,
      message: err.message,
    });
  }

  // TSOA request-body validation error — return 400 with field details
  if (err instanceof ValidateError) {
    return res.status(400).json({
      status: 400,
      message: "Validation failed",
      fields: err.fields,
    });
  }
  if (err instanceof ValidationError) {
    return res
      .status(400)
      .json({ error: "validate", data: JSON.parse(err.message) });
  }
  if (err instanceof Error) {
    return res.status(500).json({
      message: err.message || "Internal server error",
      status: 500,
    });
  }
  next();
});

async function bootstrap() {
  try {
    // Connect to database
    await connectWithRetry();

    // Warm up cache with recent messages
    console.log("");
    await CacheWarmer.warmCache();

    // Initialize counter sync cron jobs
    CounterSyncCron.initializeCrons();

    // Initialize calendar reminder scheduler
    ReminderScheduler.start(io);

    // Link users missing weltelUserId (daily 06:00 Africa/Kigali)
    WeltelBackfillService.initializeCron();
    // initializeOnStartup removed — cron handles all delivery every minute.
    // Calling it caused duplicate notifications on server restart.

    server.listen(PORT, () => {
      console.log(`API running on PORT http://localhost:${PORT}!`);
    });
  } catch (error) {
    console.error("❌ Failed to start application:", error);
    process.exit(1);
  }
}

bootstrap();

process.on("SIGINT", async () => {
  const { prisma } = await import("./utils/db");
  await prisma.$disconnect();
  process.exit(0);
});
