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
import { ChapterService } from "../services/chapterService";
import { CreateChapterDto } from "../utils/interfaces/common";
import { loggerMiddleware } from "../utils/loggers/loggingMiddleware";
import { checkRole } from "../middlewares";
import { roles } from "../utils/roles";

@Route("/api/chapters")
@Tags("Chapters")
export class ChapterController {
  @Post("/")
  @Security("jwt")
  @Middlewares(
    loggerMiddleware,
    checkRole(roles.ADMIN, roles.STAFF, roles.CEHO, roles.TRAINER),
  )
  public async createChapter(@Body() body: CreateChapterDto) {
    return ChapterService.createChapter(body);
  }

  @Get("/all")
  @Middlewares(loggerMiddleware)
  public getAllChapters(@Query() searchq?: string) {
    return ChapterService.getAllChapters(searchq);
  }

  @Put("/{id}")
  @Security("jwt")
  @Middlewares(
    loggerMiddleware,
    checkRole(roles.ADMIN, roles.STAFF, roles.CEHO, roles.TRAINER),
  )
  public updateChapter(@Path() id: string, @Body() body: CreateChapterDto) {
    return ChapterService.updateChapter(id, body);
  }

  @Delete("/{id}")
  @Security("jwt")
  @Middlewares(
    loggerMiddleware,
    checkRole(roles.ADMIN, roles.STAFF, roles.CEHO, roles.TRAINER),
  )
  public deleteChapter(@Path() id: string) {
    return ChapterService.deleteChapter(id);
  }

  @Get("/")
  @Middlewares(loggerMiddleware)
  public getChapters(
    @Query() searchq?: string,
    @Query() limit?: number,
    @Query() page?: number,
  ) {
    return ChapterService.getChapters(searchq, limit, page);
  }

  @Get("/{id}")
  @Middlewares(loggerMiddleware)
  public getChapter(@Path() id: string) {
    return ChapterService.getChapterById(id);
  }
}
