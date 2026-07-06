import { Prisma } from "@prisma/client";
import { prisma } from "../utils/db";
import AppError from "../utils/error";
import { v2 as cloudinary } from "cloudinary";

const MOCK_CERT_ID = "00000000-0000-0000-0000-000000000000";

export class CertificateTemplateService {
  static getMockTokenValues() {
    const now = new Date();
    const fmt = (d: Date) =>
      d.toLocaleDateString("en-US", { day: "2-digit", month: "long", year: "numeric" });
    return {
      statusCode: 200,
      message: "Mock token values",
      data: {
        certId: MOCK_CERT_ID,
        tokenValues: {
          "{{studentName}}":     "Jane Doe",
          "{{certificateCode}}": "CHW-2026-MOCK01",
          "{{currentDate}}":     fmt(now),
          "{{courseName}}":      "Community Health Worker Training",
          "{{courseDetails}}":   "Advanced Community Health Worker Program",
          "{{progress}}":        "100%",
          "{{courseDuration}}":  "12 Weeks",
          "{{startDate}}":       "01 January 2026",
          "{{endDate}}":         fmt(now),
          "{{studentCode}}":     "STU-2026-001",
          "{{instructorName}}":  "Dr. Jane Smith",
        },
      },
    };
  }
  static async list() {
    const templates = await prisma.certificateTemplate.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        thumbnail: true,
        createdAt: true,
        updatedAt: true,
        courses: {
          select: {
            _count: { select: { certificates: true } },
          },
        },
      },
    });

    const data = templates.map(({ courses, ...t }) => ({
      ...t,
      issuedCount: courses.reduce((sum, c) => sum + c._count.certificates, 0),
    }));

    return { statusCode: 200, message: "Templates fetched successfully", data };
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

  static async listBgImages() {
    const images = await prisma.backgroundImage.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, url: true, createdAt: true },
    });
    return { statusCode: 200, message: "Background images fetched successfully", data: images };
  }

  static async deleteBgImage(id: string) {
    const image = await prisma.backgroundImage.findUnique({ where: { id } });
    if (!image) throw new AppError("Background image not found", 404);
    const publicId = image.url.split("/").slice(-2).join("/").replace(/\.[^.]+$/, "");
    await cloudinary.uploader.destroy(publicId, { resource_type: "image" }).catch(() => {});
    await prisma.backgroundImage.delete({ where: { id } });
    return { statusCode: 200, message: "Background image deleted successfully" };
  }

  static async uploadBgImage(dataUrl: string) {
    const result = await cloudinary.uploader.upload(dataUrl, {
      folder: "certificate-backgrounds",
      resource_type: "image",
    });
    const saved = await prisma.backgroundImage.create({
      data: { url: result.secure_url },
      select: { id: true, url: true, createdAt: true },
    });
    return { statusCode: 201, message: "Background image saved", data: saved };
  }
}
