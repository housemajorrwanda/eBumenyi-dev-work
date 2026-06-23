import React, { useState, useEffect } from "react";
import { Users, TrendingUp, Award, Clock, BookOpen, CheckCircle } from "lucide-react";
import { getStudentAnalytics } from "@/services/analytics.service";
import { IStudentAnalytics } from "@/types";

export const StudentAnalytics: React.FC = () => {
  const [analytics, setAnalytics] = useState<IStudentAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const response = await getStudentAnalytics();
        if (response.data) {
          setAnalytics(response.data);
        }
      } catch (error) {
        console.error('Failed to fetch student analytics:', error);
        // Use fallback data in case of error
        setAnalytics({
          totalStudents: { value: 0, trend: { value: 0, direction: 'stable' } },
          activeStudents: { value: 0, trend: { value: 0, direction: 'stable' } },
          onLeaveStudents: { value: 0, trend: { value: 0, direction: 'stable' } },
          avgStudyTime: { value: 0, trend: { value: 0, direction: 'stable' }, unit: 'hours' },
          completionRate: { value: 0, trend: { value: 0, direction: 'stable' }, unit: 'percent' },
          performanceDistribution: {
            excellent: { range: '90-100%', count: 0, percentage: 0 },
            good: { range: '80-89%', count: 0, percentage: 0 },
            average: { range: '70-79%', count: 0, percentage: 0 },
            poor: { range: '60-69%', count: 0, percentage: 0 },
            failing: { range: 'Below 60%', count: 0, percentage: 0 }
          },
          topPerformers: [],
          mostActiveLearners: [],
          recentActivity: [],
          engagementTrends: [],
          activeStudentPercentage: 0,
          averageCoursesPerStudent: 0
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

  const formatLastActive = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays} day${diffInDays === 1 ? '' : 's'} ago`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#3363AD] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading CHW analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 mb-1">CHW Analytics</h1>
        <p className="text-xs text-gray-600">Track CHW progress, performance, and engagement metrics</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-600">Total CHWs</span>
            <div className="w-9 h-9 rounded-lg bg-[#3363AD]/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-[#3363AD]" />
            </div>
          </div>
          <div className="text-xl font-bold text-gray-900">{analytics?.totalStudents?.value?.toLocaleString() || 0}</div>
          {analytics?.totalStudents && getTrendDisplay(analytics.totalStudents.trend)}
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-600">Active CHWs</span>
            <div className="w-9 h-9 rounded-lg bg-[#3363AD]/10 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-[#3363AD]" />
            </div>
          </div>
          <div className="text-xl font-bold text-gray-900">{analytics?.activeStudents?.value?.toLocaleString() || 0}</div>
          {analytics?.activeStudents && (
            <div className="text-[10px] text-[#3363AD] mt-1 font-medium">
              {analytics?.activeStudentPercentage || 0}% of total
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-600">Avg Study Time</span>
            <div className="w-9 h-9 rounded-lg bg-[#3363AD]/10 flex items-center justify-center">
              <Clock className="w-4 h-4 text-[#3363AD]" />
            </div>
          </div>
          <div className="text-xl font-bold text-gray-900">
            {analytics?.avgStudyTime?.value?.toFixed(1) || 0}{analytics?.avgStudyTime?.unit === 'hours' ? 'h' : ''}
          </div>
          {analytics?.avgStudyTime && getTrendDisplay(analytics.avgStudyTime.trend)}
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-600">Completion Rate</span>
            <div className="w-9 h-9 rounded-lg bg-[#3363AD]/10 flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-[#3363AD]" />
            </div>
          </div>
          <div className="text-xl font-bold text-gray-900">
            {analytics?.completionRate?.value?.toFixed(1) || 0}%
          </div>
          {analytics?.completionRate && getTrendDisplay(analytics.completionRate.trend)}
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">CHW Engagement Trends</h3>
          {analytics?.engagementTrends && analytics.engagementTrends.length > 0 ? (
            <div className="h-56">
              {(() => {
                const maxActivity = Math.max(...analytics.engagementTrends.map(t => t.activity));
                return (
                  <div className="h-full flex items-end justify-between gap-2 px-2">
                    {analytics.engagementTrends.map((trend, index) => {
                      const barHeight = maxActivity > 0 ? (trend.activity / maxActivity) * 180 : 0;
                      return (
                        <div key={index} className="flex-1 flex flex-col items-center">
                          <div className="w-full flex flex-col items-center mb-2">
                            <span className="text-[10px] font-medium text-gray-900 mb-1">
                              {trend.activity}
                            </span>
                            <div
                              className="w-full bg-gradient-to-t from-[#3363AD] to-[#3363AD]/70 rounded-t-lg transition-all duration-700 ease-out hover:from-[#3363AD] hover:to-[#3363AD]/90 cursor-pointer shadow-sm"
                              style={{ 
                                height: `${barHeight}px`,
                                minHeight: trend.activity > 0 ? '8px' : '0px'
                              }}
                            />
                          </div>
                          <span className="text-[10px] text-gray-600 text-center leading-tight">
                            {trend.date}
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
                <TrendingUp className="w-10 h-10 mx-auto mb-2 text-gray-400" />
                <p className="text-xs">No engagement trend data available</p>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Performance Distribution</h3>
          {analytics?.performanceDistribution ? (
            <div className="space-y-3">
              {Object.entries(analytics.performanceDistribution).map(([key, item]) => {
                const colorMap: { [key: string]: string } = {
                  excellent: "bg-[#3363AD]",
                  good: "bg-[#3363AD]/80",
                  average: "bg-[#3363AD]/60",
                  poor: "bg-[#3363AD]/40",
                  failing: "bg-red-500"
                };
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-700">{item.range}</span>
                      <span className="text-xs text-gray-500">
                        {item.count} ({item.percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div
                        className={`${colorMap[key]} h-1.5 rounded-full transition-all duration-500`}
                        style={{ width: `${item.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center h-56 bg-gray-50 rounded">
              <div className="text-center text-gray-500">
                <CheckCircle className="w-10 h-10 mx-auto mb-2 text-gray-400" />
                <p className="text-xs">No performance data available</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Top Performers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#3363AD]/10 flex items-center justify-center">
              <Award className="w-4 h-4 text-[#3363AD]" />
            </div>
            Top Performers
          </h3>
          <div className="space-y-2">
            {analytics?.topPerformers && analytics.topPerformers.length > 0 ? (
              analytics.topPerformers.slice(0, 5).map((student, index) => (
                <div key={student.id} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg">
                  <div className="flex-shrink-0 w-7 h-7 bg-[#3363AD] text-white rounded-full flex items-center justify-center font-semibold text-xs">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 text-xs truncate">{student.name}</div>
                    <div className="text-[10px] text-gray-500">
                      {student.completedCourses} completed • Avg: {student.avgScore.toFixed(1)}% • {student.certificates} certs
                    </div>
                    <div className="text-[10px] text-[#3363AD]">
                      {student.district}, {student.sector}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-6 text-gray-500">
                <Award className="w-10 h-10 mx-auto mb-2 text-gray-400" />
                <p className="text-xs">No top performers data available</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#3363AD]/10 flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-[#3363AD]" />
            </div>
            Most Active Learners
          </h3>
          <div className="space-y-2">
            {analytics?.mostActiveLearners && analytics.mostActiveLearners.length > 0 ? (
              analytics.mostActiveLearners.slice(0, 5).map((student) => (
                <div key={student.id} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 text-xs truncate">{student.name}</div>
                    <div className="text-[10px] text-gray-500">
                      {student.studyHours.toFixed(1)}h study • {student.activeCourses} active courses
                    </div>
                    <div className="text-[10px] text-[#3363AD]">
                      {student.district}, {student.sector}
                    </div>
                  </div>
                  <div className="text-[10px] text-gray-400 shrink-0">{formatLastActive(student.lastActive)}</div>
                </div>
              ))
            ) : (
              <div className="text-center py-6 text-gray-500">
                <BookOpen className="w-10 h-10 mx-auto mb-2 text-gray-400" />
                <p className="text-xs">No active learners data available</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Recent CHW Activity</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-3 text-[10px] font-semibold text-gray-700 uppercase tracking-wide">CHW Name</th>
                <th className="text-left py-2 px-3 text-[10px] font-semibold text-gray-700 uppercase tracking-wide">Course</th>
                <th className="text-left py-2 px-3 text-[10px] font-semibold text-gray-700 uppercase tracking-wide">Progress</th>
                <th className="text-left py-2 px-3 text-[10px] font-semibold text-gray-700 uppercase tracking-wide">Last Activity</th>
                <th className="text-left py-2 px-3 text-[10px] font-semibold text-gray-700 uppercase tracking-wide">Status</th>
                <th className="text-left py-2 px-3 text-[10px] font-semibold text-gray-700 uppercase tracking-wide">Location</th>
              </tr>
            </thead>
            <tbody>
              {analytics?.recentActivity && analytics.recentActivity.length > 0 ? (
                analytics.recentActivity.slice(0, 10).map((item) => (
                  <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-3 text-xs font-medium text-gray-900">{item.studentName}</td>
                    <td className="py-2 px-3 text-xs text-gray-600" title={item.courseName}>
                      <div className="max-w-xs truncate">{item.courseName}</div>
                    </td>
                    <td className="py-2 px-3 text-xs text-gray-600">
                      <div className="flex items-center gap-1.5">
                        <div className="w-20 bg-gray-200 rounded-full h-1">
                          <div
                            className="bg-[#3363AD] h-1 rounded-full transition-all duration-300"
                            style={{ width: `${item.progress}%` }}
                          ></div>
                        </div>
                        <span className="text-[10px]">{item.progress}%</span>
                      </div>
                    </td>
                    <td className="py-2 px-3 text-xs text-gray-600">{formatLastActive(item.lastActivity)}</td>
                    <td className="py-2 px-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          item.status === "Completed"
                            ? "bg-[#3363AD]/10 text-[#3363AD]"
                            : "bg-[#3363AD]/10 text-[#3363AD]"
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-[10px] text-gray-500">
                      {item.district}, {item.sector}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-gray-500 text-xs">
                    No recent activity data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Additional Summary */}
        {analytics && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-xl font-bold text-gray-900">{analytics.averageCoursesPerStudent}</div>
                <div className="text-xs text-gray-600">Average Courses per CHW</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-gray-900">{analytics.activeStudentPercentage}%</div>
                <div className="text-xs text-gray-600">CHW Activity Rate</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentAnalytics;
