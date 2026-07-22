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
import { OptionService } from "../services/optionService";
import { CreateOptionDto } from "../utils/interfaces/common";
import { loggerMiddleware } from "../utils/loggers/loggingMiddleware";
import { appendImage, checkRole } from "../middlewares";
import { roles } from "../utils/roles";
import upload from "../utils/cloudinary";

@Route("/api/options")
@Tags("Options")
export class OptionController {
  @Post("/")
  @Security("jwt")
  @Middlewares(
    upload.single("image"),
    appendImage,
    checkRole(roles.STAFF, roles.CEHO, roles.TRAINER, roles.ADMIN),
  )
  public async createOption(@Body() body: CreateOptionDto) {
    return OptionService.createOption(body);
  }

  @Get("/all")
  @Middlewares(loggerMiddleware)
  public getAllOptions(@Query() searchq?: string) {
    return OptionService.getAllOptions(searchq);
  }

  @Put("/{id}")
  @Security("jwt")
  @Middlewares(
    checkRole(roles.STAFF, roles.CEHO, roles.TRAINER, roles.ADMIN),
  )
  public updateOption(@Path() id: string, @Body() body: CreateOptionDto) {
    return OptionService.updateOption(id, body);
  }

  @Delete("/{id}")
  @Security("jwt")
  @Middlewares(
    checkRole(roles.STAFF, roles.CEHO, roles.TRAINER, roles.ADMIN),
  )
  public deleteOption(@Path() id: string) {
    return OptionService.deleteOption(id);
  }

  @Get("/")
  @Middlewares(loggerMiddleware)
  public getOptions(
    @Query() searchq?: string,
    @Query() limit?: number,
    @Query() page?: number,
  ) {
    return OptionService.getOptions(searchq, limit, page);
  }

  @Get("/{id}")
  @Middlewares(loggerMiddleware)
  public getOption(@Path() id: string) {
    return OptionService.getOptionById(id);
  }
}
