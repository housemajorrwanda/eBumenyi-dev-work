import {
  Body,
  Get,
  Middlewares,
  Path,
  Post,
  Query,
  Route,
  Tags,
  Security,
  Request,
} from "tsoa";
import { CertificateService } from "../services/certificateService";
import { loggerMiddleware } from "../utils/loggers/loggingMiddleware";
import { checkRole } from "../middlewares";
import { roles } from "../utils/roles";
import { Request as ExpressRequest } from "express";
import { prisma } from "../utils/db";

@Route("/api/certificates")
@Tags("Certificates")
export class CertificateController {
  @Post("/generate")
  @Security("jwt")
  @Middlewares(
    loggerMiddleware,
    checkRole(roles.TRAINEE, roles.TESTER, roles.CHO),
  )
  public async generateCertificate(
    @Body() body: { courseId: string },
    @Request() req: ExpressRequest,
  ) {
    const { courseId } = body;
    const userId = req.user?.id as string;

    // Get student ID from user ID
    const student = await prisma.student.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!student) {
      throw new Error("Student not found");
    }

    const io = req.app.get("io");
    return CertificateService.generateCertificate(student.id, courseId, io);
  }

  @Post("/regenerate/{id}")
  @Security("jwt")
  @Middlewares(
    loggerMiddleware,
    checkRole(roles.STAFF, roles.CHO, roles.TRAINER, roles.ADMIN),
  )
  public async regenerateCertificate(@Path() id: string) {
    return CertificateService.regenerateCertificate(id);
  }

  @Post("/my-certificate/regenerate/{courseId}")
  @Security("jwt")
  @Middlewares(
    loggerMiddleware,
    checkRole(roles.TRAINEE, roles.TESTER, roles.CHO),
  )
  public async regenerateMyCertificate(
    @Path() courseId: string,
    @Request() req: ExpressRequest,
  ) {
    const userId = req.user?.id as string;

    const student = await prisma.student.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!student) {
      throw new Error("Student not found");
    }

    const certificate = await prisma.certificate.findUnique({
      where: { studentId_courseId: { studentId: student.id, courseId } },
      select: { id: true },
    });

    if (!certificate) {
      throw new Error("Certificate not found");
    }

    return CertificateService.regenerateCertificate(certificate.id);
  }

  @Post("/generate-for-student")
  @Security("jwt")
  @Middlewares(
    loggerMiddleware,
    checkRole(roles.STAFF, roles.CHO, roles.TRAINER, roles.ADMIN),
  )
  public async generateCertificateForStudent(
    @Body() body: { studentId: string; courseId: string },
    @Request() req: ExpressRequest,
  ) {
    const { studentId, courseId } = body;
    const io = req.app.get("io");
    return CertificateService.generateCertificate(studentId, courseId, io);
  }

  @Get("/all")
  @Security("jwt")
  @Middlewares(
    loggerMiddleware,
    checkRole(roles.STAFF, roles.CHO, roles.TRAINER, roles.ADMIN),
  )
  public async getAllCertificates(
    @Query() searchq?: string,
    @Query() limit?: number,
    @Query() page?: number,
    @Query() templateId?: string,
    @Query() courseId?: string,
    @Query() dateFrom?: string,
    @Query() dateTo?: string,
    @Query() district?: string,
    @Query() province?: string,
    @Query() gender?: string,
    @Query() role?: string,
    @Query() year?: string,
    @Query() month?: string,
    @Query() hospitalId?: string,
  ) {
    return CertificateService.getAllCertificates(
      searchq,
      limit,
      page,
      templateId,
      courseId,
      dateFrom,
      dateTo,
      district,
      province,
      gender,
      role,
      year,
      month,
      hospitalId,
    );
  }

  @Post("/test/generate")
  public async testGenerateCertificate(
    @Body() body: { studentId: string; courseId: string; date: string },
  ) {
    const { studentId, courseId, date } = body;
    return CertificateService.generateTestCertificate(
      studentId,
      courseId,
      date,
    );
  }

  @Get("/my-certificates")
  @Security("jwt")
  @Middlewares(
    loggerMiddleware,
    checkRole(roles.TRAINEE, roles.TESTER, roles.CHO),
  )
  public async getMyCertificates(@Request() req: ExpressRequest) {
    const userId = req.user?.id as string;

    // Get student ID from user ID
    const student = await prisma.student.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!student) {
      throw new Error("Student not found");
    }

    return CertificateService.getMyCertificates(student.id);
  }

  @Get("/my-certificate/course/{courseId}")
  @Security("jwt")
  @Middlewares(
    loggerMiddleware,
    checkRole(roles.TRAINEE, roles.TESTER, roles.CHO),
  )
  public async getMyCertificateByCourseId(
    @Path() courseId: string,
    @Request() req: ExpressRequest,
  ) {
    const userId = req.user?.id as string;

    // Get student ID from user ID
    const student = await prisma.student.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!student) {
      throw new Error("Student not found");
    }

    return CertificateService.getMyCertificateByCourseId(student.id, courseId);
  }

  @Post("/prepare")
  @Security("jwt")
  @Middlewares(
    loggerMiddleware,
    checkRole(roles.TRAINEE, roles.TESTER, roles.CHO),
  )
  public async prepareCertificate(
    @Body() body: { courseId: string },
    @Request() req: ExpressRequest,
  ) {
    const userId = req.user?.id as string;
    const student = await prisma.student.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!student) throw new Error("Student not found");
    return CertificateService.prepareCertificate(student.id, body.courseId);
  }

  @Post("/store-pdf")
  @Security("jwt")
  @Middlewares(
    loggerMiddleware,
    checkRole(roles.TRAINEE, roles.TESTER, roles.CHO),
  )
  public async storeFrontendCertificate(
    @Body() body: { certId: string; courseId: string; base64Pdf: string },
    @Request() req: ExpressRequest,
  ) {
    const userId = req.user?.id as string;
    const student = await prisma.student.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!student) throw new Error("Student not found");
    const io = req.app.get("io");
    return CertificateService.storeFrontendCertificate(
      body.certId,
      student.id,
      body.courseId,
      body.base64Pdf,
      io,
    );
  }

  @Get("/verify/{code}")
  public async verifyCertificate(@Path() code: string) {
    return CertificateService.verifyCertificate(code);
  }

  @Get("/{id}")
  @Security("jwt")
  @Middlewares(
    loggerMiddleware,
    checkRole(
      roles.STAFF,
      roles.CHO,
      roles.TRAINER,
      roles.ADMIN,
      roles.TRAINEE,
    ),
  )
  public async getCertificateById(@Path() id: string) {
    return CertificateService.getCertificateById(id);
  }
}
