import { Body, Post, Request, Route, Security, Tags, Middlewares } from "tsoa";
import { Request as ExpressRequest } from "express";
import { ActivityService } from "../services/activityService";
import { loggerMiddleware } from "../utils/loggers/loggingMiddleware";

interface HeartbeatDto {
  courseId?: string;
}

@Route("/api/activity")
@Tags("Activity")
export class ActivityController {
  @Post("/heartbeat")
  @Security("jwt")
  @Middlewares(loggerMiddleware)
  public async heartbeat(
    @Request() req: ExpressRequest,
    @Body() body: HeartbeatDto,
  ) {
    const userId = req.user?.id as string | undefined;
    if (!userId) return { message: "ok", statusCode: 200 };

    await ActivityService.heartbeat(userId, body.courseId);
    return { message: "ok", statusCode: 200 };
  }
}
