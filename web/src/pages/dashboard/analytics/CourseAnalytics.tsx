import React, { useState, useEffect } from "react";
import { BarChart3, BookOpen, Users, TrendingUp, Award } from "lucide-react";
import { getCourseAnalytics } from "@/services/analytics.service";
import { ICourseAnalytics } from "@/types";

export const CourseAnalytics: React.FC = () => {
  const [analytics, setAnalytics] = useState<ICourseAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const response = await getCourseAnalytics();
        console.log("hdssd:", response)
        if (response.data) {
          setAnalytics(response?.data);
        }
      } catch (error) {
        console.error('Failed to fetch course analytics:', error);
        // Use fallback data in case of error
        setAnalytics({
          totalCourses: { value: 0, trend: { value: 0, direction: 'stable' } },
          activeEnrollments: { value: 0, trend: { value: 0, direction: 'stable' } },
          avgCompletionRate: { value: 0, trend: { value: 0, direction: 'stable' } },
          certificatesIssued: { value: 0, trend: { value: 0, direction: 'stable' } },
          enrollmentTrends: [],
          topPerformingCourses: [],
          coursePerformanceMetrics: [],
          totalStudentsEnrolled: 0,
          averageStudentsPerCourse: 0,
          mostPopularCourse: { id: '', name: 'No data', completion: 0, students: 0, enrolled: 0, inProgress: 0, completed: 0, rate: 0 },
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  const getTrendDisplay = (trend: { value: number; direction: "up" | "down" | "stable" }) => {
    const isPositive = trend.direction === 'up';
    const isNegative = trend.direction === 'down';
    const sign = isPositive ? '+' : isNegative ? '-' : '';
    const color = isPositive ? 'text-[#3363AD]' : isNegative ? 'text-red-500' : 'text-gray-500';
    
    return (
      <div className={`text-[10px] mt-1 ${color} font-medium`}>
        {sign}{trend.value}% from last month
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#3363AD] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading course analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 mb-1">Course Analytics</h1>
        <p className="text-xs text-gray-600">Comprehensive insights into course performance and engagement</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-600">Total Courses</span>
            <div className="w-9 h-9 rounded-lg bg-[#3363AD]/10 flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-[#3363AD]" />
            </div>
          </div>
          <div className="text-xl font-bold text-gray-900">{analytics?.totalCourses?.value || 0}</div>
          {analytics?.totalCourses && getTrendDisplay(analytics.totalCourses.trend)}
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-600">Active Enrollments</span>
            <div className="w-9 h-9 rounded-lg bg-[#3363AD]/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-[#3363AD]" />
            </div>
          </div>
          <div className="text-xl font-bold text-gray-900">{analytics?.activeEnrollments?.value || 0}</div>
          {analytics?.activeEnrollments && getTrendDisplay(analytics.activeEnrollments.trend)}
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-600">Avg Completion Rate</span>
            <div className="w-9 h-9 rounded-lg bg-[#3363AD]/10 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-[#3363AD]" />
            </div>
          </div>
          <div className="text-xl font-bold text-gray-900">{analytics?.avgCompletionRate?.value || 0}%</div>
          {analytics?.avgCompletionRate && getTrendDisplay(analytics.avgCompletionRate.trend)}
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-600">Certificates Issued</span>
            <div className="w-9 h-9 rounded-lg bg-[#3363AD]/10 flex items-center justify-center">
              <Award className="w-4 h-4 text-[#3363AD]" />
            </div>
          </div>
          <div className="text-xl font-bold text-gray-900">{analytics?.certificatesIssued?.value || 0}</div>
          {analytics?.certificatesIssued && getTrendDisplay(analytics.certificatesIssued.trend)}
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Course Enrollment Trends</h3>
          {analytics?.enrollmentTrends && analytics.enrollmentTrends.length > 0 ? (
            <div className="h-56">
              {(() => {
                const maxEnrollments = Math.max(...analytics.enrollmentTrends.map(t => t.enrollments));
                return (
                  <div className="h-full flex items-end justify-between gap-2 px-2">
                    {analytics.enrollmentTrends.map((trend, index) => {
                      const barHeight = maxEnrollments > 0 ? (trend.enrollments / maxEnrollments) * 180 : 0;
                      return (
                        <div key={index} className="flex-1 flex flex-col items-center">
                          <div className="w-full flex flex-col items-center mb-2">
                            <span className="text-[10px] font-medium text-gray-900 mb-1">
                              {trend.enrollments}
                            </span>
                            <div
                              className="w-full bg-gradient-to-t from-[#3363AD] to-[#3363AD]/70 rounded-t-lg transition-all duration-700 ease-out hover:from-[#3363AD] hover:to-[#3363AD]/90 cursor-pointer shadow-sm"
                              style={{ 
                                height: `${barHeight}px`,
                                minHeight: trend.enrollments > 0 ? '8px' : '0px'
                              }}
                            />
                          </div>
                          <span className="text-[10px] text-gray-600 text-center leading-tight">
                            {trend.month.split(' ')[0]}<br />
                            <span className="text-gray-400">{trend.month.split(' ')[1]}</span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="flex items-center justify-center h-56 bg-gray-50 rounded">
              <div className="text-center text-gray-500">
                <BarChart3 className="w-10 h-10 mx-auto mb-2 text-gray-400" />
                <p className="text-xs">No enrollment trend data available</p>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Top Performing Courses</h3>
          {analytics?.topPerformingCourses && analytics.topPerformingCourses.length > 0 ? (
            <div className="space-y-3">
              {analytics.topPerformingCourses.map((course) => (
                <div key={course.id} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-700">{course.name}</span>
                      <span className="text-xs text-gray-500">{course.completion}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div
                        className="bg-[#3363AD] h-1.5 rounded-full transition-all duration-500"
                        style={{ width: `${course.completion}%` }}
                      ></div>
                    </div>
                    <span className="text-[10px] text-gray-500 mt-1">{course.students} CHWs</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-56 bg-gray-50 rounded">
              <div className="text-center text-gray-500">
                <BookOpen className="w-10 h-10 mx-auto mb-2 text-gray-400" />
                <p className="text-xs">No top performing courses data available</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Additional Metrics */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Course Performance Metrics</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-3 text-[10px] font-semibold text-gray-700 uppercase tracking-wide">Course Name</th>
                <th className="text-left py-2 px-3 text-[10px] font-semibold text-gray-700 uppercase tracking-wide">Enrolled</th>
                <th className="text-left py-2 px-3 text-[10px] font-semibold text-gray-700 uppercase tracking-wide">In Progress</th>
                <th className="text-left py-2 px-3 text-[10px] font-semibold text-gray-700 uppercase tracking-wide">Completed</th>
                <th className="text-left py-2 px-3 text-[10px] font-semibold text-gray-700 uppercase tracking-wide">Completion Rate</th>
              </tr>
            </thead>
            <tbody>
              {analytics?.coursePerformanceMetrics && analytics.coursePerformanceMetrics.length > 0 ? (
                analytics.coursePerformanceMetrics.map((course) => (
                  <tr key={course.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-3 text-xs text-gray-900">{course.name}</td>
                    <td className="py-2 px-3 text-xs text-gray-600">{course.enrolled}</td>
                    <td className="py-2 px-3 text-xs text-gray-600">{course.inProgress}</td>
                    <td className="py-2 px-3 text-xs text-gray-600">{course.completed}</td>
                    <td className="py-2 px-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#3363AD]/10 text-[#3363AD]">
                        {course.rate}%
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-gray-500 text-xs">
                    No course performance data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CourseAnalytics;
