import { Body, Post, Route, Tags, Security, Middlewares, Request } from "tsoa";
import { Request as ExpressRequest } from "express";
import { prisma } from "../utils/client";
import { chatWithTools } from "../services/chatService";
import { loggerMiddleware } from "../utils/loggers/loggingMiddleware";

const STAFF_ROLES = ["ADMIN", "STAFF", "CEHO", "TRAINER"];

async function chatContext(
  req: ExpressRequest,
): Promise<{ studentId: string | null; isStaff: boolean }> {
  const user = req.user;
  if (!user?.id) throw new Error("Unauthorized");
  let studentId: string | null = user.student?.id ?? null;
  if (!studentId) {
    const s = await prisma.student.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    studentId = s?.id ?? null;
  }
  const isStaff = (user.userRoles ?? []).some((r) =>
    STAFF_ROLES.includes(r.name),
  );
  return { studentId, isStaff };
}

@Route("/api/chat")
@Tags("Chat")
@Security("jwt")
export class ChatController {
  @Post("/")
  @Middlewares(loggerMiddleware)
  public async post(
    @Request() req: ExpressRequest,
    @Body()
    body: {
      message: string;
      history?: Array<{ role: string; content?: string }>;
    },
  ) {
    const ctx = await chatContext(req);
    const reply = await chatWithTools(body.message, body.history ?? [], ctx);
    return { reply };
  }
}
