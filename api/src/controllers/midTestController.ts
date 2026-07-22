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
import { MidTestService } from "../services/midTestService";
import { CreateMidTestDto } from "../utils/interfaces/common";
import { loggerMiddleware } from "../utils/loggers/loggingMiddleware";
import { checkRole } from "../middlewares";
import { roles } from "../utils/roles";

@Route("/api/mid-tests")
@Tags("MidTests")
export class MidTestController {
  @Post("/")
  @Security("jwt")
  @Middlewares(
    checkRole(roles.STAFF, roles.CEHO, roles.TRAINER, roles.ADMIN),
  )
  public async createMidTest(@Body() body: CreateMidTestDto) {
    return MidTestService.createMidTest(body);
  }

  @Get("/all")
  @Middlewares(loggerMiddleware)
  public getAllMidTests(@Query() searchq?: string) {
    return MidTestService.getAllMidTests(searchq);
  }

  @Put("/{id}")
  @Security("jwt")
  @Middlewares(
    checkRole(roles.STAFF, roles.CEHO, roles.TRAINER, roles.ADMIN),
  )
  public updateMidTest(@Path() id: string, @Body() body: CreateMidTestDto) {
    return MidTestService.updateMidTest(id, body);
  }

  @Delete("/{id}")
  @Security("jwt")
  @Middlewares(
    checkRole(roles.STAFF, roles.CEHO, roles.TRAINER, roles.ADMIN),
  )
  public deleteMidTest(@Path() id: string) {
    return MidTestService.deleteMidTest(id);
  }

  @Get("/")
  @Middlewares(loggerMiddleware)
  public getMidTests(
    @Query() searchq?: string,
    @Query() limit?: number,
    @Query() page?: number,
  ) {
    return MidTestService.getMidTests(searchq, limit, page);
  }

  @Get("/{id}")
  @Middlewares(loggerMiddleware)
  public getMidTest(@Path() id: string) {
    return MidTestService.getMidTestById(id);
  }
}
