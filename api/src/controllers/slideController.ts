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
} from "tsoa";
import { SlideService } from "../services/slideService";
import { CreateSlideDto } from "../utils/interfaces/common";
import { loggerMiddleware } from "../utils/loggers/loggingMiddleware";
import { appendFile, checkRole } from "../middlewares";
import { roles } from "../utils/roles";
import upload from "../utils/cloudinary";

@Route("/api/slides")
@Tags("Slides")
export class SlideController {
  @Post("/")
  @Security("jwt")
  @Middlewares(
    upload.single("file"),
    appendFile,
    checkRole(roles.STAFF, roles.CEHO, roles.TRAINER, roles.ADMIN),
  )
  public async createSlide(@Body() body: CreateSlideDto) {
    return SlideService.createSlide(body);
  }

  @Get("/all")
  @Middlewares(loggerMiddleware)
  public getAllSlides(@Query() searchq?: string) {
    return SlideService.getAllSlides(searchq);
  }

  @Put("/{id}")
  @Security("jwt")
  @Middlewares(
    checkRole(roles.STAFF, roles.CEHO, roles.TRAINER, roles.ADMIN),
  )
  public updateSlide(@Path() id: string, @Body() body: CreateSlideDto) {
    return SlideService.updateSlide(id, body);
  }

  @Delete("/{id}")
  @Security("jwt")
  @Middlewares(
    checkRole(roles.STAFF, roles.CEHO, roles.TRAINER, roles.ADMIN),
  )
  public deleteSlide(@Path() id: string) {
    return SlideService.deleteSlide(id);
  }

  @Get("/")
  @Middlewares(loggerMiddleware)
  public getSlides(
    @Query() searchq?: string,
    @Query() limit?: number,
    @Query() page?: number,
  ) {
    return SlideService.getSlides(searchq, limit, page);
  }

  @Get("/{id}")
  @Middlewares(loggerMiddleware)
  public getSlide(@Path() id: string) {
    return SlideService.getSlideById(id);
  }
}
