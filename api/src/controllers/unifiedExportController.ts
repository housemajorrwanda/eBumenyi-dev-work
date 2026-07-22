import { Get, Middlewares, Query, Request, Route, Security, Tags } from "tsoa";
import { Request as ExpressRequest } from "express";
import { loggerMiddleware } from "../utils/loggers/loggingMiddleware";
import { FilterOptions } from "../utils/filterUtils";
import {
  UnifiedExportService,
  UnifiedExportOptions,
} from "../services/unifiedExportService";
import { CourseService } from "../services/courseService";
import { checkRole } from "../middlewares";
import { roles } from "../utils/roles";
@Route("api/export")
@Tags("Unified Export")
export class UnifiedExportController {
  /**
   * Export selected review types and feedbacks to Excel
   * Users can select which types to include: feedbacks, system reviews, course reviews, section reviews, chapter reviews
   * All data will be exported in a single Excel file with separate sheets for each type
   */

  @Get("/dashboard/course/analytics")
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
  public getCourseAnalytics(
    @Query() district?: string,
    @Query() province?: string,
    @Query() gender?: string,
    @Query() year?: string,
    @Query() month?: string,
    @Query() role?: string,
    @Query() hospitalId?: string,
  ) {
    return CourseService.getCourseAnalytics({
      district,
      province,
      gender,
      year,
      month,
      role,
      hospitalId,
    });
  }

  @Get("/dashboard/student/analytics")
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
  public getStudentAnalytics(
    @Query() district?: string,
    @Query() province?: string,
    @Query() gender?: string,
    @Query() year?: string,
    @Query() month?: string,
    @Query() role?: string,
    @Query() hospitalId?: string,
  ) {
    return CourseService.getStudentAnalytics({
      district,
      province,
      gender,
      year,
      month,
      role,
      hospitalId,
    });
  }

  @Get("/dashboard/test-score/analytics")
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
  public getTestScoreAnalytics(
    @Query() district?: string,
    @Query() province?: string,
    @Query() gender?: string,
    @Query() year?: string,
    @Query() month?: string,
    @Query() role?: string,
    @Query() hospitalId?: string,
  ) {
    return CourseService.getTestScoreAnalytics({
      district,
      province,
      gender,
      year,
      month,
      role,
      hospitalId,
    });
  }

  @Get("/dashboard/communications/analytics")
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
  public getCommunicationsAnalytics(
    @Query() district?: string,
    @Query() province?: string,
    @Query() gender?: string,
    @Query() year?: string,
    @Query() month?: string,
    @Query() role?: string,
    @Query() hospitalId?: string,
  ) {
    return CourseService.getCommunicationsAnalytics({
      district,
      province,
      gender,
      year,
      month,
      role,
      hospitalId,
    });
  }

  @Get("/dashboard/demographics/analytics")
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
  public getDemographicsAnalytics(
    @Query() district?: string,
    @Query() province?: string,
    @Query() gender?: string,
    @Query() year?: string,
    @Query() month?: string,
    @Query() role?: string,
    @Query() hospitalId?: string,
  ) {
    return CourseService.getDemographicsAnalytics({
      district,
      province,
      gender,
      year,
      month,
      role,
      hospitalId,
    });
  }

  @Get("/dashboard/chw-stats")
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
  public getCHWDashboardStats(
    @Query() district?: string,
    @Query() province?: string,
    @Query() gender?: string,
    @Query() year?: string,
    @Query() month?: string,
    @Query() role?: string,
    @Query() hospitalId?: string,
  ) {
    return CourseService.getCHWDashboardStats({
      district,
      province,
      gender,
      year,
      month,
      role,
      hospitalId,
    });
  }

  @Get("/dashboard/course-duration")
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
  public getCourseDurationStats(
    @Query() district?: string,
    @Query() province?: string,
    @Query() gender?: string,
    @Query() year?: string,
    @Query() month?: string,
    @Query() role?: string,
    @Query() hospitalId?: string,
  ) {
    return CourseService.getCourseDurationStats({
      district,
      province,
      gender,
      year,
      month,
      role,
      hospitalId,
    });
  }

  @Get("/dashboard/recent-activity")
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
  public getRecentActivityFeed(
    @Query() district?: string,
    @Query() province?: string,
    @Query() gender?: string,
    @Query() year?: string,
    @Query() month?: string,
    @Query() role?: string,
    @Query() hospitalId?: string,
  ) {
    return CourseService.getRecentActivityFeed({
      district,
      province,
      gender,
      year,
      month,
      role,
      hospitalId,
    });
  }

  @Get("/dashboard/supervisor-response-rate")
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
  public getSupervisorResponseRate(
    @Query() district?: string,
    @Query() province?: string,
    @Query() gender?: string,
    @Query() year?: string,
    @Query() month?: string,
    @Query() role?: string,
    @Query() hospitalId?: string,
  ) {
    return CourseService.getSupervisorResponseRate({
      district,
      province,
      gender,
      year,
      month,
      role,
      hospitalId,
    });
  }

  @Get("/dashboard/certification-analytics")
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
  public getCertificationAnalytics(
    @Query() district?: string,
    @Query() province?: string,
    @Query() gender?: string,
    @Query() year?: string,
    @Query() month?: string,
    @Query() role?: string,
    @Query() hospitalId?: string,
  ) {
    return CourseService.getCertificationAnalytics({
      district,
      province,
      gender,
      year,
      month,
      role,
      hospitalId,
    });
  }

  @Get("/dashboard/monthly-active-trends")
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
  public getMonthlyActiveTrends(
    @Query() district?: string,
    @Query() province?: string,
    @Query() gender?: string,
    @Query() year?: string,
    @Query() month?: string,
    @Query() role?: string,
    @Query() hospitalId?: string,
  ) {
    return CourseService.getMonthlyActiveTrends({
      district,
      province,
      gender,
      year,
      month,
      role,
      hospitalId,
    });
  }

  @Get("/reviews")
  @Security("jwt")
  @Middlewares(loggerMiddleware)
  public async exportSelectedReviews(
    @Request() req: ExpressRequest,
    @Query() exportAll?: boolean,
    @Query() includeFeedbacks?: boolean,
    @Query() includeSystemReviews?: boolean,
    @Query() includeCourseReviews?: boolean,
    @Query() includeSectionReviews?: boolean,
    @Query() includeChapterReviews?: boolean,
    @Query() searchq?: string,
    @Query() district?: string,
    @Query() sector?: string,
    @Query() startDate?: string,
    @Query() endDate?: string,
  ): Promise<void> {
    const filters: FilterOptions = {
      searchq,
      district,
      sector,
      dateRange: startDate && endDate ? { startDate, endDate } : undefined,
    };

    const exportOptions: UnifiedExportOptions = {
      exportAll: exportAll === true,
      includeFeedbacks: includeFeedbacks === true,
      includeSystemReviews: includeSystemReviews === true,
      includeCourseReviews: includeCourseReviews === true,
      includeSectionReviews: includeSectionReviews === true,
      includeChapterReviews: includeChapterReviews === true,
    };

    // Validate that at least one export option is selected
    const hasSelection =
      exportOptions.exportAll ||
      exportOptions.includeFeedbacks ||
      exportOptions.includeSystemReviews ||
      exportOptions.includeCourseReviews ||
      exportOptions.includeSectionReviews ||
      exportOptions.includeChapterReviews;

    if (!hasSelection) {
      throw new Error("Please select at least one type to export");
    }

    return UnifiedExportService.exportSelectedReviews(
      exportOptions,
      filters,
      req.res,
    );
  }

  /**
   * Get summary of records that would be exported based on current filters and selections
   */
  @Get("/summary")
  @Security("jwt")
  @Middlewares(loggerMiddleware)
  public async getExportSummary(
    @Query() exportAll?: boolean,
    @Query() includeFeedbacks?: boolean,
    @Query() includeSystemReviews?: boolean,
    @Query() includeCourseReviews?: boolean,
    @Query() includeSectionReviews?: boolean,
    @Query() includeChapterReviews?: boolean,
    @Query() searchq?: string,
    @Query() district?: string,
    @Query() sector?: string,
    @Query() startDate?: string,
    @Query() endDate?: string,
  ) {
    const filters: FilterOptions = {
      searchq,
      district,
      sector,
      dateRange: startDate && endDate ? { startDate, endDate } : undefined,
    };

    const exportOptions: UnifiedExportOptions = {
      exportAll: exportAll === true,
      includeFeedbacks: includeFeedbacks === true,
      includeSystemReviews: includeSystemReviews === true,
      includeCourseReviews: includeCourseReviews === true,
      includeSectionReviews: includeSectionReviews === true,
      includeChapterReviews: includeChapterReviews === true,
    };

    const result = await UnifiedExportService.getUnifiedExportSummary(
      exportOptions,
      filters,
    );

    return {
      success: true,
      data: result,
    };
  }
}
