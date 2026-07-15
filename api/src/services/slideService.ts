import { prisma } from "../utils/client";
import AppError from "../utils/error";
import { CreateSlideDto, TSlideResponse } from "../utils/interfaces/common";
import { Prisma } from "@prisma/client";
import { SlideReadAloudService } from "./slideReadAloudService";

export class SlideService {
  public static async createSlide(data: CreateSlideDto) {
    // ensure chapter exists
    const chapter = await prisma.chapter.findUnique({
      where: { id: data.chapterId },
    });
    if (!chapter) {
      throw new AppError("Chapter not found", 404);
    }

    // determine slide number if not provided
    const slideNumber = data.slideNumber ?? chapter.totalSlide + 1;

    const slide = await prisma.slide.create({
      data: {
        chapterId: data.chapterId,
        note: data.note ?? null,
        description: data.description ?? null,
        slideNumber,
        file: data.file ?? null,
        isPublished: data.isPublished ?? undefined,
      },
    });

    // update chapter totalSlide
    await prisma.chapter.update({
      where: { id: chapter.id },
      data: { totalSlide: chapter.totalSlide + 1 },
    });

    if (slide.file) {
      SlideReadAloudService.queueTextExtraction(slide.id);
    } else {
      await prisma.slide.update({
        where: { id: slide.id },
        data: { ocrStatus: "skipped" },
      });
    }

    return {
      message: "Slide created successfully",
      statusCode: 201,
      data: slide,
    } as { message: string; statusCode: number; data: TSlideResponse };
  }

  public static async getSlideById(id: string) {
    const slide = await prisma.slide.findUnique({ where: { id } });
    if (!slide) throw new AppError("Slide not found", 404);

    return {
      message: "Slide fetched successfully",
      statusCode: 200,
      data: slide,
    } as { message: string; statusCode: number; data: TSlideResponse };
  }

  public static async updateSlide(id: string, data: CreateSlideDto) {
    const existing = await prisma.slide.findUnique({ where: { id } });
    if (!existing) throw new AppError("Slide not found", 404);

    // If chapterId provided, validate chapter exists (do NOT change totals on update)
    if (data.chapterId && data.chapterId !== existing.chapterId) {
      const chapter = await prisma.chapter.findUnique({
        where: { id: data.chapterId },
      });
      if (!chapter) throw new AppError("Chapter not found", 404);
    }

    const fileChanged = data.file !== undefined && data.file !== existing.file;

    const updated = await prisma.slide.update({
      where: { id },
      data: {
        chapterId: data.chapterId,
        note: data.note ?? existing.note,
        description: data.description ?? existing.description,
        slideNumber: data.slideNumber ?? existing.slideNumber,
        file: data.file ?? existing.file,
        isPublished: data.isPublished ?? existing.isPublished,
      },
    });

    if (fileChanged) {
      if (updated.file) {
        SlideReadAloudService.queueTextExtraction(updated.id);
      } else {
        await prisma.slide.update({
          where: { id: updated.id },
          data: {
            pageTexts: null,
            narrationPages: null,
            ocrStatus: "skipped",
          },
        });
      }
    }

    return {
      message: "Slide updated successfully",
      statusCode: 200,
      data: updated,
    } as { message: string; statusCode: number; data: TSlideResponse };
  }

  public static async deleteSlide(id: string) {
    const existing = await prisma.slide.findUnique({ where: { id } });
    if (!existing) throw new AppError("Slide not found", 404);

    await prisma.slide.delete({ where: { id } });

    // decrement chapter totalSlide
    const chapter = await prisma.chapter.findUnique({
      where: { id: existing.chapterId },
    });
    if (chapter) {
      await prisma.chapter.update({
        where: { id: chapter.id },
        data: { totalSlide: Math.max(0, chapter.totalSlide - 1) },
      });
    }

    return { message: "Slide deleted successfully", statusCode: 200 };
  }

  public static async getSlides(
    searchq?: string,
    limit?: number,
    currentPage?: number,
  ) {
    const where: Prisma.SlideWhereInput = {};
    if (searchq) {
      where.OR = [
        { note: { contains: searchq, mode: "insensitive" } },
        { description: { contains: searchq, mode: "insensitive" } },
      ];
    }

    const take = limit ?? 15;
    const skip = currentPage && currentPage > 0 ? (currentPage - 1) * take : 0;

    const slides = await prisma.slide.findMany({
      where,
      take,
      skip,
      orderBy: { createdAt: "desc" },
    });

    const totalItems = await prisma.slide.count({ where });

    return {
      message: "Slides fetched successfully",
      statusCode: 200,
      data: slides,
      totalItems,
      currentPage: currentPage || 1,
      itemsPerPage: take,
    };
  }

  public static async getAllSlides(searchq?: string) {
    const where: Prisma.SlideWhereInput = {};
    if (searchq) {
      where.OR = [
        { note: { contains: searchq, mode: "insensitive" } },
        { description: { contains: searchq, mode: "insensitive" } },
      ];
    }

    const slides = await prisma.slide.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return {
      message: "Slides fetched successfully",
      statusCode: 200,
      data: slides,
    };
  }
}
