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
import { CourseIntroService } from "../services/courseIntroService";
import { CreateCourseIntroDto } from "../utils/interfaces/common";
import { loggerMiddleware } from "../utils/loggers/loggingMiddleware";
import { checkRole } from "../middlewares";
import { roles } from "../utils/roles";

@Route("/api/course-intros")
@Tags("CourseIntros")
export class CourseIntroController {
  @Post("/")
  @Security("jwt")
  @Middlewares(
    checkRole(roles.STAFF, roles.CEHO, roles.TRAINER, roles.ADMIN),
  )
  public async createCourseIntro(@Body() body: CreateCourseIntroDto) {
    return CourseIntroService.createCourseIntro(body);
  }

  @Get("/all")
  @Middlewares(loggerMiddleware)
  public getAllCourseIntros(@Query() searchq?: string) {
    return CourseIntroService.getAllCourseIntros(searchq);
  }

  @Put("/{id}")
  @Security("jwt")
  @Middlewares(
    checkRole(roles.STAFF, roles.CEHO, roles.TRAINER, roles.ADMIN),
  )
  public updateCourseIntro(
    @Path() id: string,
    @Body() body: CreateCourseIntroDto,
  ) {
    return CourseIntroService.updateCourseIntro(id, body);
  }

  @Delete("/{id}")
  @Security("jwt")
  @Middlewares(
    checkRole(roles.STAFF, roles.CEHO, roles.TRAINER, roles.ADMIN),
  )
  public deleteCourseIntro(@Path() id: string) {
    return CourseIntroService.deleteCourseIntro(id);
  }

  @Get("/")
  @Middlewares(loggerMiddleware)
  public getCourseIntros(
    @Query() searchq?: string,
    @Query() limit?: number,
    @Query() page?: number,
  ) {
    return CourseIntroService.getCourseIntros(searchq, limit, page);
  }

  @Get("/{id}")
  @Middlewares(loggerMiddleware)
  public getCourseIntro(@Path() id: string) {
    return CourseIntroService.getCourseIntroById(id);
  }
}
