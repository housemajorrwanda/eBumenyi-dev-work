import ExcelJS from "exceljs";
import { Response } from "express";

export interface ExcelColumn {
  header: string;
  key: string;
  width?: number;
  type?: "string" | "number" | "date" | "email" | "phone";
}

export interface ExcelExportOptions {
  filename: string;
  sheetName: string;
  columns: ExcelColumn[];
  data: Record<string, unknown>[];
  title?: string;
  subtitle?: string;
  metadata?: Record<string, unknown>;
}

// Palette — matches the app's design system (tailwind.config.ts + index.css)
// primary: #3363AD | secondary: #595F74 | dark: #373449 | page-bg: #EFF1F8
const C = {
  bannerBg:     { argb: "FF373449" }, // --dark (deepest brand tone)
  titleBg:      { argb: "FF3363AD" }, // --primary
  subtitleBg:   { argb: "FF595F74" }, // --secondary
  headerBg:     { argb: "FF3363AD" }, // --primary (same as title for consistency)
  headerBorder: { argb: "FF1E3D6B" }, // darkened primary
  metaKeyBg:    { argb: "FFD6E0F5" }, // light tint of primary
  metaValBg:    { argb: "FFEFF1F8" }, // --page-bg
  rowOdd:       { argb: "FFFFFFFF" }, // --card-bg
  rowEven:      { argb: "FFEFF1F8" }, // --page-bg / muted
  borderLight:  { argb: "FFD1D8ED" }, // soft border from primary tint
  white:        { argb: "FFFFFFFF" },
  nearBlack:    { argb: "FF111827" }, // --card-text / foreground
  gray:         { argb: "FF595F74" }, // --secondary / card-subtitle
  phone:        { argb: "FF3363AD" }, // --primary
  date:         { argb: "FF595F74" }, // --secondary
  number:       { argb: "FF373449" }, // --dark, bold
  email:        { argb: "FF3363AD" }, // --primary
};

export class ExcelExporter {
  private static getNestedValue(
    obj: Record<string, unknown>,
    path: string,
  ): unknown {
    return path.split(".").reduce((cur: unknown, key: string) => {
      if (!cur || typeof cur !== "object") return "";
      if (/^\d+$/.test(key)) {
        const idx = parseInt(key, 10);
        return Array.isArray(cur) ? (cur[idx] ?? "") : "";
      }
      return key in (cur as Record<string, unknown>)
        ? (cur as Record<string, unknown>)[key]
        : "";
    }, obj);
  }

  private static formatCell(
    value: unknown,
    type?: string,
  ): string | number {
    switch (type) {
      case "date": {
        if (value && (value instanceof Date || typeof value === "string")) {
          return new Date(value as string).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "2-digit",
          });
        }
        return "";
      }
      case "phone":
        return value ? `+${String(value)}` : "";
      case "email":
        return value ? String(value).toLowerCase() : "";
      case "number":
        return value != null && value !== "" ? Number(value) : 0;
      default:
        return value != null ? String(value) : "";
    }
  }

  private static autoWidth(
    header: string,
    data: Record<string, unknown>[],
    key: string,
  ): number {
    let max = header.length;
    const sample = Math.min(60, data.length);
    for (let i = 0; i < sample; i++) {
      const v = String(this.getNestedValue(data[i], key) ?? "");
      max = Math.max(max, v.length);
    }
    if (key.toLowerCase().includes("phone")) return Math.max(16, Math.min(20, max + 3));
    if (key.toLowerCase().includes("email")) return Math.max(22, Math.min(38, max + 3));
    if (key.toLowerCase().includes("date") || key.toLowerCase().includes("at"))
      return Math.max(16, Math.min(22, max + 3));
    if (key.toLowerCase().includes("name")) return Math.max(22, Math.min(34, max + 4));
    return Math.max(12, Math.min(55, max + 5));
  }

  private static colLetter(n: number): string {
    let s = "";
    while (n > 0) {
      s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }

  private static buildSheet(
    wb: ExcelJS.Workbook,
    options: ExcelExportOptions,
    sheetName?: string,
  ): void {
    const ws = wb.addWorksheet(sheetName || options.sheetName || "Data", {
      pageSetup: {
        paperSize: 9, // A4
        orientation: "landscape",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: { left: 0.5, right: 0.5, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
      },
    });

    const numCols = options.columns.length;
    const lastCol = this.colLetter(numCols);

    // ── Column widths ──────────────────────────────────────────────────────
    options.columns.forEach((col, i) => {
      ws.getColumn(i + 1).width =
        col.width || this.autoWidth(col.header, options.data, col.key);
    });

    let r = 1; // current row number

    // ── Banner ─────────────────────────────────────────────────────────────
    ws.mergeCells(`A${r}:${lastCol}${r}`);
    const bannerCell = ws.getCell(`A${r}`);
    bannerCell.value = "eBumenyi Platform  |  Community Health Workers";
    bannerCell.fill = { type: "pattern", pattern: "solid", fgColor: C.bannerBg };
    bannerCell.font = { bold: true, size: 15, color: C.white, name: "Calibri" };
    bannerCell.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(r).height = 34;
    r++;

    // ── Title ──────────────────────────────────────────────────────────────
    if (options.title) {
      ws.mergeCells(`A${r}:${lastCol}${r}`);
      const titleCell = ws.getCell(`A${r}`);
      titleCell.value = options.title;
      titleCell.fill = { type: "pattern", pattern: "solid", fgColor: C.titleBg };
      titleCell.font = { bold: true, size: 13, color: C.white, name: "Calibri" };
      titleCell.alignment = { horizontal: "center", vertical: "middle" };
      ws.getRow(r).height = 26;
      r++;
    }

    // ── Subtitle ───────────────────────────────────────────────────────────
    if (options.subtitle) {
      ws.mergeCells(`A${r}:${lastCol}${r}`);
      const subCell = ws.getCell(`A${r}`);
      subCell.value = options.subtitle;
      subCell.fill = { type: "pattern", pattern: "solid", fgColor: C.subtitleBg };
      subCell.font = { italic: true, size: 10, color: C.white, name: "Calibri" };
      subCell.alignment = { horizontal: "center", vertical: "middle" };
      ws.getRow(r).height = 18;
      r++;
    }

    // ── Metadata ───────────────────────────────────────────────────────────
    if (options.metadata && Object.keys(options.metadata).length > 0) {
      // thin spacer
      ws.mergeCells(`A${r}:${lastCol}${r}`);
      ws.getRow(r).height = 8;
      r++;

      Object.entries(options.metadata).forEach(([key, val]) => {
        const row = ws.getRow(r);
        row.height = 17;
        const kCell = row.getCell(1);
        kCell.value = key;
        kCell.fill = { type: "pattern", pattern: "solid", fgColor: C.metaKeyBg };
        kCell.font = { bold: true, size: 9, color: { argb: "FF3363AD" }, name: "Calibri" };
        kCell.alignment = { horizontal: "right", vertical: "middle", indent: 1 };
        kCell.border = { bottom: { style: "hair", color: C.borderLight } };

        const vCell = row.getCell(2);
        vCell.value = String(val ?? "");
        vCell.fill = { type: "pattern", pattern: "solid", fgColor: C.metaValBg };
        vCell.font = { size: 9, color: C.nearBlack, name: "Calibri" };
        vCell.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
        vCell.border = { bottom: { style: "hair", color: C.borderLight } };

        // merge remaining cols of value cell
        if (numCols > 2) {
          ws.mergeCells(`B${r}:${lastCol}${r}`);
        }
        r++;
      });

      // spacer after metadata
      ws.mergeCells(`A${r}:${lastCol}${r}`);
      ws.getRow(r).height = 8;
      r++;
    }

    // ── Header row ─────────────────────────────────────────────────────────
    const headerRowNum = r;
    const headerRow = ws.getRow(headerRowNum);
    headerRow.height = 30;

    options.columns.forEach((col, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = col.header;
      cell.fill = { type: "pattern", pattern: "solid", fgColor: C.headerBg };
      cell.font = { bold: true, size: 10, color: C.white, name: "Calibri" };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = {
        top:    { style: "medium", color: C.headerBorder },
        bottom: { style: "medium", color: C.headerBorder },
        left:   { style: "thin",   color: { argb: "FF1A237E" } },
        right:  { style: "thin",   color: { argb: "FF1A237E" } },
      };
    });
    r++;

    // ── Data rows ──────────────────────────────────────────────────────────
    options.data.forEach((item, idx) => {
      const dataRow = ws.getRow(r);
      dataRow.height = 17;
      const bg = idx % 2 === 0 ? C.rowOdd : C.rowEven;

      options.columns.forEach((col, ci) => {
        const rawVal = this.getNestedValue(item, col.key);
        const cell = dataRow.getCell(ci + 1);
        cell.value = this.formatCell(rawVal, col.type) as ExcelJS.CellValue;
        cell.fill = { type: "pattern", pattern: "solid", fgColor: bg };
        cell.border = {
          top:    { style: "hair", color: C.borderLight },
          bottom: { style: "hair", color: C.borderLight },
          left:   { style: "hair", color: C.borderLight },
          right:  { style: "hair", color: C.borderLight },
        };

        // Type-specific colour and alignment
        let color = C.nearBlack;
        let bold = false;
        let italic = false;
        let align: ExcelJS.Alignment["horizontal"] = "left";

        switch (col.type) {
          case "number":
            color = C.number;
            bold = true;
            align = "center";
            break;
          case "phone":
            color = C.phone;
            align = "left";
            break;
          case "date":
            color = C.date;
            italic = true;
            align = "center";
            break;
          case "email":
            color = C.email;
            break;
        }

        cell.font = { size: 10, color, bold, italic, name: "Calibri" };
        cell.alignment = {
          vertical: "middle",
          horizontal: align,
          indent: align === "left" ? 1 : 0,
          wrapText: false,
        };
      });
      r++;
    });

    // ── Summary row (total count) ──────────────────────────────────────────
    if (options.data.length > 0) {
      const sumRow = ws.getRow(r);
      sumRow.height = 20;
      const sumCell = sumRow.getCell(1);
      sumCell.value = `Total: ${options.data.length} record${options.data.length !== 1 ? "s" : ""}`;
      ws.mergeCells(`A${r}:${lastCol}${r}`);
      sumCell.fill = { type: "pattern", pattern: "solid", fgColor: C.titleBg };
      sumCell.font = { bold: true, size: 10, color: C.white, name: "Calibri" };
      sumCell.alignment = { horizontal: "right", vertical: "middle", indent: 2 };
    }

    // ── Auto-filter ────────────────────────────────────────────────────────
    ws.autoFilter = {
      from: { row: headerRowNum, column: 1 },
      to:   { row: headerRowNum, column: numCols },
    };

    // ── Freeze header + all top rows ───────────────────────────────────────
    ws.views = [{ state: "frozen", ySplit: headerRowNum, xSplit: 0 }];
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  public static createMultiSheetWorkbook(): ExcelJS.Workbook {
    const wb = new ExcelJS.Workbook();
    wb.creator = "eBumenyi Platform";
    wb.created = new Date();
    return wb;
  }

  public static addSheetToWorkbook(
    workbook: ExcelJS.Workbook,
    options: ExcelExportOptions,
    sheetName?: string,
  ): void {
    this.buildSheet(workbook, options, sheetName);
  }

  public static async exportMultiSheetToExcel(
    workbook: ExcelJS.Workbook,
    filename: string,
    res?: Response,
  ): Promise<Buffer> {
    const raw = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
    if (res) {
      const fullName = `${filename}_${new Date().toISOString().split("T")[0]}.xlsx`;
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader("Content-Disposition", `attachment; filename="${fullName}"`);
      res.write(buffer);
      res.end();
    }
    return buffer;
  }

  public static async exportToExcel(
    options: ExcelExportOptions,
    res?: Response,
  ): Promise<Buffer> {
    const wb = this.createMultiSheetWorkbook();
    this.buildSheet(wb, options, options.sheetName);
    const raw = await wb.xlsx.writeBuffer();
    const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
    if (res) {
      const fullName = `${options.filename}_${new Date().toISOString().split("T")[0]}.xlsx`;
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader("Content-Disposition", `attachment; filename="${fullName}"`);
      res.setHeader("Content-Length", buffer.length);
      res.send(buffer);
    }
    return buffer;
  }

  // ── Template factories ─────────────────────────────────────────────────────

  public static createFeedbackExcelTemplate(
    data: Record<string, unknown>[],
    metadata?: Record<string, unknown>,
  ): ExcelExportOptions {
    return {
      filename: "slide_feedbacks_export",
      sheetName: "Slide Feedbacks",
      title: "Slide Feedback Report",
      subtitle: "Community Health Worker Training Platform",
      metadata: {
        "Export Date": new Date().toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "2-digit",
        }),
        "Total Records": data.length,
        ...metadata,
      },
      columns: [
        { header: "User Name",    key: "user.fullNames",                      width: 26 },
        { header: "Phone",        key: "user.phoneNumber",  type: "phone",    width: 17 },
        { header: "District",     key: "user.district",                       width: 17 },
        { header: "Sector",       key: "user.sector",                         width: 17 },
        { header: "Cell",         key: "user.cell",                           width: 14 },
        { header: "Course",       key: "slide.chapter.section.course.title",  width: 32 },
        { header: "Section",      key: "slide.chapter.section.title",         width: 26 },
        { header: "Chapter",      key: "slide.chapter.title",                 width: 26 },
        { header: "Slide #",      key: "slide.slideNumber", type: "number",   width: 10 },
        { header: "Message",      key: "message",                             width: 52 },
        { header: "Created Date", key: "createdAt",         type: "date",     width: 17 },
      ],
      data,
    };
  }

  public static createReviewExcelTemplate(
    data: Record<string, unknown>[],
    type: "course" | "section" | "chapter" | "system",
    metadata?: Record<string, unknown>,
  ): ExcelExportOptions {
    const userPrefix = type === "system" ? "user" : "student.user";

    const baseColumns: ExcelColumn[] = [
      { header: "User Name", key: `${userPrefix}.fullNames`,    width: 26 },
      { header: "Phone",     key: `${userPrefix}.phoneNumber`,  type: "phone", width: 17 },
      { header: "District",  key: `${userPrefix}.district`,     width: 17 },
      { header: "Sector",    key: `${userPrefix}.sector`,       width: 17 },
      { header: "Cell",      key: `${userPrefix}.cell`,         width: 14 },
    ];

    const maxCategories = this.getMaxCategoryRatings(data);

    const typeSpecificColumns: ExcelColumn[] =
      type === "system"
        ? [
            { header: "Feedback",       key: "feedback",       width: 52 },
            { header: "Recommendation", key: "recommendation", width: 18 },
            { header: "Overall Rating", key: "overallRating",  type: "number", width: 15 },
            ...this.generateCategoryRatingColumns(maxCategories, 38),
          ]
        : [
            {
              header:
                type === "course" ? "Course" : type === "section" ? "Section" : "Chapter",
              key: `${type}.title`,
              width: 32,
            },
            { header: "Comment", key: "comment", width: 52 },
            { header: "Rating",  key: "rating",  type: "number", width: 12 },
            ...this.generateCategoryRatingColumns(maxCategories, 22),
          ];

    const typeName = type.charAt(0).toUpperCase() + type.slice(1);

    return {
      filename: `${type}_reviews_export`,
      sheetName: `${typeName} Reviews`,
      title: `${typeName} Review Report`,
      subtitle: "Community Health Worker Training Platform",
      metadata: {
        "Export Date": new Date().toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "2-digit",
        }),
        "Total Records": data.length,
        ...metadata,
      },
      columns: [
        ...baseColumns,
        ...typeSpecificColumns,
        { header: "Created Date", key: "createdAt", type: "date", width: 17 },
      ],
      data,
    };
  }

  private static getMaxCategoryRatings(data: Record<string, unknown>[]): number {
    let max = 0;
    data.forEach((item) => {
      const cr = this.getNestedValue(item, "categoryRatings");
      if (Array.isArray(cr)) max = Math.max(max, cr.length);
    });
    return max;
  }

  private static generateCategoryRatingColumns(
    count: number,
    categoryWidth: number,
  ): ExcelColumn[] {
    const cols: ExcelColumn[] = [];
    for (let i = 0; i < count; i++) {
      cols.push({
        header: `Category ${i + 1}`,
        key: `categoryRatings.${i}.category`,
        width: categoryWidth,
      });
      cols.push({
        header: `Rating ${i + 1}`,
        key: `categoryRatings.${i}.rating`,
        type: "number",
        width: 12,
      });
    }
    return cols;
  }
}
