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
import { CreateStudentOnSlideDto } from "../utils/interfaces/common";
import { StudentOnSlideService } from "../services/studentOnSlideService";
import { loggerMiddleware } from "../utils/loggers/loggingMiddleware";
import { checkRole } from "../middlewares";
import { roles } from "../utils/roles";

@Route("/api/student-on-slides")
@Tags("StudentOnSlides")
export class StudentOnSlideController {
  @Post("/")
  @Security("jwt")
  @Middlewares(
    checkRole(roles.STAFF, roles.CEHO, roles.TRAINER, roles.ADMIN),
  )
  public async createStudentOnSlide(@Body() body: CreateStudentOnSlideDto) {
    return StudentOnSlideService.createStudentOnSlide(body);
  }

  @Get("/all")
  @Middlewares(loggerMiddleware)
  public async getAllStudentOnSlides(@Query() searchq?: string) {
    return StudentOnSlideService.getAllStudentOnSlides(searchq);
  }

  @Get("/")
  @Middlewares(loggerMiddleware)
  public async getStudentOnSlides(
    @Query() searchq?: string,
    @Query() limit?: number,
    @Query() page?: number,
  ) {
    return StudentOnSlideService.getStudentOnSlides(searchq, limit, page);
  }

  @Get("/{id}")
  @Middlewares(loggerMiddleware)
  public async getStudentOnSlide(@Path() id: string) {
    return StudentOnSlideService.getStudentOnSlideById(id);
  }

  @Put("/{id}")
  @Security("jwt")
  @Middlewares(
    checkRole(roles.STAFF, roles.CEHO, roles.TRAINER, roles.ADMIN),
  )
  public async updateStudentOnSlide(
    @Path() id: string,
    @Body() body: CreateStudentOnSlideDto,
  ) {
    return StudentOnSlideService.updateStudentOnSlide(id, body);
  }

  @Delete("/{id}")
  @Security("jwt")
  @Middlewares(
    checkRole(roles.STAFF, roles.CEHO, roles.TRAINER, roles.ADMIN),
  )
  public async deleteStudentOnSlide(@Path() id: string) {
    return StudentOnSlideService.deleteStudentOnSlide(id);
  }

  @Get("/slide/{slideId}/completed-students")
  @Middlewares(loggerMiddleware)
  public async getCompletedStudents(@Path() slideId: string) {
    return StudentOnSlideService.getStudentsOnSlideWithCompletedProgress(
      slideId,
    );
  }
}
