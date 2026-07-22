import {
  Body,
  Delete,
  Get,
  Middlewares,
  Path,
  Post,
  Put,
  Query,
  Route,
  Tags,
  Security,
  Request,
} from "tsoa";
import { CreateFeedbackOnSlideDto } from "../utils/interfaces/common";
import { FeedbackOnSlideService } from "../services/feedbackOnSlideService";
import { loggerMiddleware } from "../utils/loggers/loggingMiddleware";
import { checkRole } from "../middlewares";
import { roles } from "../utils/roles";
import { Request as ExpressRequest } from "express";
import { appendPhoto } from "../middlewares";
import upload from "../utils/cloudinary";
import { FilterOptions } from "../utils/filterUtils";

@Route("/api/feedbacks")
@Tags("Feedbacks")
export class FeedbackOnSlideController {
  @Post("/")
  @Security("jwt")
  @Middlewares(
    checkRole(
      roles.STAFF,
      roles.CEHO,
      roles.TRAINER,
      roles.ADMIN,
      roles.TRAINEE,
    ),
    upload.any(),
    appendPhoto,
  )
  public async createFeedback(
    @Body() body: CreateFeedbackOnSlideDto,
    @Request() req: ExpressRequest,
  ) {
    const userId = req.user?.id as string;
    return FeedbackOnSlideService.createFeedback(body, userId);
  }

  @Get("/all")
  @Middlewares(loggerMiddleware)
  public async getAllFeedbacks(
    @Query() searchq?: string,
    @Query() district?: string,
    @Query() sector?: string,
    @Query() startDate?: string,
    @Query() endDate?: string,
  ) {
    const filters: FilterOptions = {
      searchq,
      district,
      sector,
      dateRange: startDate && endDate ? { startDate, endDate } : undefined,
    };
    return FeedbackOnSlideService.getAllFeedbacks(filters);
  }

  @Get("/")
  @Middlewares(loggerMiddleware)
  public async getFeedbacks(
    @Query() searchq?: string,
    @Query() district?: string,
    @Query() sector?: string,
    @Query() startDate?: string,
    @Query() endDate?: string,
    @Query() limit?: number,
    @Query() page?: number,
  ) {
    const filters: FilterOptions = {
      searchq,
      district,
      sector,
      dateRange: startDate && endDate ? { startDate, endDate } : undefined,
      limit,
      currentPage: page,
    };
    return FeedbackOnSlideService.getFeedbacks(filters);
  }

  @Get("/export")
  @Middlewares(loggerMiddleware)
  public async exportFeedbacks(
    @Request() req: ExpressRequest,
    @Query() searchq?: string,
    @Query() district?: string,
    @Query() sector?: string,
    @Query() startDate?: string,
    @Query() endDate?: string,
  ) {
    const filters: FilterOptions = {
      searchq,
      district,
      sector,
      dateRange: startDate && endDate ? { startDate, endDate } : undefined,
    };

    await FeedbackOnSlideService.exportFeedbacksToExcel(filters, req.res);
    return { message: "Excel export completed", statusCode: 200 };
  }

  @Get("/{id}")
  @Middlewares(loggerMiddleware)
  public async getFeedback(@Path() id: string) {
    return FeedbackOnSlideService.getFeedbackById(id);
  }

  @Put("/{id}")
  @Security("jwt")
  @Middlewares(
    checkRole(
      roles.STAFF,
      roles.CEHO,
      roles.TRAINER,
      roles.ADMIN,
      roles.TRAINEE,
    ),
  )
  public async updateFeedback(
    @Path() id: string,
    @Body() body: CreateFeedbackOnSlideDto,
  ) {
    return FeedbackOnSlideService.updateFeedback(id, body);
  }

  @Delete("/{id}")
  @Security("jwt")
  @Middlewares(
    checkRole(
      roles.STAFF,
      roles.CEHO,
      roles.TRAINER,
      roles.ADMIN,
      roles.TRAINEE,
    ),
  )
  public async deleteFeedback(@Path() id: string) {
    return FeedbackOnSlideService.deleteFeedback(id);
  }

  @Get("/by-course/{courseId}")
  @Security("jwt")
  @Middlewares(loggerMiddleware)
  public async getFeedbacksByCourse(
    @Path() courseId: string,
    @Request() req: ExpressRequest,
  ) {
    const currentUserId = req.user?.id as string;
    return FeedbackOnSlideService.getFeedbacksByCourse(courseId, currentUserId);
  }
}
