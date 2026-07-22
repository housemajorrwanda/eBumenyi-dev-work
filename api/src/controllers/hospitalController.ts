import {
  Body,
  Delete,
  Get,
  Path,
  Post,
  Put,
  Query,
  Request,
  Route,
  Tags,
  Middlewares,
  Security,
} from "tsoa";
import { Request as ExpressRequest } from "express";
import multer from "multer";
import { HospitalService } from "../services/hospitalService";
import { checkRole } from "../middlewares";
import { roles } from "../utils/roles";
import {
  CreateHospitalDto,
  UpdateHospitalDto,
} from "../utils/interfaces/common";
import { loggerMiddleware } from "../utils/loggers/loggingMiddleware";
import AppError from "../utils/error";

const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
      "application/csv",
      "text/plain",
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only Excel (.xlsx, .xls) or CSV files are allowed"));
    }
  },
});

@Route("/api/hospitals")
@Tags("Hospitals")
export class HospitalController {
  @Post("/")
  @Security("jwt")
  @Middlewares(
    loggerMiddleware,
    checkRole(roles.ADMIN, roles.STAFF, roles.CEHO, roles.TRAINER),
  )
  public async createHospital(@Body() body: CreateHospitalDto) {
    return HospitalService.createHospital(body);
  }

  @Get("/")
  @Security("jwt")
  @Middlewares(
    loggerMiddleware,
    checkRole(
      roles.ADMIN,
      roles.STAFF,
      roles.CEHO,
      roles.TRAINER,
      roles.DEVELOPER,
    ),
  )
  public async getHospitals(
    @Query() searchq?: string,
    @Query() limit?: number,
    @Query() page?: number,
    @Query() sortBy?: string,
    @Query() order?: string,
    @Query() province?: string,
  ) {
    return HospitalService.getHospitals(
      searchq,
      limit,
      page,
      sortBy,
      order,
      province,
    );
  }

  @Post("/import")
  @Security("jwt")
  @Middlewares(
    importUpload.single("file"),
    loggerMiddleware,
    checkRole(roles.ADMIN, roles.STAFF, roles.CEHO, roles.TRAINER),
  )
  public async importHospitals(@Request() req: ExpressRequest) {
    if (!req.file) {
      throw new AppError("No file provided", 400);
    }
    return HospitalService.importHospitals(req.file.buffer);
  }

  @Get("/all")
  @Security("jwt")
  @Middlewares(loggerMiddleware)
  public async getAllHospitals(@Query() searchq?: string) {
    return HospitalService.getAllHospitals(searchq);
  }

  @Get("/public")
  @Middlewares(loggerMiddleware)
  public async getPublicHospitals(
    @Query() district?: string,
    @Query() sector?: string,
    @Query() cell?: string,
    @Query() village?: string,
  ) {
    return HospitalService.getPublicHospitals(district, sector, cell, village);
  }

  @Get("/{id}")
  @Security("jwt")
  @Middlewares(
    loggerMiddleware,
    checkRole(
      roles.ADMIN,
      roles.STAFF,
      roles.CEHO,
      roles.TRAINER,
      roles.DEVELOPER,
    ),
  )
  public async getHospitalById(@Path() id: string) {
    return HospitalService.getHospitalById(id);
  }

  @Put("/{id}")
  @Security("jwt")
  @Middlewares(
    loggerMiddleware,
    checkRole(roles.ADMIN, roles.STAFF, roles.CEHO, roles.TRAINER),
  )
  public async updateHospital(
    @Path() id: string,
    @Body() body: UpdateHospitalDto,
  ) {
    return HospitalService.updateHospital(id, body);
  }

  @Delete("/{id}")
  @Security("jwt")
  @Middlewares(
    loggerMiddleware,
    checkRole(roles.ADMIN, roles.STAFF, roles.CEHO, roles.TRAINER),
  )
  public async deleteHospital(@Path() id: string) {
    return HospitalService.deleteHospital(id);
  }
}
