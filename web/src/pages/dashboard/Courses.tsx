import { useState, useMemo } from "react";
import { LuCirclePlus } from "react-icons/lu";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { BookOpen, Users, Star, FileText } from "lucide-react";
import FilterTabs, { TabItem } from "@/components/ui/FilterTabs";
import CourseList from "@/components/courses/CourseList";
import CreateCourseModal from "@/components/courseBuilder/CreateCourseModal";
import { CourseCreationForm } from "@/types/courseBuilder.d";
import { createCourse, getAllCoursesNoPagination, getAllCoursesStats, uploadImage as uploadCourseImage } from "@/services/course.service";
import { uploadImage } from "@/services/uploader.api";
import { courseKeys } from "@/utils/constants/queryKeys";
import type { ICourse } from "@/types";

type CreatedCourseDraft = {
  id: string;
  title: string;
  description?: string;
  coverIcon: string;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
};

type SuperCourseCreateResponse = {
  statusCode: number;
  message: string;
  data?: { course?: CreatedCourseDraft };
};

const CoursesPage = () => {
  const [selectedTab, setSelectedTab] = useState("all");
  const [showCourseBuilderModal, setShowCourseBuilderModal] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const tabItems: TabItem[] = [
    { key: "all", label: "All" },
    { key: "published", label: "Published" },
    { key: "draft", label: "Draft" },
  ];

  const getFilterString = (tabKey: string) => {
    if (tabKey === "published") return "published";
    if (tabKey === "draft") return "draft";
    return "all";
  };

  // Fetch accurate counts from dedicated stats endpoint
  const { data: courseStatsRes } = useQuery({
    queryKey: [...courseKeys.all, "dashboard-stats"],
    queryFn: () => getAllCoursesStats(),
  });

  // Fetch all courses for enrolled / avgRating aggregation
  const { data: allCoursesRes } = useQuery({
    queryKey: [...courseKeys.all, "all-no-pagination"],
    queryFn: () => getAllCoursesNoPagination(),
  });

  const stats = useMemo(() => {
    const total = courseStatsRes?.data?.totalCourses?.value ?? 0;
    const draft = courseStatsRes?.data?.unpublishedCourses?.value ?? 0;
    const published = Math.max(0, total - draft);
    const courses = (allCoursesRes?.data as ICourse[]) ?? [];
    const enrolled = courses.reduce((sum, c) => sum + (c.progresses?.length || 0), 0);
    const avgRating =
      courses.length > 0
        ? courses.reduce((sum, c) => sum + (c.rating || 0), 0) / courses.length
        : 0;
    return { total, published, draft, enrolled, avgRating };
  }, [courseStatsRes, allCoursesRes]);

  const createCourseMutation = useMutation({ mutationFn: createCourse });

  const uploadCoverIconIfNeeded = async (coverIcon: string): Promise<string> => {
    if (!coverIcon.startsWith("data:image/")) return coverIcon;
    const response = await fetch(coverIcon);
    const blob = await response.blob();
    const ext = blob.type.split("/")[1] || "png";
    const file = new File([blob], `course-icon-${Date.now()}.${ext}`, { type: blob.type });
    const uploadResponse = await uploadImage(file);
    if (!uploadResponse.data?.url) throw new Error("Failed to upload course icon");
    return uploadResponse.data.url;
  };

  const handleCourseBuilderSubmit = async (formData: CourseCreationForm) => {
    try {
      const coverIconUrl = await uploadCoverIconIfNeeded(formData.coverIcon);
      const response = (await createCourseMutation.mutateAsync({
        title: formData.title.trim(),
        description: formData.description.trim(),
        coverIcon: coverIconUrl,
        isPublished: false,
        courseIntro: {
          title: formData.title.trim(),
          summary: formData.description.trim(),
          bannerImage: coverIconUrl,
          thumbnail: coverIconUrl,
        },
        sections: [],
      })) as SuperCourseCreateResponse;

      const createdCourse = response.data?.course;
      if (!createdCourse?.id) throw new Error("Course was created but no course ID was returned");

      await queryClient.invalidateQueries({ queryKey: courseKeys.all });
      setShowCourseBuilderModal(false);
      toast.success("Draft course created");
      navigate("/courses/builder", {
        state: { courseForm: { ...formData, coverIcon: coverIconUrl }, createdCourse },
      });
    } catch (error) {
      const errorMessage =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to create course";
      toast.error(errorMessage);
    }
  };

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Courses</h2>
            <p className="text-sm text-gray-500 mt-0.5">Manage and distribute your learning content</p>
          </div>
          <button
            type="button"
            onClick={() => setShowCourseBuilderModal(true)}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-medium text-white hover:bg-[#2B5493] transition"
          >
            <LuCirclePlus className="text-xl" />
            New Course
          </button>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-5 gap-4">
          <StatCard
            label="Total Courses"
            value={stats.total}
            color="text-gray-900"
            icon={<BookOpen className="w-5 h-5 text-gray-400" />}
          />
          <StatCard
            label="Published"
            value={stats.published}
            color="text-green-600"
            icon={<FileText className="w-5 h-5 text-green-400" />}
            sub="Live courses"
          />
          <StatCard
            label="Draft"
            value={stats.draft}
            color="text-yellow-600"
            icon={<FileText className="w-5 h-5 text-yellow-400" />}
            sub="Not published"
          />
          <StatCard
            label="Total Enrolled"
            value={stats.enrolled}
            color="text-primary"
            icon={<Users className="w-5 h-5 text-blue-400" />}
            sub="Across all courses"
          />
          <StatCard
            label="Avg. Rating"
            value={stats.total > 0 ? stats.avgRating.toFixed(1) : "—"}
            color="text-yellow-500"
            icon={<Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />}
            sub="Out of 5"
          />
        </div>

        {/* Filters */}
        <FilterTabs
          items={tabItems}
          activeTab={selectedTab}
          onTabChange={setSelectedTab}
          variant="default"
        />

        <CourseList hideHeader={true} filter={getFilterString(selectedTab)} />
      </div>

      <CreateCourseModal
        isOpen={showCourseBuilderModal}
        onClose={() => setShowCourseBuilderModal(false)}
        onSubmit={handleCourseBuilderSubmit}
      />
    </>
  );
};

function StatCard({
  label,
  value,
  color,
  icon,
  sub,
}: {
  label: string;
  value: number | string;
  color: string;
  icon?: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-1">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
        {icon}
      </div>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

export default CoursesPage;
