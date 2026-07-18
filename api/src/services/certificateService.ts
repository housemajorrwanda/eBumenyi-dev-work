import { prisma } from "../utils/db";
import AppError from "../utils/error";
import { TCertificateResponse } from "../utils/interfaces/common";
import { Prisma } from "@prisma/client";
import { v2 as cloudinary } from "cloudinary";
import { PDFDocument, PDFFont, rgb, StandardFonts } from "pdf-lib";
import * as fs from "fs";
import { v4 as uuidv4 } from "uuid";
import axios from "axios";
import QRCode from "qrcode";
import sharp from "sharp";
import { NotificationHelper } from "../utils/notificationHelper";
import { PROVINCE_DISTRICTS } from "./courseService";

export class CertificateService {
  // Helper: Format date to Kinyarwanda format
  private static formatDateToKinyarwanda(date: Date): string {
    const months = [
      "Mutarama", // January
      "Gashyantare", // February
      "Werurwe", // March
      "Mata", // April
      "Gicurasi", // May
      "Kamena", // June
      "Nyakanga", // July
      "Kanama", // August
      "Nzeri", // September
      "Ukwakira", // October
      "Ugushyingo", // November
      "Ukuboza", // December
    ];

    const day = date.getDate().toString().padStart(2, "0");
    const month = months[date.getMonth()];
    const year = date.getFullYear();

    return `${day} ${month} ${year}`;
  }

  private static formatDateField(date?: Date | string | null): string | null {
    if (!date) return null;

    const parsedDate = date instanceof Date ? date : new Date(date);
    if (isNaN(parsedDate.getTime())) return null;

    return this.formatDateToKinyarwanda(parsedDate);
  }

  // Helper: Generate PDF certificate with custom content
  private static async generateCertificatePDF(
    studentName: string,
    courseTitle: string,
    completionDate: string,
  ): Promise<Buffer> {
    try {
      // Load the PDF template
      const templateBytes = await fs.promises.readFile(
        "./templates/certificate_template.pdf",
      );
      const pdfDoc = await PDFDocument.load(templateBytes);
      const pages = pdfDoc.getPages();
      const firstPage = pages[0];

      // Embed fonts
      const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const timesBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

      // ===== STUDENT NAME =====
      // Coordinates: x=400, y=325
      // Font: HelveticaBold, Size: 26px
      // Handling: truncate, Color: #000000
      // Width Multiplier: 0.5
      // IMPORTANT: Single line only - name should never wrap to multiple lines
      const nameX = 400;
      const nameY = 325;
      const nameFontSize = 26;

      // Calculate text width for proper centering (expanding equally left and right from center)
      const nameWidth = studentName.length * nameFontSize * 0.5;
      const nameDrawX = nameX - nameWidth / 2;

      firstPage.drawText(studentName, {
        x: nameDrawX,
        y: nameY,
        size: nameFontSize,
        color: rgb(0, 0, 0), // #000000
        font: helveticaBold,
        maxWidth: 800, // Large maxWidth to prevent wrapping - name stays on one line
      });
      // ===== COURSE TITLE =====
      // Coordinates: x=350, y=220
      // Font: HelveticaBold, Size: 18px
      // Handling: wrap, Color: #335c9d
      // Width Multiplier: 0.5
      const courseX = 400;
      const courseY = 220;
      const courseFontSize = 18;
      const courseLineHeight = 25;
      const courseMaxWidth = 589; // 70% content width
      const courseWidthMultiplier = 0.5;

      // Function to wrap text with width multiplier
      function wrapTextWithMultiplier(
        text: string,
        maxWidth: number,
        fontSize: number,
        multiplier: number,
      ): string[] {
        const words = text.split(" ");
        const lines: string[] = [];
        let currentLine = "";

        for (const word of words) {
          const testLine = currentLine ? currentLine + " " + word : word;
          const testWidth = testLine.length * fontSize * multiplier;

          if (testWidth <= maxWidth) {
            currentLine = testLine;
          } else {
            if (currentLine) {
              lines.push(currentLine);
              currentLine = word;
            } else {
              lines.push(word);
            }
          }
        }

        if (currentLine) {
          lines.push(currentLine);
        }

        return lines;
      }

      // Wrap course title
      const courseLines = wrapTextWithMultiplier(
        courseTitle,
        courseMaxWidth,
        courseFontSize,
        courseWidthMultiplier,
      );

      // Calculate starting Y position - y=220 is the position of the first line
      // For wrapped text with multiple lines, each line goes DOWN (decreasing y values)
      const courseStartY = courseY;

      // Draw each line of course title
      courseLines.forEach((line, index) => {
        const lineWidth = line.length * courseFontSize * courseWidthMultiplier;
        const courseDrawX = courseX - lineWidth / 2;

        firstPage.drawText(line, {
          x: courseDrawX,
          y: courseStartY - index * courseLineHeight,
          size: courseFontSize,
          color: rgb(0.2, 0.36, 0.62), // #335c9d
          font: helveticaBold,
        });
      });

      // ===== COMPLETION DATE =====
      // Coordinates: x=420, y=140
      // Font: TimesBold, Size: 16px
      // Handling: truncate, Color: #4e4646
      // Width Multiplier: 0.5
      const dateX = 420;
      const dateY = 140;
      const dateFontSize = 16;
      const dateWidthMultiplier = 0.5;

      // Calculate text width for proper centering
      const dateWidth =
        completionDate.length * dateFontSize * dateWidthMultiplier;
      const dateDrawX = dateX - dateWidth / 2;

      firstPage.drawText(completionDate, {
        x: dateDrawX,
        y: dateY,
        size: dateFontSize,
        color: rgb(0.31, 0.27, 0.27), // #4e4646
        font: timesBold,
        maxWidth: 300,
      });

      // Save and return the modified PDF
      const generatedPdfBytes = await pdfDoc.save();
      return Buffer.from(generatedPdfBytes);
    } catch (error) {
      console.error("Error generating certificate PDF:", error);
      throw new AppError(
        `Failed to generate certificate PDF: ${String(error)}`,
        500,
      );
    }
  }

  // Helper: upload PDF buffer to Cloudinary and return the secure URL
  private static async uploadPdfToCloudinary(
    pdfBuffer: Buffer,
    fileName: string,
  ): Promise<string> {
    try {
      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            resource_type: "raw", // For PDF files
            folder: "chw/certificates",
            public_id: fileName,
            format: "pdf",
          },
          (error, result) => {
            if (error) {
              reject(
                new AppError(
                  `Failed to upload PDF to Cloudinary: ${error.message}`,
                  500,
                ),
              );
            } else {
              resolve(result?.secure_url || result?.url || "");
            }
          },
        );
        uploadStream.end(pdfBuffer);
      });
    } catch (err) {
      throw new AppError(
        `Failed to upload PDF to Cloudinary: ${String(err)}`,
        500,
      );
    }
  }

  // Helper: Get first time final exam pass date for a student and course
  private static async getFirstFinalExamPassDate(
    studentId: string,
    courseId: string,
  ): Promise<Date> {
    // Get final exam for the course
    const finalExam = await prisma.finalExam.findFirst({
      where: { courseId },
    });

    if (!finalExam) {
      throw new AppError("No final exam found for this course", 404);
    }

    // Find the first successful attempt (passed) for this student and final exam
    const firstPassedAttempt = await prisma.attempTest.findFirst({
      where: {
        studentId,
        finalExamId: finalExam.id,
        marks: { gte: finalExam.marksToPass },
        isCompleted: true,
      },
      orderBy: { createdAt: "asc" }, // First attempt that passed
    });

    if (!firstPassedAttempt) {
      throw new AppError(
        "Student has not passed the final exam for this course",
        400,
      );
    }

    return firstPassedAttempt.createdAt;
  }

  // Helper: Extract Cloudinary public_id from a secure URL
  private static extractCloudinaryPublicId(url: string): string {
    const uploadIndex = url.indexOf("/upload/");
    if (uploadIndex === -1) {
      throw new AppError("Invalid Cloudinary URL format", 500);
    }
    const afterUpload = url.substring(uploadIndex + 8);
    return afterUpload.replace(/^v\d+\//, "");
  }

  // Helper: Get course completion date for a student and course
  private static async getCourseCompletionDate(
    studentId: string,
    courseId: string,
  ): Promise<Date | null> {
    // Find the last completed slide for this course
    const lastCompletedSlide = await prisma.slideProgress.findFirst({
      where: {
        studentId,
        isCompleted: true,
        slide: {
          chapter: {
            section: { courseId },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true },
    });

    return lastCompletedSlide?.updatedAt || null;
  }

  // ── Template-based certificate generation ─────────────────────────────────

  // PDF page size (points at 72 dpi — standard US Letter landscape)
  private static readonly CANVAS_W = 792;
  private static readonly CANVAS_H = 612;
  // Editor canvas size (pixels at 96 dpi — must match CANVAS_WIDTH/CANVAS_HEIGHT in CertificateDesignEditor.tsx)
  private static readonly EDITOR_W = 1056;
  private static readonly EDITOR_H = 816;

  private static readonly TOKEN_KEY_MAP: Record<string, string> = {
    "cert-code": "{{certificateCode}}",
    date: "{{currentDate}}",
    "course-name": "{{courseName}}",
    details: "{{courseDetails}}",
    progress: "{{progress}}",
    duration: "{{courseDuration}}",
    "start-date": "{{startDate}}",
    "end-date": "{{endDate}}",
    "student-name": "{{studentName}}",
    "student-code": "{{studentCode}}",
    "instructor-name": "{{instructorName}}",
  };

  // Fallback: match by display-label text for templates saved before tokenKey was persisted
  private static readonly TEXT_LABEL_MAP: Record<string, string> = {
    "Certificate Code": "{{certificateCode}}",
    "Current Date": "{{currentDate}}",
    "-Course name-": "{{courseName}}",
    "-Details-": "{{courseDetails}}",
    "-Progress-": "{{progress}}",
    "-Duration-": "{{courseDuration}}",
    "-Start Date-": "{{startDate}}",
    "-End Date-": "{{endDate}}",
    "-Student name-": "{{studentName}}",
    "-Student code-": "{{studentCode}}",
    "-Instructor name-": "{{instructorName}}",
  };

  private static hexToRgb(hex: string): { r: number; g: number; b: number } {
    const clean = hex.replace("#", "");
    const full =
      clean.length === 3
        ? clean
            .split("")
            .map((c) => c + c)
            .join("")
        : clean;
    return {
      r: parseInt(full.slice(0, 2), 16) / 255,
      g: parseInt(full.slice(2, 4), 16) / 255,
      b: parseInt(full.slice(4, 6), 16) / 255,
    };
  }

  private static async getPdfFont(
    pdfDoc: PDFDocument,
    fontFamily = "",
    fontWeight = "normal",
    fontStyle = "normal",
  ): Promise<PDFFont> {
    const serif = /times|georgia|serif/i.test(fontFamily);
    const mono = /courier|mono|consolas/i.test(fontFamily);
    const bold = fontWeight === "bold" || Number(fontWeight) >= 700;
    const italic = fontStyle === "italic" || fontStyle === "oblique";
    if (mono) {
      if (bold && italic)
        return pdfDoc.embedFont(StandardFonts.CourierBoldOblique);
      if (bold) return pdfDoc.embedFont(StandardFonts.CourierBold);
      if (italic) return pdfDoc.embedFont(StandardFonts.CourierOblique);
      return pdfDoc.embedFont(StandardFonts.Courier);
    }
    if (serif) {
      if (bold && italic)
        return pdfDoc.embedFont(StandardFonts.TimesRomanBoldItalic);
      if (bold) return pdfDoc.embedFont(StandardFonts.TimesRomanBold);
      if (italic) return pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
      return pdfDoc.embedFont(StandardFonts.TimesRoman);
    }
    if (bold && italic)
      return pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique);
    if (bold) return pdfDoc.embedFont(StandardFonts.HelveticaBold);
    if (italic) return pdfDoc.embedFont(StandardFonts.HelveticaOblique);
    return pdfDoc.embedFont(StandardFonts.Helvetica);
  }

  private static parseColor(fill: unknown): {
    r: number;
    g: number;
    b: number;
  } {
    if (typeof fill === "string" && fill.startsWith("#"))
      return this.hexToRgb(fill);
    return { r: 0, g: 0, b: 0 };
  }

  static async previewTemplate(
    canvasJson: Record<string, unknown>,
  ): Promise<Buffer> {
    const mockTokenValues: Record<string, string> = {
      "{{studentName}}": "John Doe",
      "{{certificateCode}}": "CHW-2026-001234",
      "{{currentDate}}": this.formatDateToKinyarwanda(new Date()),
      "{{courseName}}": "Community Health Worker Training",
      "{{courseDetails}}": "Advanced Community Health Worker Program",
      "{{progress}}": "100%",
      "{{courseDuration}}": "12 Weeks",
      "{{startDate}}": "01 Mutarama 2026",
      "{{endDate}}": this.formatDateToKinyarwanda(new Date()),
      "{{studentCode}}": "STU-2026-001",
      "{{instructorName}}": "Dr. Jane Smith",
    };
    // Use a fixed placeholder UUID so the QR code encodes a consistent preview URL
    const mockCertId = "00000000-preview-mock-cert-000000000000";
    return this.generateCertificateFromTemplate(
      canvasJson,
      mockTokenValues,
      mockCertId,
    );
  }

  private static async generateCertificateFromTemplate(
    canvasJson: Record<string, unknown>,
    tokenValues: Record<string, string>,
    certId: string,
  ): Promise<Buffer> {
    const W = this.CANVAS_W;
    const H = this.CANVAS_H;
    // Scale factor: convert editor canvas pixels (1056×816) → PDF points (792×612)
    const xRatio = W / this.EDITOR_W;
    const yRatio = H / this.EDITOR_H;

    // Clone and replace tokens in text objects
    const json = JSON.parse(JSON.stringify(canvasJson)) as {
      objects: Record<string, unknown>[];
      background?: string;
      backgroundImage?: Record<string, unknown>;
    };

    for (const obj of json.objects ?? []) {
      const token = obj.token as string | undefined;
      const tokenKey = obj.tokenKey as string | undefined;
      const objText = obj.text as string | undefined;
      const value =
        (token ? tokenValues[token] : undefined) ??
        (tokenKey
          ? tokenValues[this.TOKEN_KEY_MAP[tokenKey] ?? ""]
          : undefined) ??
        (objText ? tokenValues[this.TEXT_LABEL_MAP[objText] ?? ""] : undefined);
      if (value !== undefined) {
        obj.text = value;
      }
    }

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([W, H]);

    // Background colour
    const bgColor = (json.background ?? "#ffffff").toString();
    if (bgColor && bgColor !== "#ffffff" && bgColor.startsWith("#")) {
      const { r, g, b } = this.hexToRgb(bgColor);
      page.drawRectangle({
        x: 0,
        y: 0,
        width: W,
        height: H,
        color: rgb(r, g, b),
      });
    }

    // Background image (set via the background image picker in the editor)
    if (json.backgroundImage) {
      const bgImg = json.backgroundImage;
      const src = (bgImg.src as string) ?? "";
      if (src) {
        try {
          let imgBytes: Buffer;
          if (src.startsWith("data:")) {
            imgBytes = Buffer.from(src.split(",")[1], "base64");
          } else {
            const resp = await axios.get<ArrayBuffer>(src, {
              responseType: "arraybuffer",
              timeout: 8000,
            });
            imgBytes = Buffer.from(resp.data);
          }

          // Detect MIME from data URL prefix
          let mimeType = "";
          if (src.startsWith("data:")) {
            const m = src.match(/^data:([^;]+);/);
            mimeType = m?.[1] ?? "";
          } else {
            if (/\.png(\?|$)/i.test(src)) mimeType = "image/png";
            if (/\.jpe?g(\?|$)/i.test(src)) mimeType = "image/jpeg";
          }

          // Convert unsupported formats (WebP, AVIF, GIF…) via sharp, same as object images
          let finalBytes = imgBytes;
          let finalMime = mimeType;
          if (
            mimeType !== "image/png" &&
            mimeType !== "image/jpeg" &&
            mimeType !== "image/jpg"
          ) {
            finalBytes = await sharp(imgBytes).png().toBuffer();
            finalMime = "image/png";
          }

          const embedded =
            finalMime === "image/png"
              ? await pdfDoc.embedPng(finalBytes)
              : await pdfDoc.embedJpg(finalBytes);
          page.drawImage(embedded, { x: 0, y: 0, width: W, height: H });
        } catch (bgErr) {
          console.error(
            "[CertificateService] Background image failed to embed:",
            bgErr,
          );
        }
      }
    }

    for (const obj of json.objects ?? []) {
      const type = ((obj.type as string) ?? "").toLowerCase();
      const scaleX = (obj.scaleX as number) ?? 1;
      const scaleY = (obj.scaleY as number) ?? 1;
      const opacity = (obj.opacity as number) ?? 1;
      const angle = (obj.angle as number) ?? 0;
      const originX = (obj.originX as string) ?? "left";
      const originY = (obj.originY as string) ?? "top";

      const rawLeft = (obj.left as number) ?? 0;
      const rawTop = (obj.top as number) ?? 0;
      const rawW = (obj.width as number) ?? 0;
      const rawH = (obj.height as number) ?? 0;

      // Display dimensions in canvas units (before PDF scaling)
      const displayW = rawW * scaleX;
      const displayH = rawH * scaleY;

      // Convert stored position → PDF left/top edge, accounting for Fabric's
      // default originX/originY='center' (left/top store the center, not the corner).
      const left =
        originX === "center"
          ? (rawLeft - displayW / 2) * xRatio
          : rawLeft * xRatio;
      const top =
        originY === "center"
          ? (rawTop - displayH / 2) * yRatio
          : rawTop * yRatio;

      // Skip rotated objects — coordinate maths become complex
      if (Math.abs(angle) > 1) continue;

      // QR code placeholder: any object with tokenKey "qr" → render real QR image
      const objTokenKey = obj.tokenKey as string | undefined;
      if (objTokenKey === "qr") {
        const verifyUrl = `${process.env.WEB_APP_URL ?? "http://localhost:4173"}/verify/${certId}`;
        const w = displayW > 0 ? displayW * xRatio : 90;
        const h = displayH > 0 ? displayH * yRatio : 90;
        try {
          const qrPng = await QRCode.toBuffer(verifyUrl, {
            type: "png",
            width: Math.round(Math.max(w, h) * 2),
            margin: 1,
            color: { dark: "#000000", light: "#ffffff" },
          });
          const qrImage = await pdfDoc.embedPng(qrPng);
          page.drawImage(qrImage, {
            x: left,
            y: H - top - h,
            width: w,
            height: h,
            opacity,
          });
        } catch {
          // fallback: plain grey square
          page.drawRectangle({
            x: left,
            y: H - top - h,
            width: w,
            height: h,
            color: rgb(0.9, 0.9, 0.9),
            opacity,
          });
        }
        continue;
      }

      if (type === "rect") {
        const w = displayW * xRatio;
        const h = displayH * yRatio;
        const { r, g, b } = this.parseColor(obj.fill);
        page.drawRectangle({
          x: left,
          y: H - top - h,
          width: w,
          height: h,
          color: rgb(r, g, b),
          opacity,
        });
        // stroke
        if (obj.stroke && typeof obj.stroke === "string" && obj.stroke !== "") {
          const sw = ((obj.strokeWidth as number) ?? 1) * yRatio;
          const sc = this.parseColor(obj.stroke);
          page.drawRectangle({
            x: left,
            y: H - top - h,
            width: w,
            height: h,
            borderColor: rgb(sc.r, sc.g, sc.b),
            borderWidth: sw,
            opacity,
          });
        }
      } else if (
        type === "i-text" ||
        type === "itext" ||
        type === "textbox" ||
        type === "text"
      ) {
        const text = (obj.text as string) ?? "";
        const fontSize = ((obj.fontSize as number) ?? 16) * scaleY * yRatio;
        const fontFamily = (obj.fontFamily as string) ?? "";
        const fontWeight = (obj.fontWeight as string) ?? "normal";
        const fontStyle = (obj.fontStyle as string) ?? "normal";
        const textAlign = (obj.textAlign as string) ?? "left";
        const { r, g, b } = this.parseColor(obj.fill);

        if (!text) continue;

        const font = await this.getPdfFont(
          pdfDoc,
          fontFamily,
          fontWeight,
          fontStyle,
        );
        const objW = displayW * xRatio;

        // When originX='center', rawLeft IS the center x in canvas units → PDF center x
        const boxCenterX =
          originX === "center" ? rawLeft * xRatio : left + objW / 2;

        let tw = font.widthOfTextAtSize(text, fontSize);
        let finalFontSize = fontSize;

        // Scale font down only if text overflows its bounding box
        const pageMargin = 8;
        if (textAlign === "center") {
          const half = tw / 2;
          const maxHalf = Math.min(
            boxCenterX - pageMargin,
            W - boxCenterX - pageMargin,
          );
          if (half > maxHalf && maxHalf > 0) {
            finalFontSize = fontSize * (maxHalf / half) * 0.95;
            tw = font.widthOfTextAtSize(text, finalFontSize);
          }
        } else if (objW > 0) {
          if (tw > objW) {
            finalFontSize = fontSize * (objW / tw) * 0.95;
            tw = font.widthOfTextAtSize(text, finalFontSize);
          }
        } else {
          const maxW = W - left - pageMargin;
          if (tw > maxW && maxW > 0) {
            finalFontSize = fontSize * (maxW / tw) * 0.95;
            tw = font.widthOfTextAtSize(text, finalFontSize);
          }
        }

        // Compute draw-x based on alignment
        let drawX: number;
        if (textAlign === "center") {
          drawX = boxCenterX - tw / 2;
        } else if (textAlign === "right" && objW > 0) {
          drawX = left + objW - tw;
        } else {
          drawX = left;
        }
        drawX = Math.max(pageMargin, Math.min(drawX, W - tw - pageMargin));

        // top is the TOP edge of the bounding box (origin-corrected); baseline sits ~0.72em below it
        const drawY = H - top - finalFontSize * 0.72;

        page.drawText(text, {
          x: drawX,
          y: drawY,
          size: finalFontSize,
          font,
          color: rgb(r, g, b),
          opacity,
        });
      } else if (type === "image") {
        const src = (obj.src as string) ?? "";
        if (!src) continue;
        try {
          const w = displayW * xRatio;
          const h = displayH * yRatio;
          let imgBytes: Buffer;
          if (src.startsWith("data:")) {
            const base64 = src.split(",")[1];
            imgBytes = Buffer.from(base64, "base64");
          } else {
            const resp = await axios.get<ArrayBuffer>(src, {
              responseType: "arraybuffer",
              timeout: 8000,
            });
            imgBytes = Buffer.from(resp.data);
          }

          // Detect MIME type from data URL prefix; fall back to extension hints
          let mimeType = "";
          if (src.startsWith("data:")) {
            const m = src.match(/^data:([^;]+);/);
            mimeType = m?.[1] ?? "";
          } else {
            if (/\.png(\?|$)/i.test(src)) mimeType = "image/png";
            if (/\.jpe?g(\?|$)/i.test(src)) mimeType = "image/jpeg";
          }

          // Convert unsupported formats (WebP, AVIF, GIF…) to PNG via sharp
          let finalBytes = imgBytes;
          let finalMime = mimeType;
          if (
            mimeType !== "image/png" &&
            mimeType !== "image/jpeg" &&
            mimeType !== "image/jpg"
          ) {
            try {
              finalBytes = await sharp(imgBytes).png().toBuffer();
              finalMime = "image/png";
            } catch (convErr) {
              console.error(
                `[CertificateService] sharp could not convert MIME "${mimeType}":`,
                convErr,
              );
              page.drawRectangle({
                x: left,
                y: H - top - h,
                width: w,
                height: h,
                color: rgb(0.85, 0.85, 0.85),
                opacity,
              });
              continue;
            }
          }

          let embedded;
          try {
            embedded =
              finalMime === "image/png"
                ? await pdfDoc.embedPng(finalBytes)
                : await pdfDoc.embedJpg(finalBytes);
          } catch (embedErr) {
            console.error(
              `[CertificateService] Cannot embed image (MIME "${finalMime}"):`,
              embedErr,
            );
            page.drawRectangle({
              x: left,
              y: H - top - h,
              width: w,
              height: h,
              color: rgb(0.85, 0.85, 0.85),
              opacity,
            });
            continue;
          }
          page.drawImage(embedded, {
            x: left,
            y: H - top - h,
            width: w,
            height: h,
            opacity,
          });
        } catch (fetchErr) {
          console.error(
            `[CertificateService] Failed to fetch/decode image:`,
            fetchErr,
          );
        }
      }
    }

    return Buffer.from(await pdfDoc.save());
  }

  public static async prepareCertificate(studentId: string, courseId: string) {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { user: { select: { id: true, fullNames: true } } },
    });
    if (!student) throw new AppError("Student not found", 404);

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: {
        title: true,
        description: true,
        certificateTemplate: { select: { canvasJson: true } },
        staff: { select: { user: { select: { fullNames: true } } } },
      },
    });
    if (!course) throw new AppError("Course not found", 404);

    const existing = await prisma.certificate.findUnique({
      where: { studentId_courseId: { studentId, courseId } },
    });
    if (existing)
      throw new AppError(
        "Certificate already exists for this student and course",
        400,
      );

    const completionDate = await this.getFirstFinalExamPassDate(
      studentId,
      courseId,
    );

    const courseProgress = await prisma.courseProgress.findFirst({
      where: { studentId, courseId },
      select: { createdAt: true, progress: true },
    });

    const certId = uuidv4();
    const certYear = new Date().getFullYear();
    const certShort = certId.replace(/-/g, "").substring(0, 6).toUpperCase();
    const certDisplayCode = `CHW-${certYear}-${certShort}`;

    const tokenValues: Record<string, string> = {
      "{{studentName}}": student.user.fullNames,
      "{{certificateCode}}": certDisplayCode,
      "{{currentDate}}": this.formatDateToKinyarwanda(new Date()),
      "{{courseName}}": course.title,
      "{{courseDetails}}": course.description ?? "",
      "{{progress}}": `${Math.round(courseProgress?.progress ?? 100)}%`,
      "{{startDate}}": courseProgress
        ? this.formatDateToKinyarwanda(courseProgress.createdAt)
        : "",
      "{{endDate}}": this.formatDateToKinyarwanda(completionDate),
      "{{studentCode}}": studentId.slice(0, 8).toUpperCase(),
      "{{instructorName}}": course.staff?.user?.fullNames ?? "",
      "{{courseDuration}}": "",
    };

    return {
      statusCode: 200,
      message: "Certificate data prepared",
      data: {
        certId,
        tokenValues,
        canvasJson: course.certificateTemplate?.canvasJson
          ? JSON.stringify(course.certificateTemplate.canvasJson)
          : null,
        studentUserId: student.user.id,
      },
    };
  }

  public static async storeFrontendCertificate(
    certId: string,
    studentId: string,
    courseId: string,
    base64Pdf: string,
    io?: any,
  ) {
    const existing = await prisma.certificate.findUnique({
      where: { id: certId },
    });
    if (existing)
      return {
        statusCode: 200,
        message: "Certificate already stored",
        data: existing,
      };

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { user: { select: { id: true } } },
    });
    if (!student) throw new AppError("Student not found", 404);

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { title: true },
    });
    if (!course) throw new AppError("Course not found", 404);

    const base64Data = base64Pdf.includes(",")
      ? base64Pdf.split(",")[1]
      : base64Pdf;
    const pdfBuffer = Buffer.from(base64Data, "base64");

    const fileName = `certificate_${studentId}_${courseId}_${Date.now()}`;
    const pdfUrl = await this.uploadPdfToCloudinary(pdfBuffer, fileName);

    const certificate = await prisma.certificate.create({
      data: { id: certId, studentId, courseId, pdf: pdfUrl },
    });

    if (io && student.user.id) {
      try {
        await NotificationHelper.sendToUser(
          io,
          student.user.id,
          `Icyemezo cyawe cyatanzwe: "${course.title}"`,
          `Icyemezo cyawe kirateguwe. Basura ahabigenewe urebe PDF yawe.`,
          "success",
          `/certificate`,
          "certificate",
          certificate.id,
          { courseTitle: course.title, courseId },
          0,
        );
      } catch (notifErr) {
        console.warn(
          "[CertificateService] Certificate notification failed:",
          notifErr,
        );
      }
    }

    return {
      message: "Certificate stored successfully",
      statusCode: 201,
      data: certificate,
    };
  }

  public static async generateCertificate(
    studentId: string,
    courseId: string,
    io?: any,
  ) {
    // Validate student
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        user: {
          select: { id: true, fullNames: true },
        },
      },
    });
    if (!student) throw new AppError("Student not found", 404);

    // Validate course (include linked template + instructor)
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: {
        title: true,
        description: true,
        certificateTemplate: { select: { canvasJson: true } },
        staff: { select: { user: { select: { fullNames: true } } } },
      },
    });
    if (!course) throw new AppError("Course not found", 404);

    // Check if certificate already exists
    const existingCertificate = await prisma.certificate.findUnique({
      where: { studentId_courseId: { studentId, courseId } },
    });
    if (existingCertificate) {
      throw new AppError(
        "Certificate already exists for this student and course",
        400,
      );
    }

    // Completion date = first time student passed the final exam
    const completionDate = await this.getFirstFinalExamPassDate(
      studentId,
      courseId,
    );

    // Enrollment date
    const courseProgress = await prisma.courseProgress.findFirst({
      where: { studentId, courseId },
      select: { createdAt: true, progress: true },
    });

    // Pre-generate certificate ID so it can be embedded in the template as {{certificateCode}}
    const certId = uuidv4();

    let pdfBuffer: Buffer;

    if (course.certificateTemplate?.canvasJson) {
      // Template-based generation
      // Human-readable display code (e.g. CHW-2026-A3F9C1) — shorter than the raw UUID
      const certYear = new Date().getFullYear();
      const certShort = certId.replace(/-/g, "").substring(0, 6).toUpperCase();
      const certDisplayCode = `CHW-${certYear}-${certShort}`;

      const tokenValues: Record<string, string> = {
        "{{studentName}}": student.user.fullNames,
        "{{certificateCode}}": certDisplayCode,
        "{{currentDate}}": this.formatDateToKinyarwanda(new Date()),
        "{{courseName}}": course.title,
        "{{courseDetails}}": course.description ?? "",
        "{{progress}}": `${Math.round(courseProgress?.progress ?? 100)}%`,
        "{{startDate}}": courseProgress
          ? this.formatDateToKinyarwanda(courseProgress.createdAt)
          : "",
        "{{endDate}}": this.formatDateToKinyarwanda(completionDate),
        "{{studentCode}}": studentId.slice(0, 8).toUpperCase(),
        "{{instructorName}}": course.staff?.user?.fullNames ?? "",
        "{{courseDuration}}": "",
      };
      pdfBuffer = await this.generateCertificateFromTemplate(
        course.certificateTemplate.canvasJson as Record<string, unknown>,
        tokenValues,
        certId,
      );
    } else {
      // Fall back to static PDF template
      pdfBuffer = await this.generateCertificatePDF(
        student.user.fullNames,
        course.title,
        this.formatDateToKinyarwanda(completionDate),
      );
    }

    // Upload PDF to Cloudinary
    const fileName = `certificate_${studentId}_${courseId}_${Date.now()}`;
    const pdfUrl = await this.uploadPdfToCloudinary(pdfBuffer, fileName);

    // Save certificate to database using the pre-generated ID
    const certificate = await prisma.certificate.create({
      data: { id: certId, studentId, courseId, pdf: pdfUrl },
    });

    // Notify student
    if (io && student.user.id) {
      try {
        await NotificationHelper.sendToUser(
          io,
          student.user.id,
          `Icyemezo cyawe cyatanzwe: "${course.title}"`,
          `Icyemezo cyawe kirateguwe. Basura ahabigenewe urebe PDF yawe.`,
          "success",
          `/certificate`,
          "certificate",
          certificate.id,
          { courseTitle: course.title, courseId },
          0,
        );
      } catch (notifErr) {
        console.warn(
          "[CertificateService] Certificate notification failed:",
          notifErr,
        );
      }
    }

    return {
      message: "Certificate generated successfully",
      statusCode: 201,
      data: certificate,
    } as {
      message: string;
      statusCode: number;
      data: TCertificateResponse;
    };
  }

  public static async getAllCertificates(
    searchq?: string,
    limit?: number,
    currentPage?: number,
    templateId?: string,
    courseId?: string,
    dateFrom?: string,
    dateTo?: string,
    district?: string,
    province?: string,
    gender?: string,
    role?: string,
    year?: string,
    month?: string,
    hospitalId?: string,
  ) {
    const where: Prisma.CertificateWhereInput = {};

    if (templateId) {
      where.course = { certificateTemplateId: templateId };
    }

    if (courseId) {
      where.courseId = courseId;
    }

    const districtList = district
      ? [district]
      : province
        ? (PROVINCE_DISTRICTS[province] ?? [])
        : [];
    const userFilter: Prisma.UserWhereInput = {};
    if (districtList.length > 0) userFilter.district = { in: districtList };
    if (gender) userFilter.gender = gender;
    if (hospitalId) userFilter.hospitalId = hospitalId;
    const studentFilter: Prisma.StudentWhereInput = {};
    if (Object.keys(userFilter).length > 0) studentFilter.user = userFilter;
    if (role) studentFilter.role = role as Prisma.StudentWhereInput["role"];
    if (Object.keys(studentFilter).length > 0) where.student = studentFilter;

    if (dateFrom || dateTo) {
      const createdAtFilter: Prisma.DateTimeFilter = {};
      if (dateFrom) {
        createdAtFilter.gte = new Date(`${dateFrom}T00:00:00.000Z`);
      }
      if (dateTo) {
        createdAtFilter.lte = new Date(`${dateTo}T23:59:59.999Z`);
      }
      where.createdAt = createdAtFilter;
    } else if (year || month) {
      const now = new Date();
      const yearNum = year ? parseInt(year) : now.getFullYear();
      const monthNames = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      const monthIndex = month ? monthNames.indexOf(month) : -1;
      const start =
        monthIndex >= 0
          ? new Date(yearNum, monthIndex, 1)
          : new Date(yearNum, 0, 1);
      const end =
        monthIndex >= 0
          ? new Date(yearNum, monthIndex + 1, 0, 23, 59, 59)
          : new Date(yearNum, 11, 31, 23, 59, 59);
      where.createdAt = { gte: start, lte: end };
    }

    if (searchq) {
      where.OR = [
        {
          student: {
            user: {
              fullNames: { contains: searchq, mode: "insensitive" },
            },
          },
        },
        {
          course: {
            title: { contains: searchq, mode: "insensitive" },
          },
        },
      ];
    }

    const take = limit ?? 15;
    const skip = currentPage && currentPage > 0 ? (currentPage - 1) * take : 0;

    const certificates = await prisma.certificate.findMany({
      where,
      take,
      skip,
      orderBy: { createdAt: "desc" },
      include: {
        student: {
          include: {
            user: {
              select: {
                id: true,
                fullNames: true,
                phoneNumber: true,
                district: true,
                sector: true,
              },
            },
          },
        },
        course: {
          select: {
            id: true,
            title: true,
            coverIcon: true,
            certificateTemplate: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    const totalItems = await prisma.certificate.count({ where });

    return {
      message: "Certificates fetched successfully",
      statusCode: 200,
      data: certificates,
      totalItems,
      currentPage: currentPage || 1,
      itemsPerPage: take,
    };
  }

  public static async getMyCertificates(studentId: string) {
    // Validate student
    const student = await prisma.student.findUnique({
      where: { id: studentId },
    });

    if (!student) {
      throw new AppError("Student not found", 404);
    }

    const certificates = await prisma.certificate.findMany({
      where: { studentId },
      orderBy: { createdAt: "desc" },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            coverIcon: true,
            description: true,
          },
        },
      },
    });

    // Transform certificates to the desired format
    const transformedCertificates = await Promise.all(
      certificates.map(async (certificate) => {
        const courseId = certificate.course.id;

        // Get course progress
        const courseProgress = await prisma.courseProgress.findFirst({
          where: {
            studentId,
            courseId,
          },
        });

        // Get enrollment date (when course progress was created)
        const enrollmentDate = courseProgress?.createdAt || null;

        // Get completion date (when course was completed)
        const completedAt = courseProgress?.isCompleted
          ? await this.getCourseCompletionDate(studentId, courseId)
          : null;

        // Get number of slides in the course
        const slidesCount = await prisma.slide.count({
          where: {
            chapter: {
              section: { courseId },
            },
          },
        });

        // Get number of test attempts
        const attemptsCount = await prisma.attempTest.count({
          where: {
            studentId,
            OR: [
              { preTest: { courseId } },
              { midTest: { chapter: { section: { courseId } } } },
              { finalTest: { courseId } },
              { finalExam: { courseId } },
            ],
          },
        });

        // Get number of tests
        const testsCount =
          (await prisma.preTest.count({ where: { courseId } })) +
          (await prisma.midTest.count({
            where: { chapter: { section: { courseId } } },
          })) +
          (await prisma.finalTest.count({ where: { courseId } })) +
          (await prisma.finalExam.count({ where: { courseId } }));

        // Get final exam marks
        const finalExamAttempt = await prisma.attempTest.findFirst({
          where: {
            studentId,
            finalExam: { courseId },
            isCompleted: true,
          },
          orderBy: { marks: "desc" },
        });

        const finalExamMarks = finalExamAttempt?.marks || null;

        return {
          id: certificate.id,
          courseId,
          title: certificate.course.title,
          image: certificate.course.coverIcon,
          progress: courseProgress?.progress || 0,
          enrollmentDate: this.formatDateField(enrollmentDate),
          completedAt: this.formatDateField(completedAt),
          enrollmentDateRaw: enrollmentDate,
          completedAtRaw: completedAt,
          enrollmentDateKinyarwanda: this.formatDateField(enrollmentDate),
          completedAtKinyarwanda: this.formatDateField(completedAt),
          slides: slidesCount,
          attempt: attemptsCount,
          test: testsCount,
          finalExamMarks,
          pdf: certificate.pdf,
        };
      }),
    );

    return {
      message: "My certificates fetched successfully",
      statusCode: 200,
      data: transformedCertificates,
    };
  }

  public static async getMyCertificateByCourseId(
    studentId: string,
    courseId: string,
  ) {
    // Validate student
    const student = await prisma.student.findUnique({
      where: { id: studentId },
    });

    if (!student) {
      throw new AppError("Student not found", 404);
    }

    // Validate course
    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      throw new AppError("Course not found", 404);
    }

    const certificate = await prisma.certificate.findUnique({
      where: {
        studentId_courseId: {
          studentId,
          courseId,
        },
      },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            coverIcon: true,
            description: true,
          },
        },
      },
    });

    if (!certificate) {
      throw new AppError(
        "Certificate not found for this student and course",
        404,
      );
    }

    return {
      message: "Certificate fetched successfully",
      statusCode: 200,
      data: certificate,
    };
  }

  public static async getCertificateById(certificateId: string) {
    const certificate = await prisma.certificate.findUnique({
      where: { id: certificateId },
      include: {
        student: {
          include: {
            user: {
              select: {
                id: true,
                fullNames: true,
                phoneNumber: true,
                district: true,
                sector: true,
              },
            },
          },
        },
        course: {
          select: {
            id: true,
            title: true,
            coverIcon: true,
            description: true,
          },
        },
      },
    });

    if (!certificate) {
      throw new AppError("Certificate not found", 404);
    }

    return {
      message: "Certificate fetched successfully",
      statusCode: 200,
      data: certificate,
    };
  }

  public static async regenerateCertificate(certificateId: string) {
    const existingCertificate = await prisma.certificate.findUnique({
      where: { id: certificateId },
    });
    if (!existingCertificate) throw new AppError("Certificate not found", 404);

    const { studentId, courseId } = existingCertificate;

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { user: { select: { fullNames: true } } },
    });
    if (!student) throw new AppError("Student not found", 404);

    // Include linked template so we use the same path as generateCertificate
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: {
        title: true,
        description: true,
        certificateTemplate: { select: { canvasJson: true } },
        staff: { select: { user: { select: { fullNames: true } } } },
      },
    });
    if (!course) throw new AppError("Course not found", 404);

    const completionDate = await this.getFirstFinalExamPassDate(
      studentId,
      courseId,
    );

    const courseProgress = await prisma.courseProgress.findFirst({
      where: { studentId, courseId },
      select: { createdAt: true, progress: true },
    });

    // Keep the same certificate ID so the QR code URL is unchanged
    const certId = certificateId;
    let pdfBuffer: Buffer;

    if (course.certificateTemplate?.canvasJson) {
      const certYear = new Date(existingCertificate.createdAt).getFullYear();
      const certShort = certId.replace(/-/g, "").substring(0, 6).toUpperCase();
      const certDisplayCode = `CHW-${certYear}-${certShort}`;

      const tokenValues: Record<string, string> = {
        "{{studentName}}": student.user.fullNames,
        "{{certificateCode}}": certDisplayCode,
        "{{currentDate}}": this.formatDateToKinyarwanda(new Date()),
        "{{courseName}}": course.title,
        "{{courseDetails}}": course.description ?? "",
        "{{progress}}": `${Math.round(courseProgress?.progress ?? 100)}%`,
        "{{startDate}}": courseProgress
          ? this.formatDateToKinyarwanda(courseProgress.createdAt)
          : "",
        "{{endDate}}": this.formatDateToKinyarwanda(completionDate),
        "{{studentCode}}": studentId.slice(0, 8).toUpperCase(),
        "{{instructorName}}": course.staff?.user?.fullNames ?? "",
        "{{courseDuration}}": "",
      };
      pdfBuffer = await this.generateCertificateFromTemplate(
        course.certificateTemplate.canvasJson as Record<string, unknown>,
        tokenValues,
        certId,
      );
    } else {
      pdfBuffer = await this.generateCertificatePDF(
        student.user.fullNames,
        course.title,
        this.formatDateToKinyarwanda(completionDate),
      );
    }

    // Delete old Cloudinary file then upload the new one
    const oldPublicId = this.extractCloudinaryPublicId(existingCertificate.pdf);
    await cloudinary.uploader.destroy(oldPublicId, { resource_type: "raw" });

    const fileName = `certificate_${studentId}_${courseId}_${Date.now()}`;
    const pdfUrl = await this.uploadPdfToCloudinary(pdfBuffer, fileName);

    const certificate = await prisma.certificate.update({
      where: { id: certificateId },
      data: { pdf: pdfUrl },
    });

    return {
      message: "Certificate regenerated successfully",
      statusCode: 200,
      data: certificate,
    } as {
      message: string;
      statusCode: number;
      data: TCertificateResponse;
    };
  }

  public static async verifyCertificate(code: string) {
    const certificate = await prisma.certificate.findUnique({
      where: { id: code },
      select: {
        id: true,
        createdAt: true,
        student: {
          select: { user: { select: { fullNames: true } } },
        },
        course: {
          select: { title: true },
        },
      },
    });
    if (!certificate) throw new AppError("Certificate not found", 404);
    return {
      statusCode: 200,
      message: "Certificate verified successfully",
      data: {
        id: certificate.id,
        recipientName: certificate.student.user.fullNames,
        courseName: certificate.course.title,
        issuedAt: certificate.createdAt,
      },
    };
  }

  public static async generateTestCertificate(
    studentId: string,
    courseId: string,
    completionDate: string,
  ) {
    // Validate student
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        user: {
          select: {
            fullNames: true,
          },
        },
      },
    });

    if (!student) {
      throw new AppError("Student not found", 404);
    }

    // Validate course
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: {
        title: true,
      },
    });

    if (!course) {
      throw new AppError("Course not found", 404);
    }

    // Generate PDF certificate with provided date (no validation on duplicate)
    const pdfBuffer = await this.generateCertificatePDF(
      student.user.fullNames,
      course.title,
      completionDate,
    );

    // Upload PDF to Cloudinary
    const fileName = `certificate_${studentId}_${courseId}_${Date.now()}`;
    const pdfUrl = await this.uploadPdfToCloudinary(pdfBuffer, fileName);

    // Save certificate to database
    const certificate = await prisma.certificate.create({
      data: {
        studentId,
        courseId,
        pdf: pdfUrl,
      },
    });

    return {
      message: "Test certificate generated successfully",
      statusCode: 201,
      data: certificate,
    } as {
      message: string;
      statusCode: number;
      data: TCertificateResponse;
    };
  }
}
