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
import { PreTestService } from "../services/preTestService";
import { CreatePreTestDto } from "../utils/interfaces/common";
import { loggerMiddleware } from "../utils/loggers/loggingMiddleware";
import { checkRole } from "../middlewares";
import { roles } from "../utils/roles";

@Route("/api/pre-tests")
@Tags("PreTests")
export class PreTestController {
  @Post("/")
  @Security("jwt")
  @Middlewares(
    checkRole(roles.STAFF, roles.CEHO, roles.TRAINER, roles.ADMIN),
  )
  public async createPreTest(@Body() body: CreatePreTestDto) {
    return PreTestService.createPreTest(body);
  }

  @Get("/all")
  @Middlewares(loggerMiddleware)
  public getAllPreTests(@Query() searchq?: string) {
    return PreTestService.getAllPreTests(searchq);
  }

  @Put("/{id}")
  @Security("jwt")
  @Middlewares(
    checkRole(roles.STAFF, roles.CEHO, roles.TRAINER, roles.ADMIN),
  )
  public updatePreTest(@Path() id: string, @Body() body: CreatePreTestDto) {
    return PreTestService.updatePreTest(id, body);
  }

  @Delete("/{id}")
  @Security("jwt")
  @Middlewares(
    checkRole(roles.STAFF, roles.CEHO, roles.TRAINER, roles.ADMIN),
  )
  public deletePreTest(@Path() id: string) {
    return PreTestService.deletePreTest(id);
  }

  @Get("/")
  @Middlewares(loggerMiddleware)
  public getPreTests(
    @Query() searchq?: string,
    @Query() limit?: number,
    @Query() page?: number,
  ) {
    return PreTestService.getPreTests(searchq, limit, page);
  }

  @Get("/{id}")
  @Middlewares(loggerMiddleware)
  public getPreTest(@Path() id: string) {
    return PreTestService.getPreTestById(id);
  }
}
