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
import { AnswerService } from "../services/answerService";
import { CreateAnswerDto } from "../utils/interfaces/common";
import { loggerMiddleware } from "../utils/loggers/loggingMiddleware";
import { appendImage, checkRole } from "../middlewares";
import { roles } from "../utils/roles";
import upload from "../utils/cloudinary";

@Route("/api/answers")
@Tags("Answers")
export class AnswerController {
  @Post("/")
  @Security("jwt")
  @Middlewares(
    upload.single("image"),
    appendImage,
    checkRole(roles.STAFF, roles.CEHO, roles.TRAINER, roles.ADMIN),
  )
  public async createAnswer(@Body() body: CreateAnswerDto) {
    return AnswerService.createAnswer(body);
  }

  @Get("/all")
  @Middlewares(loggerMiddleware)
  public getAllAnswers(@Query() searchq?: string) {
    return AnswerService.getAllAnswers(searchq);
  }

  @Put("/{id}")
  @Security("jwt")
  @Middlewares(
    checkRole(roles.STAFF, roles.CEHO, roles.TRAINER, roles.ADMIN),
  )
  public updateAnswer(@Path() id: string, @Body() body: CreateAnswerDto) {
    return AnswerService.updateAnswer(id, body);
  }

  @Delete("/{id}")
  @Security("jwt")
  @Middlewares(
    checkRole(roles.STAFF, roles.CEHO, roles.TRAINER, roles.ADMIN),
  )
  public deleteAnswer(@Path() id: string) {
    return AnswerService.deleteAnswer(id);
  }

  @Get("/")
  @Middlewares(loggerMiddleware)
  public getAnswers(
    @Query() searchq?: string,
    @Query() limit?: number,
    @Query() page?: number,
  ) {
    return AnswerService.getAnswers(searchq, limit, page);
  }

  @Get("/{id}")
  @Middlewares(loggerMiddleware)
  public getAnswer(@Path() id: string) {
    return AnswerService.getAnswerById(id);
  }
}
