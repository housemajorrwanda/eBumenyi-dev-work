import { NextFunction, Request, Response, Router } from "express";
import { SlideReadAloudService, NarrationVoice } from "../services/slideReadAloudService";
import { SlideService } from "../services/slideService";
import { expressAuthentication } from "../utils/authentication";
import AppError from "../utils/error";
import { prisma } from "../utils/client";
import { checkRole } from "../middlewares";
import { roles } from "../utils/roles";
import { verifyToken } from "../utils/jwt";

const router = Router();

async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    await expressAuthentication(req, "jwt");
    next();
  } catch (error) {
    const status = error instanceof AppError ? error.status : 401;
    const message = error instanceof AppError ? error.message : "Unauthorized";
    res.status(status).json({ message });
  }
}

/** JWT signature, or allow hybrid dev when slide context is sent (apitest token). */
async function requireValidJwtOrDevContext(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const body = req.body as {
    file?: string | null;
    note?: string | null;
    description?: string | null;
  };
  const hasContext = Boolean(body?.file || body?.note || body?.description);

  try {
    let token = req.headers.authorization as string | undefined;
    if (token?.startsWith("Bearer ")) {
      token = token.split(" ")[1];
    }
    if (token) {
      await verifyToken(token);
      return next();
    }
  } catch {
    // fall through — apitest JWT may not match local JWT_SECRET
  }

  if (hasContext && process.env.NODE_ENV !== "production") {
    return next();
  }

  res.status(401).json({ message: "Unauthorized" });
}

function parsePage(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function parseVoice(value: unknown): NarrationVoice {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (raw === "female2" || raw === "male" || raw === "female1") {
    return raw;
  }
  return "female1";
}

router.post(
  "/:id/narrate",
  requireValidJwtOrDevContext,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parsePage(req.query.page);
      const body = req.body as {
        file?: string | null;
        note?: string | null;
        description?: string | null;
        voice?: string | null;
      };
      const voice = parseVoice(body?.voice ?? req.query.voice);
      const remoteContext =
        body?.file || body?.note || body?.description ? body : undefined;
      const result = await SlideReadAloudService.narrateSlide(
        req.params.id,
        page,
        remoteContext,
        voice,
      );
      res.status(200).json({
        message: "Narration ready",
        statusCode: 200,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/:id/readable-text",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const slide = await prisma.slide.findUnique({ where: { id: req.params.id } });
      if (!slide) {
        throw new AppError("Slide not found", 404);
      }

      const page = parsePage(req.query.page);
      const text = SlideReadAloudService.resolveReadableText(slide, page);

      res.status(200).json({
        message: "Readable text fetched",
        statusCode: 200,
        data: {
          text,
          page,
          ocrStatus: slide.ocrStatus,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/:id/extract-text",
  requireAuth,
  checkRole(roles.STAFF, roles.CHO, roles.TRAINER, roles.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await SlideService.getSlideById(req.params.id);
      SlideReadAloudService.queueTextExtraction(req.params.id);
      res.status(202).json({
        message: "Text extraction queued",
        statusCode: 202,
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
