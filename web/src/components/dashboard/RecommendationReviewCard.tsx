import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/common/Card";
import { getRecommendationInsights } from "@/services/analytics.service";
import type {
  IRecommendedChapterInsight,
  IStudentRecommendationInsight,
  RecommendationInsightReason,
} from "@/types";
import { BookMarked } from "lucide-react";

const REASON_LABELS: Record<RecommendationInsightReason, string> = {
  below_pass: "Below pass",
  no_attempt: "No mid-test",
  barely_passed: "Barely passed",
  fast_pace_review: "Rushed",
  incomplete_slides: "Slides incomplete",
};

function ChapterTable({ rows }: { rows: IRecommendedChapterInsight[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-xs text-gray-500 py-3 text-center">
        No chapters flagged yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="text-gray-500 border-b border-gray-100">
            <th className="pb-2 font-medium">Chapter</th>
            <th className="pb-2 font-medium text-right">Count</th>
            <th className="pb-2 font-medium hidden sm:table-cell">Reason</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 5).map((row) => (
            <tr key={row.chapterId} className="border-b border-gray-50 last:border-0">
              <td className="py-2 pr-2">
                <p className="font-medium text-gray-800 truncate max-w-[140px]">
                  Ch. {row.chapterNumber} · {row.chapterTitle}
                </p>
                <p className="text-gray-500 truncate max-w-[140px]">{row.courseTitle}</p>
              </td>
              <td className="py-2 text-right font-semibold text-gray-900 tabular-nums">
                {row.recommendationCount}
              </td>
              <td className="py-2 text-gray-600 hidden sm:table-cell">
                {REASON_LABELS[row.topReason]}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StudentTable({
  rows,
  onOpenStudent,
}: {
  rows: IStudentRecommendationInsight[];
  onOpenStudent: (id: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-xs text-gray-500 py-3 text-center">
        No CHWs flagged yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="text-gray-500 border-b border-gray-100">
            <th className="pb-2 font-medium">CHW</th>
            <th className="pb-2 font-medium text-right">Chapters</th>
            <th className="pb-2 font-medium text-right hidden sm:table-cell">Courses</th>
            <th className="pb-2 font-medium text-right"> </th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 5).map((row) => (
            <tr key={row.studentId} className="border-b border-gray-50 last:border-0">
              <td className="py-2 pr-2 font-medium text-gray-800 truncate max-w-[120px]">
                {row.studentName}
              </td>
              <td className="py-2 text-right font-semibold text-gray-900 tabular-nums">
                {row.totalRecommendations}
              </td>
              <td className="py-2 text-right text-gray-600 tabular-nums hidden sm:table-cell">
                {row.coursesAffected}
              </td>
              <td className="py-2 text-right">
                <button
                  type="button"
                  onClick={() => onOpenStudent(row.studentId)}
                  className="text-[#3363AD] hover:underline font-medium"
                >
                  View
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const RecommendationReviewCard: React.FC = () => {
  const navigate = useNavigate();
  const [chapters, setChapters] = useState<IRecommendedChapterInsight[]>([]);
  const [students, setStudents] = useState<IStudentRecommendationInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getRecommendationInsights()
      .then((res) => {
        if (cancelled) return;
        setChapters(res.data.mostRecommendedChapters);
        setStudents(res.data.studentsWithMostRecommendations);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const empty = !loading && !failed && chapters.length === 0 && students.length === 0;

  return (
    <Card>
      <div className="flex items-center gap-2 mb-3">
        <BookMarked size={20} className="text-[#3363AD]" />
        <h3 className="text-lg font-semibold text-gray-800">Review recommendations</h3>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        Chapters and trainees flagged after course completion.
      </p>

      {loading && (
        <div className="space-y-3 animate-pulse">
          <div className="h-3 bg-gray-100 rounded w-full" />
          <div className="h-3 bg-gray-100 rounded w-4/5" />
          <div className="h-3 bg-gray-100 rounded w-3/5" />
        </div>
      )}

      {failed && (
        <p className="text-sm text-gray-500 py-8 text-center">
          Could not load recommendations.
        </p>
      )}

      {empty && (
        <p className="text-sm text-gray-500 py-8 text-center">
          Nothing flagged yet. Data shows once trainees finish courses and attempt final exams.
        </p>
      )}

      {!loading && !failed && !empty && (
        <div className="space-y-5 max-h-[280px] overflow-y-auto pr-1">
          <div>
            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
              Top chapters
            </p>
            <ChapterTable rows={chapters} />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
              Most flagged trainees
            </p>
            <StudentTable rows={students} onOpenStudent={(id) => navigate(`/students/${id}`)} />
          </div>
        </div>
      )}
    </Card>
  );
};
