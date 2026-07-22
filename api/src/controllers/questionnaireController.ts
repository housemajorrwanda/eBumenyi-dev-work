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
import { QuestionnaireService } from "../services/questionnaireService";
import { CreateQuestionnaireDto } from "../utils/interfaces/common";
import { loggerMiddleware } from "../utils/loggers/loggingMiddleware";
import { appendQuestionImage, checkRole } from "../middlewares";
import { roles } from "../utils/roles";
import upload from "../utils/cloudinary";

@Route("/api/questionnaires")
@Tags("Questionnaires")
export class QuestionnaireController {
  @Post("/")
  @Security("jwt")
  @Middlewares(
    upload.single("questionImage"),
    appendQuestionImage,
    checkRole(roles.STAFF, roles.CEHO, roles.TRAINER, roles.ADMIN),
  )
  public async createQuestionnaire(@Body() body: CreateQuestionnaireDto) {
    return QuestionnaireService.createQuestionnaire(body);
  }

  @Get("/all")
  @Middlewares(loggerMiddleware)
  public getAllQuestionnaires(@Query() searchq?: string) {
    return QuestionnaireService.getAllQuestionnaires(searchq);
  }

  @Put("/{id}")
  @Security("jwt")
  @Middlewares(
    checkRole(roles.STAFF, roles.CEHO, roles.TRAINER, roles.ADMIN),
  )
  public updateQuestionnaire(
    @Path() id: string,
    @Body() body: CreateQuestionnaireDto,
  ) {
    return QuestionnaireService.updateQuestionnaire(id, body);
  }

  @Delete("/{id}")
  @Security("jwt")
  @Middlewares(
    checkRole(roles.STAFF, roles.CEHO, roles.TRAINER, roles.ADMIN),
  )
  public deleteQuestionnaire(@Path() id: string) {
    return QuestionnaireService.deleteQuestionnaire(id);
  }

  @Get("/")
  @Middlewares(loggerMiddleware)
  public getQuestionnaires(
    @Query() searchq?: string,
    @Query() limit?: number,
    @Query() page?: number,
  ) {
    return QuestionnaireService.getQuestionnaires(searchq, limit, page);
  }

  @Get("/{id}")
  @Middlewares(loggerMiddleware)
  public getQuestionnaire(@Path() id: string) {
    return QuestionnaireService.getQuestionnaireById(id);
  }
}
