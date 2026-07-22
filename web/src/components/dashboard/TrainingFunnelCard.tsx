import React, { useState } from "react";
import { Card } from "@/components/common/Card";
import { ICoursePerformance } from "@/types";
import { GitMerge } from "lucide-react";

interface TrainingFunnelCardProps {
  courses: ICoursePerformance[];
}

export const TrainingFunnelCard: React.FC<TrainingFunnelCardProps> = ({ courses }) => {
  const [selectedCourseId, setSelectedCourseId] = useState<string>(
    courses && courses.length > 0 ? courses[0].id : ""
  );

  if (!courses || courses.length === 0) {
    return (
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <GitMerge size={20} className="text-[#3363AD]" />
          <h3 className="text-lg font-semibold text-gray-800">Training Funnel</h3>
        </div>
        <div className="flex items-center justify-center h-40">
          <p className="text-gray-500 text-sm">No data available</p>
        </div>
      </Card>
    );
  }

  const selectedCourse = courses.find(c => c.id === selectedCourseId) || courses[0];

  const steps = [
    { label: "Enrolled", value: selectedCourse.enrolled, color: "#3363AD" },
    { label: "In Progress", value: selectedCourse.inProgress, color: "#5B86C4" },
    { label: "Completed", value: selectedCourse.completed, color: "#799DCD" },
    { label: "Certified", value: selectedCourse.certified, color: "#A1BCE0" },
  ];

  return (
    <Card>
      <div className="flex items-center gap-2 mb-4">
        <GitMerge size={20} className="text-[#3363AD]" />
        <h3 className="text-lg font-semibold text-gray-800">Training Funnel</h3>
      </div>

      {courses.length > 1 && (
        <select
          value={selectedCourseId}
          onChange={(e) => setSelectedCourseId(e.target.value)}
          className="text-sm border border-gray-200 rounded-md px-2 py-1 text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-[#3363AD] mb-4 w-full"
        >
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.name}
            </option>
          ))}
        </select>
      )}

      <div className="space-y-3">
        {steps.map((step, index) => {
          const max = selectedCourse.enrolled;
          const percentage = max > 0 ? (step.value / max) * 100 : 0;

          return (
            <div key={index} className="flex items-center gap-3">
              <span className="w-28 text-sm text-gray-600 shrink-0">{step.label}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-2.5">
                <div
                  className="h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${percentage}%`, background: step.color }}
                />
              </div>
              <span className="w-10 text-sm font-medium text-gray-700 text-right shrink-0">
                {step.value}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
};

