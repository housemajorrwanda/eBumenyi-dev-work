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
import { CreateFAQOnSlideDto } from "../utils/interfaces/common";
import { FAQOnSlideService } from "../services/faqOnSlideService";
import { loggerMiddleware } from "../utils/loggers/loggingMiddleware";
import { checkRole } from "../middlewares";
import { roles } from "../utils/roles";
import { Request as ExpressRequest } from "express";
import { appendPhoto } from "../middlewares";
import upload from "../utils/cloudinary";

@Route("/api/faqs")
@Tags("FAQs")
export class FAQOnSlideController {
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
  public async createFAQ(
    @Body() body: CreateFAQOnSlideDto,
    @Request() req: ExpressRequest,
  ) {
    const userId = req.user?.id as string;
    return FAQOnSlideService.createFAQ(body, userId);
  }

  @Get("/all")
  @Middlewares(loggerMiddleware)
  public async getAllFAQs(@Query() searchq?: string) {
    return FAQOnSlideService.getAllFAQs(searchq);
  }

  @Get("/")
  @Middlewares(loggerMiddleware)
  public async getFAQs(
    @Query() searchq?: string,
    @Query() limit?: number,
    @Query() page?: number,
  ) {
    return FAQOnSlideService.getFAQs(searchq, limit, page);
  }

  @Get("/{id}")
  @Middlewares(loggerMiddleware)
  public async getFAQ(@Path() id: string) {
    return FAQOnSlideService.getFAQById(id);
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
  public async updateFAQ(
    @Path() id: string,
    @Body() body: CreateFAQOnSlideDto,
  ) {
    return FAQOnSlideService.updateFAQ(id, body);
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
  public async deleteFAQ(@Path() id: string) {
    return FAQOnSlideService.deleteFAQ(id);
  }

  @Get("/by-course/{courseId}")
  @Security("jwt")
  @Middlewares(loggerMiddleware)
  public async getFAQsByCourse(
    @Path() courseId: string,
    @Request() req: ExpressRequest,
  ) {
    const currentUserId = req.user?.id as string;
    return FAQOnSlideService.getFAQsByCourse(courseId, currentUserId);
  }
}
