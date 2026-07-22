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
import { FinalExamService } from "../services/finalExamService";
import { CreateFinalExamDto } from "../utils/interfaces/common";
import { loggerMiddleware } from "../utils/loggers/loggingMiddleware";
import { checkRole } from "../middlewares";
import { roles } from "../utils/roles";

@Route("/api/final-exams")
@Tags("FinalExams")
export class FinalExamController {
  @Post("/")
  @Security("jwt")
  @Middlewares(
    checkRole(roles.STAFF, roles.CEHO, roles.TRAINER, roles.ADMIN),
  )
  public async createFinalExam(@Body() body: CreateFinalExamDto) {
    return FinalExamService.createFinalExam(body);
  }

  @Get("/all")
  @Middlewares(loggerMiddleware)
  public getAllFinalExams(@Query() searchq?: string) {
    return FinalExamService.getAllFinalExams(searchq);
  }

  @Put("/{id}")
  @Security("jwt")
  @Middlewares(
    checkRole(roles.STAFF, roles.CEHO, roles.TRAINER, roles.ADMIN),
  )
  public updateFinalExam(@Path() id: string, @Body() body: CreateFinalExamDto) {
    return FinalExamService.updateFinalExam(id, body);
  }

  @Delete("/{id}")
  @Security("jwt")
  @Middlewares(
    checkRole(roles.STAFF, roles.CEHO, roles.TRAINER, roles.ADMIN),
  )
  public deleteFinalExam(@Path() id: string) {
    return FinalExamService.deleteFinalExam(id);
  }

  @Get("/")
  @Middlewares(loggerMiddleware)
  public getFinalExams(
    @Query() searchq?: string,
    @Query() limit?: number,
    @Query() page?: number,
  ) {
    return FinalExamService.getFinalExams(searchq, limit, page);
  }

  @Get("/{id}")
  @Middlewares(loggerMiddleware)
  public getFinalExam(@Path() id: string) {
    return FinalExamService.getFinalExamById(id);
  }
}
