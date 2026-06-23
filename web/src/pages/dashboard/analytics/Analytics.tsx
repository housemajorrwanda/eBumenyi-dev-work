import React from "react";
import { Outlet, useLocation, Link } from "react-router-dom";
import { BookOpen, Users } from "lucide-react";

export const Analytics: React.FC = () => {
  const location = useLocation();
  const isRootAnalytics = location.pathname === "/analytics";

  if (isRootAnalytics) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Analytics Overview</h1>
          <p className="text-gray-600">Select an analytics category to view detailed insights</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Course Analytics Card */}
          <Link
            to="/analytics/courses"
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow border-l-4 border-blue-500"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <BookOpen className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Course Analytics</h3>
                <p className="text-sm text-gray-600">
                  View detailed statistics and insights about course performance, completion rates, and engagement metrics.
                </p>
              </div>
            </div>
          </Link>

          {/* Student Analytics Card */}
          <Link
            to="/analytics/student"
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow border-l-4 border-green-500"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <Users className="w-6 h-6 text-green-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">CHW Analytics</h3>
                <p className="text-sm text-gray-600">
                  Track CHW progress, performance metrics, and engagement levels across all courses.
                </p>
              </div>
            </div>
          </Link>
        </div>
      </div>
    );
  }

  return <Outlet />;
};

export default Analytics;
