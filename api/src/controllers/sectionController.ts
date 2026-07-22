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
import { SectionService } from "../services/sectionService";
import { CreateSectionDto } from "../utils/interfaces/common";
import { loggerMiddleware } from "../utils/loggers/loggingMiddleware";
import { checkRole } from "../middlewares";
import { roles } from "../utils/roles";

@Route("/api/sections")
@Tags("Sections")
export class SectionController {
  @Post("/")
  @Security("jwt")
  @Middlewares(
    checkRole(roles.STAFF, roles.CEHO, roles.TRAINER, roles.ADMIN),
  )
  public async createSection(@Body() body: CreateSectionDto) {
    return SectionService.createSection(body);
  }

  @Get("/all")
  @Middlewares(loggerMiddleware)
  public getAllSections(@Query() searchq?: string) {
    return SectionService.getAllSections(searchq);
  }

  @Put("/{id}")
  @Security("jwt")
  @Middlewares(
    checkRole(roles.STAFF, roles.CEHO, roles.TRAINER, roles.ADMIN),
  )
  public updateSection(@Path() id: string, @Body() body: CreateSectionDto) {
    return SectionService.updateSection(id, body);
  }

  @Delete("/{id}")
  @Security("jwt")
  @Middlewares(
    checkRole(roles.STAFF, roles.CEHO, roles.TRAINER, roles.ADMIN),
  )
  public deleteSection(@Path() id: string) {
    return SectionService.deleteSection(id);
  }

  @Get("/")
  @Middlewares(loggerMiddleware)
  public getSections(
    @Query() searchq?: string,
    @Query() limit?: number,
    @Query() page?: number,
  ) {
    return SectionService.getSections(searchq, limit, page);
  }

  @Get("/{id}")
  @Middlewares(loggerMiddleware)
  public getSection(@Path() id: string) {
    return SectionService.getSectionById(id);
  }
}
