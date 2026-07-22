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
import { FinalTestService } from "../services/finalTestService";
import { CreateFinalTestDto } from "../utils/interfaces/common";
import { loggerMiddleware } from "../utils/loggers/loggingMiddleware";
import { checkRole } from "../middlewares";
import { roles } from "../utils/roles";

@Route("/api/final-tests")
@Tags("FinalTests")
export class FinalTestController {
  @Post("/")
  @Security("jwt")
  @Middlewares(
    checkRole(roles.STAFF, roles.CEHO, roles.TRAINER, roles.ADMIN),
  )
  public async createFinalTest(@Body() body: CreateFinalTestDto) {
    return FinalTestService.createFinalTest(body);
  }

  @Get("/all")
  @Middlewares(loggerMiddleware)
  public getAllFinalTests(@Query() searchq?: string) {
    return FinalTestService.getAllFinalTests(searchq);
  }

  @Put("/{id}")
  @Security("jwt")
  @Middlewares(
    checkRole(roles.STAFF, roles.CEHO, roles.TRAINER, roles.ADMIN),
  )
  public updateFinalTest(@Path() id: string, @Body() body: CreateFinalTestDto) {
    return FinalTestService.updateFinalTest(id, body);
  }

  @Delete("/{id}")
  @Security("jwt")
  @Middlewares(
    checkRole(roles.STAFF, roles.CEHO, roles.TRAINER, roles.ADMIN),
  )
  public deleteFinalTest(@Path() id: string) {
    return FinalTestService.deleteFinalTest(id);
  }

  @Get("/")
  @Middlewares(loggerMiddleware)
  public getFinalTests(
    @Query() searchq?: string,
    @Query() limit?: number,
    @Query() page?: number,
  ) {
    return FinalTestService.getFinalTests(searchq, limit, page);
  }

  @Get("/{id}")
  @Middlewares(loggerMiddleware)
  public getFinalTest(@Path() id: string) {
    return FinalTestService.getFinalTestById(id);
  }
}
