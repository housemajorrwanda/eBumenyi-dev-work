import { Response } from "express";
import { FilterOptions } from "../utils/filterUtils";
import { ExcelExporter } from "../utils/excelExporter";
import { StreamingCsvExporter } from "../utils/streamingCsvExporter";
import { FeedbackOnSlideService } from "./feedbackOnSlideService";
import { SystemReviewService } from "./systemReviewService";
import { CourseReviewService } from "./courseReviewService";
import { SectionReviewService } from "./sectionReviewService";
import { ChapterReviewService } from "./chapterReviewService";

export interface UnifiedExportOptions {
  includeFeedbacks?: boolean;
  includeSystemReviews?: boolean;
  includeCourseReviews?: boolean;
  includeSectionReviews?: boolean;
  includeChapterReviews?: boolean;
  exportAll?: boolean;
}

export class UnifiedExportService {
  /**
   * RECOMMENDED: Streaming export for large datasets
   * Exports data to CSV without loading entire dataset into memory
   * Handles 1M+ rows efficiently with constant memory usage
   *
   * @param exportOptions What types of data to export
   * @param exportType 'csv' for streaming CSV (recommended) or 'excel' for Excel (memory-intensive)
   * @param filters Optional filters for data
   * @param res Express response object
   */
  public static async exportSelectedReviewsStreaming(
    exportOptions: UnifiedExportOptions,
    exportType: "csv" | "excel" = "csv",
    filters?: FilterOptions,
    res?: Response,
  ): Promise<void> {
    // If exportAll is true, include everything
    if (exportOptions.exportAll) {
      exportOptions.includeFeedbacks = true;
      exportOptions.includeSystemReviews = true;
      exportOptions.includeCourseReviews = true;
      exportOptions.includeSectionReviews = true;
      exportOptions.includeChapterReviews = true;
    }

    if (exportType === "csv") {
      // Use streaming CSV for large exports
      return this.exportToStreamingCSV(exportOptions, filters, res);
    } else {
      // Fall back to Excel for smaller exports or specific requirements
      return this.exportSelectedReviews(exportOptions, filters, res);
    }
  }

  /**
   * Stream export to CSV format
   * Processes data in batches to avoid memory overload
   */
  private static async exportToStreamingCSV(
    exportOptions: UnifiedExportOptions,
    filters?: FilterOptions,
    res?: Response,
  ): Promise<void> {
    if (!res) {
      throw new Error("Response object required for streaming export");
    }

    const filename = this.generateFilename(exportOptions, "csv");
    let totalRowsExported = 0;

    try {
      // Set CSV response headers
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}.csv"`,
      );
      res.setHeader("Cache-Control", "no-cache");

      // Write BOM for Excel UTF-8 compatibility
      res.write("\uFEFF");

      // Export each data type as separate section with headers
      if (exportOptions.includeFeedbacks) {
        const rowsExported = await this.streamFeedbacksToCSV(filters, res);
        totalRowsExported += rowsExported;
      }

      if (exportOptions.includeSystemReviews) {
        const rowsExported = await this.streamSystemReviewsToCSV(filters, res);
        totalRowsExported += rowsExported;
      }

      if (exportOptions.includeCourseReviews) {
        const rowsExported = await this.streamCourseReviewsToCSV(filters, res);
        totalRowsExported += rowsExported;
      }

      if (exportOptions.includeSectionReviews) {
        const rowsExported = await this.streamSectionReviewsToCSV(filters, res);
        totalRowsExported += rowsExported;
      }

      if (exportOptions.includeChapterReviews) {
        const rowsExported = await this.streamChapterReviewsToCSV(filters, res);
        totalRowsExported += rowsExported;
      }

      if (totalRowsExported === 0) {
        throw new Error(
          "No data found for the selected export options with current filters",
        );
      }

      res.end();
      console.log(
        `[Stream Export] Complete: ${totalRowsExported} rows exported to ${filename}.csv`,
      );
    } catch (error) {
      console.error("[Stream Export] Error during export:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Export failed" });
      } else {
        res.end();
      }
      throw error;
    }
  }

  /**
   * Stream feedbacks to CSV
   */
  private static async streamFeedbacksToCSV(
    filters: FilterOptions | undefined,
    res: Response,
  ): Promise<number> {
    try {
      // Get first batch to determine columns
      const firstBatch = await FeedbackOnSlideService.getAllFeedbacks(filters);

      if (!firstBatch.data || firstBatch.data.length === 0) {
        return 0;
      }

      const columns = Object.keys(firstBatch.data[0]);
      const header = columns.map((col) => this.escapeCsvValue(col)).join(",");
      res.write(header + "\n");

      let rowsExported = 0;

      // Process first batch
      for (const row of firstBatch.data) {
        const csvRow = columns
          .map((col) =>
            this.escapeCsvValue(String(row[col as keyof typeof row] ?? "")),
          )
          .join(",");
        res.write(csvRow + "\n");
        rowsExported++;
      }

      console.log(`[Stream Export] Feedbacks: exported ${rowsExported} rows`);
      return rowsExported;
    } catch (error) {
      console.error("[Stream Export] Error streaming feedbacks:", error);
      return 0;
    }
  }

  /**
   * Stream system reviews to CSV
   */
  private static async streamSystemReviewsToCSV(
    filters: FilterOptions | undefined,
    res: Response,
  ): Promise<number> {
    try {
      const firstBatch = await SystemReviewService.getAllSystemReviews(filters);

      if (!firstBatch.data || firstBatch.data.length === 0) {
        return 0;
      }

      const columns = Object.keys(firstBatch.data[0]);
      const header = columns.map((col) => this.escapeCsvValue(col)).join(",");
      res.write("\n" + header + "\n"); // Add blank line before section

      let rowsExported = 0;

      for (const row of firstBatch.data) {
        const csvRow = columns
          .map((col) =>
            this.escapeCsvValue(String(row[col as keyof typeof row] ?? "")),
          )
          .join(",");
        res.write(csvRow + "\n");
        rowsExported++;
      }

      console.log(
        `[Stream Export] System Reviews: exported ${rowsExported} rows`,
      );
      return rowsExported;
    } catch (error) {
      console.error("[Stream Export] Error streaming system reviews:", error);
      return 0;
    }
  }

  /**
   * Stream course reviews to CSV
   */
  private static async streamCourseReviewsToCSV(
    filters: FilterOptions | undefined,
    res: Response,
  ): Promise<number> {
    try {
      const firstBatch = await CourseReviewService.getAllCourseReviews(filters);

      if (!firstBatch.data || firstBatch.data.length === 0) {
        return 0;
      }

      const columns = Object.keys(firstBatch.data[0]);
      const header = columns.map((col) => this.escapeCsvValue(col)).join(",");
      res.write("\n" + header + "\n");

      let rowsExported = 0;

      for (const row of firstBatch.data) {
        const csvRow = columns
          .map((col) =>
            this.escapeCsvValue(String(row[col as keyof typeof row] ?? "")),
          )
          .join(",");
        res.write(csvRow + "\n");
        rowsExported++;
      }

      console.log(
        `[Stream Export] Course Reviews: exported ${rowsExported} rows`,
      );
      return rowsExported;
    } catch (error) {
      console.error("[Stream Export] Error streaming course reviews:", error);
      return 0;
    }
  }

  /**
   * Stream section reviews to CSV
   */
  private static async streamSectionReviewsToCSV(
    filters: FilterOptions | undefined,
    res: Response,
  ): Promise<number> {
    try {
      const firstBatch =
        await SectionReviewService.getAllSectionReviews(filters);

      if (!firstBatch.data || firstBatch.data.length === 0) {
        return 0;
      }

      const columns = Object.keys(firstBatch.data[0]);
      const header = columns.map((col) => this.escapeCsvValue(col)).join(",");
      res.write("\n" + header + "\n");

      let rowsExported = 0;

      for (const row of firstBatch.data) {
        const csvRow = columns
          .map((col) =>
            this.escapeCsvValue(String(row[col as keyof typeof row] ?? "")),
          )
          .join(",");
        res.write(csvRow + "\n");
        rowsExported++;
      }

      console.log(
        `[Stream Export] Section Reviews: exported ${rowsExported} rows`,
      );
      return rowsExported;
    } catch (error) {
      console.error("[Stream Export] Error streaming section reviews:", error);
      return 0;
    }
  }

  /**
   * Stream chapter reviews to CSV
   */
  private static async streamChapterReviewsToCSV(
    filters: FilterOptions | undefined,
    res: Response,
  ): Promise<number> {
    try {
      const firstBatch =
        await ChapterReviewService.getAllChapterReviews(filters);

      if (!firstBatch.data || firstBatch.data.length === 0) {
        return 0;
      }

      const columns = Object.keys(firstBatch.data[0]);
      const header = columns.map((col) => this.escapeCsvValue(col)).join(",");
      res.write("\n" + header + "\n");

      let rowsExported = 0;

      for (const row of firstBatch.data) {
        const csvRow = columns
          .map((col) =>
            this.escapeCsvValue(String(row[col as keyof typeof row] ?? "")),
          )
          .join(",");
        res.write(csvRow + "\n");
        rowsExported++;
      }

      console.log(
        `[Stream Export] Chapter Reviews: exported ${rowsExported} rows`,
      );
      return rowsExported;
    } catch (error) {
      console.error("[Stream Export] Error streaming chapter reviews:", error);
      return 0;
    }
  }

  /**
   * Escape CSV values to handle commas, quotes, and newlines
   */
  private static escapeCsvValue(value: string | null | undefined): string {
    if (value === null || value === undefined) {
      return "";
    }

    const str = String(value);

    // Check if value needs escaping
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      // Escape double quotes by doubling them
      return `"${str.replace(/"/g, '""')}"`;
    }

    return str;
  }

  /**
   * Generate filename based on export options
   */
  private static generateFilename(
    exportOptions: UnifiedExportOptions,
    format: "csv" | "xlsx" = "xlsx",
  ): string {
    const selectedTypes = [];
    if (exportOptions.includeFeedbacks) selectedTypes.push("Feedbacks");
    if (exportOptions.includeSystemReviews) selectedTypes.push("SystemReviews");
    if (exportOptions.includeCourseReviews) selectedTypes.push("CourseReviews");
    if (exportOptions.includeSectionReviews)
      selectedTypes.push("SectionReviews");
    if (exportOptions.includeChapterReviews)
      selectedTypes.push("ChapterReviews");

    const baseFilename = exportOptions.exportAll
      ? "AllReviewsAndFeedbacks"
      : selectedTypes.join("_");

    return `${baseFilename}_${new Date().toISOString().split("T")[0]}`;
  }

  public static async exportSelectedReviews(
    exportOptions: UnifiedExportOptions,
    filters?: FilterOptions,
    res?: Response,
  ): Promise<void> {
    // If exportAll is true, include everything
    if (exportOptions.exportAll) {
      exportOptions.includeFeedbacks = true;
      exportOptions.includeSystemReviews = true;
      exportOptions.includeCourseReviews = true;
      exportOptions.includeSectionReviews = true;
      exportOptions.includeChapterReviews = true;
    }

    if (res) {
      return this.exportToExcel(exportOptions, filters, res);
    }

    // Fall back to Excel (legacy method) if streaming not needed
    const workbook = ExcelExporter.createMultiSheetWorkbook();
    let sheetsAdded = 0;

    try {
      // Collect data for each selected type and add to workbook
      if (exportOptions.includeFeedbacks) {
        const feedbackData =
          await FeedbackOnSlideService.getAllFeedbacks(filters);
        if (feedbackData.data && feedbackData.data.length > 0) {
          const templateOptions = ExcelExporter.createFeedbackExcelTemplate(
            feedbackData.data,
            filters ? (filters as Record<string, unknown>) : undefined,
          );
          ExcelExporter.addSheetToWorkbook(
            workbook,
            templateOptions,
            "Slide Feedbacks",
          );
          sheetsAdded++;
        }
      }

      if (exportOptions.includeSystemReviews) {
        const systemReviewData =
          await SystemReviewService.getAllSystemReviews(filters);
        if (systemReviewData.data && systemReviewData.data.length > 0) {
          const templateOptions = ExcelExporter.createReviewExcelTemplate(
            systemReviewData.data,
            "system",
            filters ? (filters as Record<string, unknown>) : undefined,
          );
          ExcelExporter.addSheetToWorkbook(
            workbook,
            templateOptions,
            "System Reviews",
          );
          sheetsAdded++;
        }
      }

      if (exportOptions.includeCourseReviews) {
        const courseReviewData =
          await CourseReviewService.getAllCourseReviews(filters);
        if (courseReviewData.data && courseReviewData.data.length > 0) {
          const templateOptions = ExcelExporter.createReviewExcelTemplate(
            courseReviewData.data,
            "course",
            filters ? (filters as Record<string, unknown>) : undefined,
          );
          ExcelExporter.addSheetToWorkbook(
            workbook,
            templateOptions,
            "Course Reviews",
          );
          sheetsAdded++;
        }
      }

      if (exportOptions.includeSectionReviews) {
        const sectionReviewData =
          await SectionReviewService.getAllSectionReviews(filters);
        if (sectionReviewData.data && sectionReviewData.data.length > 0) {
          const templateOptions = ExcelExporter.createReviewExcelTemplate(
            sectionReviewData.data,
            "section",
            filters ? (filters as Record<string, unknown>) : undefined,
          );
          ExcelExporter.addSheetToWorkbook(
            workbook,
            templateOptions,
            "Section Reviews",
          );
          sheetsAdded++;
        }
      }

      if (exportOptions.includeChapterReviews) {
        const chapterReviewData =
          await ChapterReviewService.getAllChapterReviews(filters);
        if (chapterReviewData.data && chapterReviewData.data.length > 0) {
          const templateOptions = ExcelExporter.createReviewExcelTemplate(
            chapterReviewData.data,
            "chapter",
            filters ? (filters as Record<string, unknown>) : undefined,
          );
          ExcelExporter.addSheetToWorkbook(
            workbook,
            templateOptions,
            "Chapter Reviews",
          );
          sheetsAdded++;
        }
      }

      // If no sheets were added, throw an error
      if (sheetsAdded === 0) {
        throw new Error(
          "No data found for the selected export options with current filters",
        );
      }

      // Generate filename based on selected types
      const filename = this.generateFilename(exportOptions, "xlsx");

      // Export the multi-sheet workbook
      await ExcelExporter.exportMultiSheetToExcel(workbook, filename, res);
    } catch (error) {
      console.error("Error during unified export:", error);
      throw error;
    }
  }

  private static async exportToExcel(
    exportOptions: UnifiedExportOptions,
    filters: FilterOptions | undefined,
    res: Response,
  ): Promise<void> {
    const workbook = ExcelExporter.createMultiSheetWorkbook();
    let sheetsAdded = 0;

    if (exportOptions.includeFeedbacks) {
      const result = await FeedbackOnSlideService.getAllFeedbacks(filters);
      if (result.data && result.data.length > 0) {
        const tpl = ExcelExporter.createFeedbackExcelTemplate(result.data);
        ExcelExporter.addSheetToWorkbook(workbook, tpl, "Slide Feedbacks");
        sheetsAdded++;
      }
    }

    if (exportOptions.includeSystemReviews) {
      const result = await SystemReviewService.getAllSystemReviews(filters);
      if (result.data && result.data.length > 0) {
        const tpl = ExcelExporter.createReviewExcelTemplate(result.data, "system");
        ExcelExporter.addSheetToWorkbook(workbook, tpl, "System Reviews");
        sheetsAdded++;
      }
    }

    if (exportOptions.includeCourseReviews) {
      const result = await CourseReviewService.getAllCourseReviews(filters);
      if (result.data && result.data.length > 0) {
        const tpl = ExcelExporter.createReviewExcelTemplate(result.data, "course");
        ExcelExporter.addSheetToWorkbook(workbook, tpl, "Course Reviews");
        sheetsAdded++;
      }
    }

    if (exportOptions.includeSectionReviews) {
      const result = await SectionReviewService.getAllSectionReviews(filters);
      if (result.data && result.data.length > 0) {
        const tpl = ExcelExporter.createReviewExcelTemplate(result.data, "section");
        ExcelExporter.addSheetToWorkbook(workbook, tpl, "Section Reviews");
        sheetsAdded++;
      }
    }

    if (exportOptions.includeChapterReviews) {
      const result = await ChapterReviewService.getAllChapterReviews(filters);
      if (result.data && result.data.length > 0) {
        const tpl = ExcelExporter.createReviewExcelTemplate(result.data, "chapter");
        ExcelExporter.addSheetToWorkbook(workbook, tpl, "Chapter Reviews");
        sheetsAdded++;
      }
    }

    if (sheetsAdded === 0) {
      throw new Error(
        "No data found for the selected export options with current filters",
      );
    }

    const filename = this.generateFilename(exportOptions, "xlsx");
    await ExcelExporter.exportMultiSheetToExcel(workbook, filename, res);
  }

  public static async getUnifiedExportSummary(
    exportOptions: UnifiedExportOptions,
    filters?: FilterOptions,
  ): Promise<{
    summary: Record<string, number>;
    totalRecords: number;
  }> {
    const summary: Record<string, number> = {};
    let totalRecords = 0;

    // If exportAll is true, include everything
    if (exportOptions.exportAll) {
      exportOptions.includeFeedbacks = true;
      exportOptions.includeSystemReviews = true;
      exportOptions.includeCourseReviews = true;
      exportOptions.includeSectionReviews = true;
      exportOptions.includeChapterReviews = true;
    }

    try {
      if (exportOptions.includeFeedbacks) {
        const feedbackData =
          await FeedbackOnSlideService.getAllFeedbacks(filters);
        const count = feedbackData.data?.length || 0;
        summary.feedbacks = count;
        totalRecords += count;
      }

      if (exportOptions.includeSystemReviews) {
        const systemReviewData =
          await SystemReviewService.getAllSystemReviews(filters);
        const count = systemReviewData.data?.length || 0;
        summary.systemReviews = count;
        totalRecords += count;
      }

      if (exportOptions.includeCourseReviews) {
        const courseReviewData =
          await CourseReviewService.getAllCourseReviews(filters);
        const count = courseReviewData.data?.length || 0;
        summary.courseReviews = count;
        totalRecords += count;
      }

      if (exportOptions.includeSectionReviews) {
        const sectionReviewData =
          await SectionReviewService.getAllSectionReviews(filters);
        const count = sectionReviewData.data?.length || 0;
        summary.sectionReviews = count;
        totalRecords += count;
      }

      if (exportOptions.includeChapterReviews) {
        const chapterReviewData =
          await ChapterReviewService.getAllChapterReviews(filters);
        const count = chapterReviewData.data?.length || 0;
        summary.chapterReviews = count;
        totalRecords += count;
      }

      return { summary, totalRecords };
    } catch (error) {
      console.error("Error getting unified export summary:", error);
      throw error;
    }
  }
}
