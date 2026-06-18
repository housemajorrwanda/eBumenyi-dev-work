import {
  Body,
  Delete,
  Get,
  Middlewares,
  Path,
  Post,
  Put,
  Route,
  Security,
  Tags,
} from "tsoa";
import { CertificateTemplateService } from "../services/certificateTemplateService";
import { loggerMiddleware } from "../utils/loggers/loggingMiddleware";
import { checkRole } from "../middlewares";
import { roles } from "../utils/roles";

interface CreateTemplateDto {
  name: string;
  canvasJson: Record<string, unknown>;
}

interface UpdateTemplateDto {
  name?: string;
  canvasJson?: Record<string, unknown>;
  thumbnail?: string;
}

interface TemplateData {
  id: string;
  name: string;
  canvasJson: Record<string, unknown>;
  thumbnail: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface TemplateListItem {
  id: string;
  name: string;
  thumbnail: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface TemplateListResponse {
  statusCode: number;
  message: string;
  data: TemplateListItem[];
}

interface TemplateResponse {
  statusCode: number;
  message: string;
  data: TemplateData;
}

interface DeleteResponse {
  statusCode: number;
  message: string;
}

interface LinkCourseDto {
  courseId: string;
}

interface LinkedCourseItem {
  id: string;
  title: string;
  coverIcon: string;
}

interface LinkedCoursesResponse {
  statusCode: number;
  message: string;
  data: LinkedCourseItem[];
}

@Route("/api/certificate-templates")
@Tags("CertificateTemplates")
export class CertificateTemplateController {
  @Get("/")
  @Security("jwt")
  @Middlewares(loggerMiddleware, checkRole(roles.TRAINER, roles.ADMIN, roles.DEVELOPER))
  public async list(): Promise<TemplateListResponse> {
    return CertificateTemplateService.list() as Promise<TemplateListResponse>;
  }

  @Post("/")
  @Security("jwt")
  @Middlewares(loggerMiddleware, checkRole(roles.TRAINER, roles.ADMIN, roles.DEVELOPER))
  public async create(@Body() body: CreateTemplateDto): Promise<TemplateResponse> {
    return CertificateTemplateService.create(body.name, body.canvasJson) as Promise<TemplateResponse>;
  }

  @Get("/{id}")
  @Security("jwt")
  @Middlewares(loggerMiddleware, checkRole(roles.TRAINER, roles.ADMIN, roles.DEVELOPER))
  public async getById(@Path() id: string): Promise<TemplateResponse> {
    return CertificateTemplateService.getById(id) as Promise<TemplateResponse>;
  }

  @Put("/{id}")
  @Security("jwt")
  @Middlewares(loggerMiddleware, checkRole(roles.TRAINER, roles.ADMIN, roles.DEVELOPER))
  public async update(@Path() id: string, @Body() body: UpdateTemplateDto): Promise<TemplateResponse> {
    return CertificateTemplateService.update(id, {
      name: body.name,
      canvasJson: body.canvasJson,
      thumbnail: body.thumbnail,
    }) as Promise<TemplateResponse>;
  }

  @Delete("/{id}")
  @Security("jwt")
  @Middlewares(loggerMiddleware, checkRole(roles.TRAINER, roles.ADMIN, roles.DEVELOPER))
  public async deleteTemplate(@Path() id: string): Promise<DeleteResponse> {
    return CertificateTemplateService.remove(id);
  }

  @Post("/{id}/link")
  @Security("jwt")
  @Middlewares(loggerMiddleware, checkRole(roles.TRAINER, roles.ADMIN, roles.DEVELOPER))
  public async linkToCourse(@Path() id: string, @Body() body: LinkCourseDto): Promise<DeleteResponse> {
    return CertificateTemplateService.linkToCourse(id, body.courseId);
  }

  @Delete("/{id}/link/{courseId}")
  @Security("jwt")
  @Middlewares(loggerMiddleware, checkRole(roles.TRAINER, roles.ADMIN, roles.DEVELOPER))
  public async unlinkFromCourse(@Path() id: string, @Path() courseId: string): Promise<DeleteResponse> {
    return CertificateTemplateService.unlinkFromCourse(courseId);
  }

  @Get("/{id}/courses")
  @Security("jwt")
  @Middlewares(loggerMiddleware, checkRole(roles.TRAINER, roles.ADMIN, roles.DEVELOPER))
  public async listLinkedCourses(@Path() id: string): Promise<LinkedCoursesResponse> {
    return CertificateTemplateService.listLinkedCourses(id) as Promise<LinkedCoursesResponse>;
  }
}
