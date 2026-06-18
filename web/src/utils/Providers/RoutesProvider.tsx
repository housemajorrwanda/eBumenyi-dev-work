import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { ProtectedRoute } from "@/components/common/ProtectedRoute";
import { Navigate } from "react-router-dom";
import ErrorPage from "@/pages/ErrorPage";
import AdminLayout from "@/pages/Layout";
import LearningLayout from "@/components/layouts/LearningLayout";
import NotFound from "@/pages/NotFound";
import { Dashboard } from "@/pages/dashboard/Dashboard";
import { MyCourses } from "@/pages/dashboard/MyCourses";
import { Messaging } from "@/pages/dashboard/Messaging";
import { Staff } from "@/pages/dashboard/Staff";
import { Feedbacks } from "@/pages/dashboard/Feedbacks";
import Certificates from "@/pages/dashboard/CertificatesManagement";
import MyCertificates from "@/pages/dashboard/MyCertificates";
import CertificateDesignEditor from "@/pages/dashboard/CertificateDesignEditor";
import { Settings } from "@/pages/dashboard/Settings";
import { Analytics } from "@/pages/dashboard/analytics/Analytics";
import { CourseAnalytics } from "@/pages/dashboard/analytics/CourseAnalytics";
import { StudentAnalytics } from "@/pages/dashboard/analytics/StudentAnalytics";
import { Login } from "@/pages/auth/Login";
import { Signup } from "@/pages/auth/Signup";
import { ForgotPassword } from "@/pages/auth/ForgotPassword";
import { ResetPassword } from "@/pages/auth/ResetPassword";
import { Terms } from "@/pages/auth/Terms";
import CoursesPage from "@/pages/dashboard/Courses";
import NewCoursePage from "@/components/courses/NewCoursePage";
import NewCoursesBuilder from "@/pages/dashboard/NewCoursesBuilder";
import StudentsPage from "@/pages/dashboard/Students";
import StudentActivityPage from "@/components/students/StudentActivityPage";
import Calendar from "@/pages/dashboard/Calender";
import MeetingRecordings from "@/pages/dashboard/MeetingRecordings";
import WatchRecordings from "@/pages/dashboard/WatchRecordings";
import Help from "@/pages/dashboard/Help";
import Hospitals from "@/pages/dashboard/Hospitals";
import Announcement from "@/pages/dashboard/Announcement";
import NotificationsPage from "@/pages/dashboard/NotificationsPage";
import CourseCatalog from "@/pages/dashboard/CourseCatalog";
import CourseLearner from "@/pages/dashboard/CourseLearner";
import PreTest from "@/pages/dashboard/PreTest";
import MidTest from "@/pages/dashboard/MidTest";
import FinalTestPage from "@/pages/dashboard/FinalTestPage";
import CHOGroupPage from "@/pages/dashboard/CHOGroup";
import CHOGroupInvitePage from "@/pages/dashboard/CHOGroupInvite";
import AdminCHOGroupDetailPage from "@/pages/dashboard/AdminCHOGroupDetail";
import VerifyCertificate from "@/pages/VerifyCertificate";

const RoutesProvider = () => {
  const router = createBrowserRouter([
    {
      path: "/",
      element: (
        <ProtectedRoute allowedRoles={["ADMIN", "TRAINEE", "TRAINER", "DEVELOPER",  "STAFF", "CHO"]}>
          <AdminLayout />
        </ProtectedRoute>
      ),
      errorElement: <ErrorPage />,
      children: [
        {
          index: true,
          element: <Dashboard />,
        },
        {
          path: "analytics",
          element: (
            <ProtectedRoute
              allowedRoles={["ADMIN", "TRAINER", "DEVELOPER"]}
              allowedIndustries={["SFH", "WELTEL", "RBC"]}
            >
              <Analytics />
            </ProtectedRoute>
          ),
          children: [
            {
              path: "courses",
              element: <CourseAnalytics />,
            },
            {
              path: "student",
              element: <StudentAnalytics />,
            },
          ],
        },
        {
          path: "courses",
          element: (
            <ProtectedRoute
              allowedRoles={["ADMIN", "TRAINER", "DEVELOPER"]}
              allowedIndustries={["SFH", "WELTEL", "RBC"]}
            >
              <CoursesPage />
            </ProtectedRoute>
          ),
        },
        {
          path: "courses/new",
          element: (
            <ProtectedRoute allowedRoles={["ADMIN", "TRAINER", "DEVELOPER"]}>
              <NewCoursePage />
            </ProtectedRoute>
          ),
        },
        {
          path: "courses/edit/:id",
          element: (
            <ProtectedRoute allowedRoles={["ADMIN", "TRAINER", "DEVELOPER"]}>
              <NewCoursePage />
            </ProtectedRoute>
          ),
        },
        {
          path: "messaging",
          element: (
            <ProtectedRoute
              allowedRoles={["ADMIN", "TRAINEE", "TRAINER", "DEVELOPER", "CHO", "STAFF"]}
            >
              <Messaging />
            </ProtectedRoute>
          ),
        },
        {
          path: "my-learning",
          element: (
            <ProtectedRoute allowedRoles={["TRAINEE", "CHO"]}>
              <MyCourses />
            </ProtectedRoute>
          ),
        },
        {
          path: "course-catalog",
          element: (
            <ProtectedRoute allowedRoles={["TRAINEE", "CHO"]}>
              <CourseCatalog />
            </ProtectedRoute>
          ),
        },
        {
          path: "students",
          element: (
            <ProtectedRoute
              allowedRoles={["ADMIN", "TRAINER","DEVELOPER"]}
            >
              <StudentsPage />
            </ProtectedRoute>
          ),
        },
        {
          path: "students/:id",
          element: (
            <ProtectedRoute
              allowedRoles={["ADMIN", "TRAINER", "DEVELOPER", "CHO"]}
            >
              <StudentActivityPage />
            </ProtectedRoute>
          ),
        },
        {
          path: "staff",
          element: (
            <ProtectedRoute
              allowedRoles={["ADMIN","DEVELOPER"]}
            >
              <Staff />
            </ProtectedRoute>
          ),
        },
        {
          path: "feedbacks",
          element: (
            <ProtectedRoute
              allowedRoles={["ADMIN", "TRAINER","DEVELOPER"]}
            >
              <Feedbacks />
            </ProtectedRoute>
          ),
        },
        {
          path: "my-certificates",
          element: (
            <ProtectedRoute allowedRoles={["TRAINEE", "CHO"]}>
              <MyCertificates />
            </ProtectedRoute>
          ),
        },
        {
          path: "certificates",
          element: (
            <ProtectedRoute
              allowedRoles={["TRAINER", "ADMIN", "DEVELOPER"]}
            >
              <Certificates />
            </ProtectedRoute>
          ),
        },
        {
          path: "calender",
          element: <Calendar />,
        },
        {
          path: "recordings",
          element: (
            <ProtectedRoute allowedRoles={["ADMIN", "ADMINISTRATOR"]}>
              <MeetingRecordings />
            </ProtectedRoute>
          ),
        },
        {
          path: "recordings/watch",
          element: (
            <ProtectedRoute allowedRoles={["TRAINEE", "CHO"]}>
              <WatchRecordings />
            </ProtectedRoute>
          ),
        },
        {
          path: "settings",
          element: <Settings />,
        },
        {
          path: "help",
          element: <Help />,
        },
        {
          path: "hospitals",
          element: (
            <ProtectedRoute
              allowedRoles={["ADMIN", "TRAINER", "DEVELOPER"]}
              allowedIndustries={["SFH", "RBC"]}
            >
              <Hospitals />
            </ProtectedRoute>
          ),
        },
        {
          path: "announcement",
          element: <Announcement />,
        },
        {
          path: "notifications",
          element: <NotificationsPage />,
        },
        {
          path: "cho-group",
          element: (
            <ProtectedRoute allowedRoles={["CHO"]}>
              <CHOGroupPage />
            </ProtectedRoute>
          ),
        },
        {
          path: "cho-group/invite",
          element: (
            <ProtectedRoute allowedRoles={["CHO"]}>
              <CHOGroupInvitePage />
            </ProtectedRoute>
          ),
        },
        {
          path: "admin/cho-groups",
          element: <Navigate to="/students" replace />,
        },
        {
          path: "admin/cho-groups/:id",
          element: (
            <ProtectedRoute allowedRoles={["ADMIN", "STAFF"]}>
              <AdminCHOGroupDetailPage />
            </ProtectedRoute>
          ),
        },
      ],
    },

    // ── Certificate builder (no sidebar, full-screen editor) ─────────
    {
      path: "/certificates/design",
      element: (
        <ProtectedRoute allowedRoles={["TRAINER", "ADMIN", "DEVELOPER"]}>
          <div className="h-screen overflow-hidden">
            <CertificateDesignEditor />
          </div>
        </ProtectedRoute>
      ),
    },
    {
      path: "/certificates/design/:id",
      element: (
        <ProtectedRoute allowedRoles={["TRAINER", "ADMIN", "DEVELOPER"]}>
          <div className="h-screen overflow-hidden">
            <CertificateDesignEditor />
          </div>
        </ProtectedRoute>
      ),
    },

    // ── Course builder (no sidebar, full-screen editor) ───────────────
    {
      path: "/courses/builder",
      element: (
        <ProtectedRoute allowedRoles={["ADMIN", "TRAINER", "DEVELOPER"]}>
          <div className="h-screen overflow-hidden">
            <NewCoursesBuilder />
          </div>
        </ProtectedRoute>
      ),
    },

    // ── Immersive learning layout (no sidebar) ────────────────────────
    {
      element: (
        <ProtectedRoute allowedRoles={["TRAINEE", "CHO"]}>
          <LearningLayout />
        </ProtectedRoute>
      ),
      children: [
        {
          path: "/learn/:courseId",
          element: <CourseLearner />,
        },
        {
          path: "/learn/:courseId/pre-test",
          element: <PreTest />,
        },
        {
          path: "/learn/:courseId/mid-test/:midTestId",
          element: <MidTest />,
        },
        {
          path: "/learn/:courseId/final-test/:testId",
          element: <FinalTestPage mode="finalTest" />,
        },
        {
          path: "/learn/:courseId/final-exam/:testId",
          element: <FinalTestPage mode="finalExam" />,
        },
      ],
    },

    {
      path: "/auth/login",
      element: <Login />,
      errorElement: <ErrorPage />,
    },
    {
      path: "/auth/signup",
      element: <Signup />,
      errorElement: <ErrorPage />,
    },
    {
      path: "/auth/forgot-password",
      element: <ForgotPassword />,
      errorElement: <ErrorPage />,
    },
    {
      path: "/auth/reset-password",
      element: <ResetPassword />,
      errorElement: <ErrorPage />,
    },
    {
      path: "/terms",
      element: <Terms />,
      errorElement: <ErrorPage />,
    },
    {
      path: "/verify/:code",
      element: <VerifyCertificate />,
      errorElement: <ErrorPage />,
    },
    {
      path: "/auth",
      element: <Navigate to="/auth/login" replace />,
    },
    {
      path: "*",
      element: <NotFound />,
      errorElement: <ErrorPage />,
    },
  ]);
  return <RouterProvider router={router} />;
};

export default RoutesProvider;
