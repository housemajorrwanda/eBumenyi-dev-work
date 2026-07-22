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
import { CreateDocumentOnSlideDto } from "../utils/interfaces/common";
import { DocumentOnSlideService } from "../services/documentOnSlideService";
import { loggerMiddleware } from "../utils/loggers/loggingMiddleware";
import { checkRole } from "../middlewares";
import { roles } from "../utils/roles";

@Route("/api/documents")
@Tags("Documents")
export class DocumentOnSlideController {
  @Post("/")
  @Security("jwt")
  @Middlewares(
    checkRole(roles.STAFF, roles.CEHO, roles.TRAINER, roles.ADMIN),
  )
  public async createDocument(@Body() body: CreateDocumentOnSlideDto) {
    return DocumentOnSlideService.createDocument(body);
  }

  @Get("/all")
  @Middlewares(loggerMiddleware)
  public async getAllDocuments(@Query() searchq?: string) {
    return DocumentOnSlideService.getAllDocuments(searchq);
  }

  @Get("/")
  @Middlewares(loggerMiddleware)
  public async getDocuments(
    @Query() searchq?: string,
    @Query() limit?: number,
    @Query() page?: number,
  ) {
    return DocumentOnSlideService.getDocuments(searchq, limit, page);
  }

  @Get("/{id}")
  @Middlewares(loggerMiddleware)
  public async getDocument(@Path() id: string) {
    return DocumentOnSlideService.getDocumentById(id);
  }

  @Put("/{id}")
  @Security("jwt")
  @Middlewares(
    checkRole(roles.STAFF, roles.CEHO, roles.TRAINER, roles.ADMIN),
  )
  public async updateDocument(
    @Path() id: string,
    @Body() body: CreateDocumentOnSlideDto,
  ) {
    return DocumentOnSlideService.updateDocument(id, body);
  }

  @Delete("/{id}")
  @Security("jwt")
  @Middlewares(
    checkRole(roles.STAFF, roles.CEHO, roles.TRAINER, roles.ADMIN),
  )
  public async deleteDocument(@Path() id: string) {
    return DocumentOnSlideService.deleteDocument(id);
  }

  @Get("/by-course/{courseId}")
  @Middlewares(loggerMiddleware)
  public async getDocumentsByCourse(@Path() courseId: string) {
    return DocumentOnSlideService.getDocumentsByCourse(courseId);
  }
}
