import { Get, Post, Route, Security, Tags, Request, Body, Middlewares, SuccessResponse } from "tsoa";
import { Request as ExpressRequest } from "express";
import { OnboardingService } from "../services/onboardingService";
import { CompleteTourDto, OnboardingStatusResponse } from "../utils/interfaces/common";
import { loggerMiddleware } from "../utils/loggers/loggingMiddleware";
import AppError from "../utils/error";

@Route("/api/onboarding")
@Tags("Onboarding")
export class OnboardingController {
  private ensureUserId(req: ExpressRequest): string {
    const userId = req.user?.id;
    if (!userId) throw new AppError("User not authenticated", 401);
    return userId;
  }

  @Get("/")
  @Security("jwt")
  @Middlewares(loggerMiddleware)
  public async getCompletedTours(
    @Request() req: ExpressRequest,
  ): Promise<{ statusCode: number; message: string; data: OnboardingStatusResponse }> {
    const userId = this.ensureUserId(req);
    const completedTours = await OnboardingService.getCompletedTours(userId);
    return {
      statusCode: 200,
      message: "Onboarding status retrieved successfully",
      data: { completedTours },
    };
  }

  @Post("/complete")
  @Security("jwt")
  @Middlewares(loggerMiddleware)
  @SuccessResponse(201, "Tour completed")
  public async completeTour(
    @Request() req: ExpressRequest,
    @Body() body: CompleteTourDto,
  ): Promise<{ statusCode: number; message: string }> {
    const userId = this.ensureUserId(req);
    if (!body.tourKey || typeof body.tourKey !== "string") {
      throw new AppError("tourKey is required", 400);
    }
    await OnboardingService.completeTour(userId, body.tourKey.trim());
    return { statusCode: 201, message: "Tour marked as completed" };
  }
}
