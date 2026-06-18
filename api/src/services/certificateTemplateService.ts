import { Prisma } from "@prisma/client";
import { prisma } from "../utils/db";
import AppError from "../utils/error";

export class CertificateTemplateService {
  static async list() {
    const templates = await prisma.certificateTemplate.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        thumbnail: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return { statusCode: 200, message: "Templates fetched successfully", data: templates };
  }

  static async getById(id: string) {
    const template = await prisma.certificateTemplate.findUnique({ where: { id } });
    if (!template) throw new AppError("Certificate template not found", 404);
    return { statusCode: 200, message: "Template fetched successfully", data: template };
  }

  static async create(name: string, canvasJson: object) {
    const template = await prisma.certificateTemplate.create({
      data: { name, canvasJson: canvasJson as Prisma.InputJsonValue },
    });
    return { statusCode: 201, message: "Template created successfully", data: template };
  }

  static async update(
    id: string,
    data: {
      name?: string;
      canvasJson?: object;
      thumbnail?: string;
    },
  ) {
    const exists = await prisma.certificateTemplate.findUnique({ where: { id } });
    if (!exists) throw new AppError("Certificate template not found", 404);

    const updated = await prisma.certificateTemplate.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.canvasJson !== undefined && { canvasJson: data.canvasJson as Prisma.InputJsonValue }),
        ...(data.thumbnail !== undefined && { thumbnail: data.thumbnail }),
      },
    });
    return { statusCode: 200, message: "Template updated successfully", data: updated };
  }

  static async remove(id: string) {
    const exists = await prisma.certificateTemplate.findUnique({ where: { id } });
    if (!exists) throw new AppError("Certificate template not found", 404);
    await prisma.certificateTemplate.delete({ where: { id } });
    return { statusCode: 200, message: "Template deleted successfully" };
  }

  static async linkToCourse(templateId: string, courseId: string) {
    const template = await prisma.certificateTemplate.findUnique({ where: { id: templateId } });
    if (!template) throw new AppError("Certificate template not found", 404);
    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new AppError("Course not found", 404);
    await prisma.course.update({
      where: { id: courseId },
      data: { certificateTemplateId: templateId },
    });
    return { statusCode: 200, message: "Template linked to course successfully" };
  }

  static async unlinkFromCourse(courseId: string) {
    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new AppError("Course not found", 404);
    await prisma.course.update({
      where: { id: courseId },
      data: { certificateTemplateId: null },
    });
    return { statusCode: 200, message: "Template unlinked from course successfully" };
  }

  static async listLinkedCourses(templateId: string) {
    const template = await prisma.certificateTemplate.findUnique({ where: { id: templateId } });
    if (!template) throw new AppError("Certificate template not found", 404);
    const courses = await prisma.course.findMany({
      where: { certificateTemplateId: templateId },
      select: { id: true, title: true, coverIcon: true },
    });
    return { statusCode: 200, message: "Linked courses fetched successfully", data: courses };
  }
}
