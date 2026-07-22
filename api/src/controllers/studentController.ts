import {
  Get,
  Path,
  Query,
  Route,
  Tags,
  Middlewares,
  Security,
  Put,
  Body,
} from "tsoa";
import { StudentService } from "../services/studentService";
import { ProgressService } from "../services/progressService";
import { loggerMiddleware } from "../utils/loggers/loggingMiddleware";
import { checkRole } from "../middlewares";
import { roles } from "../utils/roles";
import type { CreateUserDto } from "../utils/interfaces/common";

@Route("/api/students")
@Tags("Students")
export class StudentController {
  @Get("/")
  @Security("jwt")
  @Middlewares(
    loggerMiddleware,
    checkRole(
      roles.ADMIN,
      roles.STAFF,
      roles.CEHO,
      roles.TRAINER,
      roles.DEVELOPER,
    ),
  )
  public getStudentsWithProgress(
    @Query() searchq?: string,
    @Query() limit?: number,
    @Query() page?: number,
    @Query() status?: string,
    @Query() sortBy?: string,
    @Query() order?: "asc" | "desc",
    @Query() gender?: string,
    @Query() courseId?: string,
    @Query() role?: string,
    @Query() noGroup?: boolean,
  ) {
    return StudentService.getStudentsWithProgress(
      searchq,
      limit,
      page,
      status,
      sortBy,
      order,
      gender,
      courseId,
      role,
      noGroup,
    );
  }

  @Get("/all")
  @Security("jwt")
  @Middlewares(
    loggerMiddleware,
    checkRole(roles.ADMIN, roles.STAFF, roles.CEHO, roles.TRAINER),
  )
  public getAllStudentsWithProgress(
    @Query() searchq?: string,
    @Query() status?: string,
    @Query() role?: string,
    @Query() limit?: number,
    @Query() noGroup?: boolean,
  ) {
    return StudentService.getAllStudentsWithProgress(searchq, status, role, limit, noGroup);
  }

  @Get("/{studentId}")
  @Security("jwt")
  @Middlewares(
    loggerMiddleware,
    checkRole(roles.ADMIN, roles.STAFF, roles.CEHO, roles.TRAINER),
  )
  public getStudentWithProgressById(@Path() studentId: string) {
    return StudentService.getStudentWithProgressById(studentId);
  }

  @Get("/statistics/summary")
  @Security("jwt")
  @Middlewares(
    loggerMiddleware,
    checkRole(
      roles.ADMIN,
      roles.STAFF,
      roles.CEHO,
      roles.TRAINER,
      roles.DEVELOPER,
    ),
  )
  public getStudentStatisticsSummary(@Query() role?: string) {
    return StudentService.getStudentStatisticsSummary(role);
  }

  @Put("/{studentId}/status")
  @Security("jwt")
  @Middlewares(
    loggerMiddleware,
    checkRole(roles.ADMIN, roles.STAFF, roles.CEHO, roles.TRAINER),
  )
  public updateStudentStatus(
    @Path() studentId: string,
    @Body() body: { status: string },
  ) {
    return StudentService.updateStudentStatus(studentId, body.status);
  }

  @Put("/{studentId}")
  @Security("jwt")
  @Middlewares(
    loggerMiddleware,
    checkRole(roles.ADMIN, roles.STAFF, roles.CEHO, roles.TRAINER),
  )
  public updateStudentInfo(
    @Path() studentId: string,
    @Body() body: CreateUserDto & { role?: string },
  ) {
    return StudentService.updateStudentInfo(studentId, body);
  }

  @Get("/by-course/{courseId}")
  @Security("jwt")
  @Middlewares(
    loggerMiddleware,
    checkRole(
      roles.ADMIN,
      roles.STAFF,
      roles.CEHO,
      roles.TRAINER,
      roles.TRAINEE,
    ),
  )
  public async getStudentsByCourse(@Path() courseId: string) {
    return StudentService.getStudentsByCourse(courseId);
  }

  @Get("/{studentId}/course/{courseId}/recommendations")
  @Security("jwt")
  @Middlewares(
    loggerMiddleware,
    checkRole(
      roles.ADMIN,
      roles.STAFF,
      roles.CEHO,
      roles.TRAINER,
      roles.DEVELOPER,
    ),
  )
  public async getPostCourseRecommendationsForStudent(
    @Path() studentId: string,
    @Path() courseId: string,
  ) {
    return ProgressService.getPostCourseRecommendations(studentId, courseId);
  }
}
