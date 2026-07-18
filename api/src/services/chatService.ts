import type { ChatMessage } from "./llmAdapter";
import { chat } from "./llmAdapter";
import type { ChatContext } from "./chatTools";
import { getToolsForContext, runTool } from "./chatTools";
import {
  extractCompletionsPeriodsFromQuestion,
  extractCourseTitleForReviewsQuestion,
  extractCourseTitleForPlatformTestAggregates,
  extractGenderForDistrictComparison,
  extractTestPerformanceDemographicsArgs,
  extractStudentNameFromBestCourseQuestion,
  extractStudentNameFromProfileRequest,
  extractStudentNameFromTestPerformanceQuestion,
  extractStudentProgressInCourseNameAndTitle,
  isDistrictPerformanceComparisonQuestion as isStaffDistrictPerformanceComparisonQuestion,
  isDropoutRiskStudentsQuestion as isStaffDropoutRiskQuestion,
  isFlaggedMidTestChaptersQuestion as isStaffFlaggedMidTestChaptersQuestion,
  isInProgressNoCompleteQuestion as isStaffInProgressNoCompleteQuestion,
  isMostFailedQuestionsQuestion as isStaffMostFailedQuestionsQuestion,
  isCompletionsOverTimeQuestion as isStaffCompletionsOverTimeQuestion,
  isPlatformCertificateTotalsQuestion as isStaffPlatformCertificateTotalsQuestion,
  isTopPerformingCoursesQuestion as isStaffTopPerformingCoursesQuestion,
  isNotStartedAnyCourseQuestion as isStaffNotStartedQuestion,
  isPlatformTestAggregatesQuestion as isStaffPlatformTestAggregatesQuestion,
  isTestPerformanceDemographicsQuestion as isStaffTestPerformanceDemographicsQuestion,
  isDashboardStatisticsQuestion as isStaffDashboardStatisticsQuestion,
} from "./chatQuestionMatchers";

/** Max LLM rounds with tool calls per user message. Lower = faster; raise via CHAT_MAX_TOOL_ROUNDS if answers need more steps. */
const MAX_TURN = Math.min(
  8,
  Math.max(1, Number(process.env.CHAT_MAX_TOOL_ROUNDS) || 4),
);

/** Single user-friendly message when we have no answer or a tool fails. */
export const NO_RESPONSE_MESSAGE =
  "I couldn't find an answer to that in the platform data. You can try again?.";

export const RATE_LIMIT_MESSAGE =
  "I'm a bit busy right now, please try again in a few seconds.";

/** When the app cannot connect to the LLM (Ollama stopped, wrong URL, offline API). */
export const LLM_UNREACHABLE_MESSAGE =
  "The assistant can’t reach the AI service right now. try again later.";

function isRateLimitError(e: unknown): boolean {
  return e instanceof Error && e.message.includes("429");
}

function isLlmTimeoutError(e: unknown): boolean {
  return (
    e instanceof Error && e.message.includes("LLM request timed out")
  );
}

function isLlmConnectionError(e: unknown): boolean {
  if (!(e instanceof TypeError)) return false;
  const msg = e.message || "";
  if (!msg.includes("fetch") && msg !== "Failed to fetch") return false;
  const cause = (e as Error & { cause?: { code?: string; errors?: unknown[] } })
    .cause;
  const code = cause?.code;
  if (
    code === "ECONNREFUSED" ||
    code === "ENOTFOUND" ||
    code === "ETIMEDOUT" ||
    code === "UND_ERR_CONNECT_TIMEOUT"
  ) {
    return true;
  }
  // Node fetch failed without a typed cause (still likely connection)
  return msg === "fetch failed" || msg.includes("Failed to fetch");
}

/** Messages that should get a simple reply with no tool calls. */
function isGreetingOrSmallTalk(message: string): boolean {
  const t = message
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/, "");
  const greetings = [
    "hello",
    "hi",
    "hey",
    "hi there",
    "hello there",
    "thanks",
    "thank you",
    "thank you very much",
    "good morning",
    "good afternoon",
    "good evening",
    "good night",
    "how are you",
    "what's up",
    "whats up",
    "sup",
    "yo",
    "bye",
    "goodbye",
    "see you",
    "good day",
  ];
  return greetings.includes(t) || t.length <= 2;
}

function usesRemoteLlm(): boolean {
  const base = process.env.LLM_BASE_URL || "";
  return base.includes("groq.com") || base.includes("railway.app");
}

function systemPromptForChat(ctx: ChatContext, userMessage: string): string {
  if (isGreetingOrSmallTalk(userMessage)) {
    return "You are a friendly assistant for a CHW training platform. Reply with one short warm sentence.";
  }
  if (usesRemoteLlm()) {
    const role = ctx.isStaff
      ? "an admin/instructor with platform analytics tools"
      : "a CHW trainee with access only to their own progress and certificates";
    return `You are a helpful assistant for a CHW training platform. The user is ${role}. Call tools when needed; only report facts returned by tools. Never show SQL, code, or invented numbers. Be warm and concise.`;
  }
  return systemPrompt(ctx);
}

function systemPrompt(ctx: ChatContext): string {
  const role = ctx.isStaff
    ? "instructor or admin; you have get_dashboard_statistics, get_student_analytics, and query_data for custom SQL."
    : "a CHW (trainee); you only have access to this user's own courses, progress, and certificates.";
  return `You are a helpful assistant for a CHW training platform. The user is ${role} Write like a thoughtful colleague: warm, clear, and human — not robotic.

Voice and variety (important — do not sound like a canned report):
- Shuffle your wording across answers: alternate how you open (direct answer first vs one-line context first), how you transition between facts, and how you close (brief offer to dig deeper, nothing, or a human aside). Never lean on one stock phrase every time (e.g. avoid repeating the same opener or sign-off).
- Use a natural, human tone: mix short punchy lines with occasional longer sentences; it is OK to sound pleased, curious, or gently emphatic when the numbers justify it.
- Affirmations and light exclamations are encouraged when they match the data (e.g. "That's solid progress", "Nice — completion is up", "Worth keeping an eye on" for weaker spots). Do not overdo exclamation marks; one per reply at most is plenty.
- Stay specific: tie affirmations to the actual metric you just stated so it never feels generic or hollow.

Action-oriented guidance (after you cite tool data):
- When marks or wrong-answer rates are weak, suggest practical next steps that match the platform: e.g. reviewing the flagged chapter, retrying the mid-test or final test, or repeating key course content — only when those ideas fit the facts you just reported.
- When performance is strong (high marks, high completion, low wrong-answer rate), a brief congratulatory note to the learner or team is appropriate, grounded in the numbers you cited.
- Never invent praise, blame, or suggestions that are not supported by the tool output.

CRITICAL - Data accuracy:
- Tool calls: use each tool's exact registered name only. All inputs belong in the tool's JSON arguments object, never concatenated onto the name.
- Never tell the user how to invoke tools, bash, SQL, or code — execute tools yourself and answer in plain language with the numbers only.
- Never show SQL, \`\`\`sql blocks, or say the request was "converted to a query format". For students who never started any course use get_students_not_started; answer with notStartedCount and total only.
- Never output JavaScript, pseudocode, or "implementation to fetch" stubs. For at-risk or dropout questions call get_students_at_dropout_risk once and describe the atRisk list in plain language (names, courses, progress) using only tool fields.
- Only state facts that appear in the tool response. Never invent or guess numbers, course names (e.g. "Course 1"), percentages, or statistics.
- When you use a tool, report only the numbers/fields it returns (e.g. totalStudents.value, courseTitle, failureRatePercent). Do not add any number or name that is not in the tool's JSON.
- For "how many students", "how many courses", "completion rate" use get_dashboard_statistics and report totalStudents.value, totalCourses.value, completionRate.value.
- For performance, time spent, tests, who is failing/succeeding, averages use get_student_analytics (performanceDistribution, avgStudyTime, completionRate, etc.).
- For how many female or male students use get_students_by_gender (returns female, male, total, unspecified).
- For "which courses do people fail more" use get_course_completion_rates and report from byFailureRate (first items = highest failure). For "which courses do people succeed more", "top performing courses", or "best completion rates" report from byCompletionRate (first items = highest completion). Use only courseTitle and completionRatePercent or failureRatePercent from the response; never invent HTTP, Bearer tokens, or get_course_enrollment_count('top').
- For "do female students perform better than male" or gender performance comparison use get_performance_by_gender. Compare female.completionRatePercent and male.completionRatePercent from the response only.
- For "who are top performing students in [district]" or "best students in [district]" use get_top_performers_by_district with the district name. Report the names and avgScore (and optionally completedCourses) from the returned list. If avgScore is 0, say "no test scores yet" or "0" rather than "null".
- For "which district has high male/female performance" or "districts where students perform better" use get_performance_by_district. Pass gender: "male" or "female" when the user asks about male or female performance; then report the first districts (highest completionRatePercent) from the response.
- For "which course is [person name] performing better in", "doing best in", or "how is [name] doing" (no specific course named) use get_student_progress_by_name with the person's name. Report the first course in the courses list (best progress) and the progressPercent from the response. Never invent JSON keys like coursesGetStudentProgressInCourse.
- For "how is [name] doing in [course]" or "[name] performance in [course]" (both student and course named) use get_student_progress_in_course with name and courseTitle taken from the message. Never show code examples, \`\`\`json, or "here's how to call" — call the tool and state progressPercent, isCompleted, and enrollment date from the response only.
- For "how is enrollment trending", "enrollment over the last 3/6/12 months" use get_enrollment_trend with months 3, 6, or 12. The tool returns: months[].yearMonth (e.g. 2026-03), months[].label (human month), months[].newEnrollments, totalEnrollmentsInWindow (single total count for the window), windowMonths. Summarize in plain sentences only — never output raw JSON, never invent years or months, never rename fields to snake_case, never wrap in made-up keys like enrollment_trend, and totalEnrollmentsInWindow is not an array.
- For "how has performance trended", "performance over the last months", scores/marks trending — NOT enrollment — use get_performance_trend with months 3, 6, or 12. It returns course completions per month, test attempt counts, and averageTestMarks per month. Do not use get_enrollment_trend or invented enrollment_trend JSON for these questions.
- For "which students are at risk", "dropping out", "stalled learners", "who needs follow-up" use get_students_at_dropout_risk. Report atRisk list and criteria from the response.
- For "how does performance compare between districts", "district comparison", "which districts perform best", highest vs lowest completion rate by district: use get_district_performance_comparison (optional gender: male or female). Call the tool and summarize districts from the response — never bash examples, never invented JSON like performanceComparison or gender:false.
- For "average time to complete each course", "how long to finish courses" use get_average_days_to_complete_per_course. Report courseTitle, completedCount, averageDaysToComplete per course.
- For "how many students enrolled in [course]" use get_course_enrollment_count with courseTitle. Report enrollmentCount and completedCount.
- For "in the district where [student name] is, how many other female students" use get_other_female_students_in_student_district with that student's name. Report district, otherFemaleCount (and optionally totalFemaleInDistrict) from the response.
- For "in the district where [student name] is, how many other male students" use get_other_male_students_in_student_district with that student's name. Report district, otherMaleCount from the response.
- For "in the district where [student name] is, how many other students with zero certificate" use get_students_with_zero_certificate_in_student_district with that student's name. Report district and otherStudentsWithZeroCertificate from the response.
- For "how many students have at least one certificate in [district]" always use get_students_with_certificate_by_district with the district name (e.g. Gasabo). Do not use query_data. Report studentCount from the response.
- For total certificates issued platform-wide, or how many certificates learners have received in aggregate (not a specific district): use get_platform_certificate_totals. Report totalCertificatesIssued and studentsWithAtLeastOneCertificate. Never hand-write SQL or invent table names.
- For "how many hours did [student name] spend on [course name]" use get_student_time_on_course with that student's name and the course title; if the user says last week/month/this month/year pass period accordingly. Report estimatedHours and period from the response.
- For questions we have no tool for, respond with the friendly no-answer message; do not guess or use unrelated tool data.
- For "how many districts do we have" or "how many districts are our students in" use get_district_count. Report the districtCount from the response.
- For "what are those districts?", "what are the districts?", or "how many students in each district?" use get_students_per_district. It returns a list of { district, studentCount }. Report the district names and/or the count per district from that list only; never invent district names or numbers.
- For "how many sectors", "students per sector", "what are the sectors", or any sector/cell/village question use get_students_per_sector. It returns sectorCount and a list of { sector, studentCount }. Report only from that list.
- For "what courses are we having", "list all courses", "what courses exist", or "how many courses" use list_courses. It returns totalCourses and a list of courses with title, enrollments, completionRatePercent. Report from this list only.
- For "reviews for [course]", "ratings for [course]", "feedback on [course]", learner reviews of a course on this platform: use get_course_reviews with courseTitle from the message. Summarize rating, comment, and names from the tool only. Never claim you lack platform data, never suggest Coursera/edX/Trustpilot/OpenLearn or invented URLs — this app stores CourseReview data in the database.
- For "how many students haven't started" or "students with no activity" use get_students_not_started. Report notStartedCount and total from the response.
- For "in progress but haven't completed any course", "enrolled but no completions yet", or "students currently learning without completing" use get_students_in_progress only — report inProgressCount. Do NOT use get_enrollment_trend for that; enrollment_trend is unrelated.
- For "how many students are in progress" (general) use get_students_in_progress. Report inProgressCount from the response.
- For "how many students finished courses last week", "how many students finished last month", "completions this month", or any question about completions over a time period use get_completions_over_time with the appropriate period: 'last_week', 'last_month', 'this_month', or 'last_year'. For two windows in one message (e.g. last week and this month), call the tool once per period. Report completedCount from the tool only — never Ruby, JavaScript, bash, or "hypothetical" API examples.
- Never respond with raw JSON, YAML, or pseudo API blobs — including invented wrappers like {\"enrollment_trend\": ...}. Always answer in natural language sentences using only values that appear in the tool JSON. Never use placeholder or example dates (e.g. random past years); only the yearMonth and label strings from the tool.
- For "what is the first course that most students spent much time on" or "which course do students spend most time on" use get_courses_by_study_time. Report the first course's courseTitle and estimatedTotalHours (that is the course with most total study time).
- For "how many hours did students spend on [course]", "how much time was spent on [course] this month/last week", or "total study time for [course]" (when NO specific student name is given) use get_course_study_time_all_students with courseTitle and the matching period ('last_week', 'last_month', 'this_month', 'last_year'). Report totalEstimatedHours, studentCount, and optionally the perStudent list from the response.
- For "hardest questions", "most missed questions", "wrong answers by question", questions students fail most: use get_most_failed_questions. Report from mostMissed (questionPreview, wrongRatePercent, courseTitle, chapterTitle). Never output bash or fenced code examples — call the tool and summarize the list.
- For "chapters struggling on mid test", "weak chapters", "mid chapter test performance", flagging low mid-test performance: use get_chapters_flagged_mid_test. Report flaggedChapters and averageMarks vs marksToPass. Do not invent chapter lists or counts.
- For one student's test marks, wrong answers, attempt breakdown: use get_student_test_performance_detail with their name. Never claim you lack access to student records or that you are only a language model without calling this tool first.
- For a full single-student snapshot (demographics + course list + test summary): use get_student_full_profile with the name taken from the user's message. Never ask them to repeat a name they already gave.
- For tests segmented by gender, district, or age range: use get_test_performance_by_demographics (optional gender, district, minAge, maxAge). Report averageMarks, wrongAnswerRatePercent, studentsInSegment. For "students in [district]" or "female/male only" test averages — never get_platform_test_aggregates and never treat the district phrase as a student name.
- For platform-wide (all students) sums/averages on test marks, total wrong answers, min/max marks (optionally for one course): use get_platform_test_aggregates with optional courseTitle — not for a gender or district slice. Never use query_data or hand-written SQL for these — use the tool fields only.
- For average age use query_data with the user's exact question.
- You have access to all staff tools including query_data. Always use the appropriate tool to answer; never say you cannot run a tool, do not have access, or cannot see individual student records when a staff tool applies.

Tool use:
- Do NOT call any tools for greetings or small talk. Reply with one short friendly sentence only.
- If a tool returns an error or you cannot answer from the data, respond with exactly this user-friendly message and nothing else: "I couldn't find an answer to that in the platform data. You can try rephrasing, or ask about things like platform statistics, courses, student progress, or certificates." Do not say "query format was incorrect", "rephrase using correct arguments", or other technical wording.`;
}

type MessageLike = { role: string; content?: string };

function parseArgs(raw: string): Record<string, unknown> {
  if (!raw?.trim()) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * Deterministic copy for get_enrollment_trend so the LLM cannot corrupt types or emit fake JSON.
 * Accepts only the real tool shape: string yearMonth/label, numeric newEnrollments.
 */
function formatEnrollmentTrendReply(toolJson: string): string | null {
  try {
    const d = JSON.parse(toolJson) as {
      months?: unknown;
      totalEnrollmentsInWindow?: unknown;
      windowMonths?: unknown;
      error?: unknown;
    };
    if (d.error != null) return null;
    if (!Array.isArray(d.months) || d.months.length === 0) return null;
    const months: {
      yearMonth: string;
      label: string;
      newEnrollments: number;
    }[] = [];
    for (const m of d.months) {
      if (!m || typeof m !== "object") return null;
      const row = m as Record<string, unknown>;
      if (typeof row.yearMonth !== "string") return null;
      const labelRaw = row.label;
      const label =
        typeof labelRaw === "string" && labelRaw.trim() !== ""
          ? labelRaw.trim()
          : row.yearMonth;
      if (
        typeof row.newEnrollments !== "number" ||
        !Number.isFinite(row.newEnrollments)
      )
        return null;
      months.push({
        yearMonth: row.yearMonth,
        label,
        newEnrollments: row.newEnrollments,
      });
    }
    const windowMonths =
      typeof d.windowMonths === "number" && Number.isFinite(d.windowMonths)
        ? d.windowMonths
        : months.length;
    const totalFromTool =
      typeof d.totalEnrollmentsInWindow === "number" &&
      Number.isFinite(d.totalEnrollmentsInWindow)
        ? d.totalEnrollmentsInWindow
        : months.reduce((s, x) => s + x.newEnrollments, 0);
    const byMonth = months
      .map(
        (m) =>
          `${m.label} (${m.yearMonth}): ${m.newEnrollments} new enrollment${m.newEnrollments === 1 ? "" : "s"}`,
      )
      .join("; ");
    return `Over the last ${windowMonths} month${windowMonths === 1 ? "" : "s"}, new course enrollments by calendar month were: ${byMonth}. Total new enrollments recorded in this period: ${totalFromTool}.`;
  } catch {
    return null;
  }
}

/** Strip ```json fences so we can detect model-hallucinated JSON answers. */
function stripOuterCodeFence(text: string): string {
  const t = text.trim();
  const m = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return m ? m[1].trim() : t;
}

function parseEnrollmentWindowMonthsFromUserMessage(msg: string): number {
  const t = msg.toLowerCase();
  if (/\b12\b|twelve\b|\byear\b|\bone year\b/.test(t)) return 12;
  if (/\b6\b|six\b|\bhalf\b/.test(t) && t.includes("month")) return 6;
  if (/\b3\b|three\b/.test(t) && t.includes("month")) return 3;
  if (t.includes("six month")) return 6;
  if (t.includes("twelve month")) return 12;
  return 3;
}

function isStaffEnrollmentTrendQuestion(msg: string): boolean {
  if (!msg?.trim()) return false;
  const t = msg.toLowerCase();
  if (!t.includes("enroll")) return false;
  if (isStaffPerformanceTrendQuestion(msg)) return false;
  return (
    t.includes("trend") ||
    t.includes("trended") ||
    (t.includes("over the last") && t.includes("month")) ||
    (t.includes("past") &&
      t.includes("month") &&
      (t.includes("how") || t.includes("has")))
  );
}

/** Performance/marks trend over months — not enrollment-only. */
function isStaffPerformanceTrendQuestion(msg: string): boolean {
  if (!msg?.trim()) return false;
  const t = msg.toLowerCase();
  const perf =
    t.includes("performance") ||
    t.includes("performing") ||
    (t.includes("score") && (t.includes("trend") || t.includes("month"))) ||
    (t.includes("marks") && (t.includes("trend") || t.includes("month")));
  if (!perf) return false;
  return (
    t.includes("trend") ||
    t.includes("trended") ||
    (t.includes("over the last") && t.includes("month")) ||
    (t.includes("past") && t.includes("month"))
  );
}

/** Model sometimes answers with JSON instead of calling tools — same shape as our tool. */
function contentLooksLikeEnrollmentTrendPayload(text: string): boolean {
  const raw = stripOuterCodeFence(text);
  try {
    const d = JSON.parse(raw) as { months?: unknown; windowMonths?: unknown };
    return (
      Array.isArray(d.months) &&
      d.months.length > 0 &&
      typeof d.windowMonths === "number"
    );
  } catch {
    return false;
  }
}

async function staffEnrollmentTrendFromDatabase(
  userMessage: string,
  ctx: ChatContext,
): Promise<string | null> {
  if (!ctx.isStaff) return null;
  const months = parseEnrollmentWindowMonthsFromUserMessage(userMessage);
  const result = await runTool("get_enrollment_trend", { months }, ctx);
  return formatEnrollmentTrendReply(result);
}

function formatPerformanceTrendReply(toolJson: string): string | null {
  try {
    const d = JSON.parse(toolJson) as {
      months?: unknown;
      windowMonths?: unknown;
      error?: unknown;
    };
    if (d.error != null) return null;
    if (!Array.isArray(d.months) || d.months.length === 0) return null;
    const rows: {
      yearMonth: string;
      label: string;
      courseCompletions: number;
      testAttempts: number;
      averageTestMarks: number;
    }[] = [];
    for (const m of d.months) {
      if (!m || typeof m !== "object") return null;
      const row = m as Record<string, unknown>;
      if (typeof row.yearMonth !== "string") return null;
      const labelRaw = row.label;
      const label =
        typeof labelRaw === "string" && labelRaw.trim() !== ""
          ? labelRaw.trim()
          : row.yearMonth;
      if (typeof row.courseCompletions !== "number") return null;
      if (typeof row.testAttempts !== "number") return null;
      if (typeof row.averageTestMarks !== "number") return null;
      rows.push({
        yearMonth: row.yearMonth,
        label,
        courseCompletions: row.courseCompletions,
        testAttempts: row.testAttempts,
        averageTestMarks: row.averageTestMarks,
      });
    }
    const windowMonths =
      typeof d.windowMonths === "number" && Number.isFinite(d.windowMonths)
        ? d.windowMonths
        : rows.length;
    const byMonth = rows
      .map(
        (r) =>
          `${r.label} (${r.yearMonth}): ${r.courseCompletions} course completion(s), ${r.testAttempts} test attempt(s), avg mark ${r.averageTestMarks}`,
      )
      .join("; ");
    return `Over the last ${windowMonths} month${windowMonths === 1 ? "" : "s"}, performance indicators by calendar month were: ${byMonth}. (Course completions are counted when a course is marked completed that month; test stats use attempts updated in that month.)`;
  } catch {
    return null;
  }
}

async function staffPerformanceTrendFromDatabase(
  userMessage: string,
  ctx: ChatContext,
): Promise<string | null> {
  if (!ctx.isStaff) return null;
  const months = parseEnrollmentWindowMonthsFromUserMessage(userMessage);
  const result = await runTool("get_performance_trend", { months }, ctx);
  return formatPerformanceTrendReply(result);
}

function looksLikeJsonObject(text: string): boolean {
  const t = stripOuterCodeFence(text);
  return t.startsWith("{") && t.endsWith("}");
}

function formatNotStartedReply(toolJson: string): string | null {
  try {
    const d = JSON.parse(toolJson) as {
      error?: unknown;
      notStartedCount?: unknown;
      total?: unknown;
    };
    if (d.error != null) return null;
    if (typeof d.notStartedCount !== "number" || typeof d.total !== "number")
      return null;
    return `${d.notStartedCount} student${d.notStartedCount === 1 ? "" : "s"} have not started any course (out of ${d.total} students on the platform).`;
  } catch {
    return null;
  }
}

function formatInProgressNoCompleteReply(toolJson: string): string | null {
  try {
    const d = JSON.parse(toolJson) as {
      error?: unknown;
      inProgressCount?: unknown;
    };
    if (d.error != null) return null;
    if (typeof d.inProgressCount !== "number") return null;
    return `${d.inProgressCount} student${d.inProgressCount === 1 ? "" : "s"} are enrolled in at least one course but have not completed any course yet.`;
  } catch {
    return null;
  }
}

function formatDropoutRiskReply(toolJson: string): string | null {
  try {
    const d = JSON.parse(toolJson) as {
      error?: unknown;
      criteria?: unknown;
      atRisk?: unknown;
    };
    if (d.error != null) return null;
    if (typeof d.criteria !== "string") return null;
    if (!Array.isArray(d.atRisk)) return null;
    const criteria = d.criteria;
    type Row = {
      studentName?: unknown;
      district?: unknown;
      courseTitle?: unknown;
      progressPercent?: unknown;
      lastActivityAt?: unknown;
      reason?: unknown;
    };
    const rows = d.atRisk as Row[];
    if (rows.length === 0) {
      return `No students currently match the dropout-risk criteria (${criteria}).`;
    }
    const lines = rows.map((r, i) => {
      const name = typeof r.studentName === "string" ? r.studentName : "?";
      const dist = typeof r.district === "string" ? r.district : "?";
      const course = typeof r.courseTitle === "string" ? r.courseTitle : "?";
      const pct =
        typeof r.progressPercent === "number" ? r.progressPercent : "?";
      let dateStr = "unknown";
      if (r.lastActivityAt != null) {
        const dt = new Date(String(r.lastActivityAt));
        if (!Number.isNaN(dt.getTime()))
          dateStr = dt.toISOString().slice(0, 10);
      }
      const reason = typeof r.reason === "string" ? r.reason : "";
      return `${i + 1}. ${name} (${dist}) — ${course} — ${pct}% progress — last activity ${dateStr}${reason ? ` — ${reason}` : ""}`;
    });
    return `Students flagged as at risk of dropping out (${criteria}), showing ${rows.length}:\n${lines.join("\n")}`;
  } catch {
    return null;
  }
}

function formatStudentFullProfileReply(toolJson: string): string | null {
  try {
    const d = JSON.parse(toolJson) as {
      error?: unknown;
      studentName?: unknown;
      district?: unknown;
      sector?: unknown;
      gender?: unknown;
      approximateAge?: unknown;
      phoneNumber?: unknown;
      courses?: unknown;
      testSummary?: unknown;
    };
    if (typeof d.error === "string") {
      if (d.error === "Forbidden") return null;
      return d.error;
    }
    if (d.error != null) return null;
    if (typeof d.studentName !== "string") return null;
    const demoParts = [
      d.district != null && String(d.district).trim() !== ""
        ? `District: ${String(d.district)}`
        : null,
      d.sector != null && String(d.sector).trim() !== ""
        ? `Sector: ${String(d.sector)}`
        : null,
      d.gender != null && String(d.gender).trim() !== ""
        ? `Gender: ${String(d.gender)}`
        : null,
      typeof d.approximateAge === "number" && Number.isFinite(d.approximateAge)
        ? `Approximate age: ${d.approximateAge}`
        : null,
      d.phoneNumber != null && String(d.phoneNumber).trim() !== ""
        ? `Phone: ${String(d.phoneNumber)}`
        : null,
    ].filter((x): x is string => x != null);
    const lines: string[] = [
      `Full profile — ${d.studentName}`,
      demoParts.length
        ? demoParts.join("; ")
        : "Demographics: not all fields on file.",
    ];
    if (Array.isArray(d.courses) && d.courses.length > 0) {
      lines.push("Courses:");
      for (const row of d.courses) {
        if (!row || typeof row !== "object") continue;
        const c = row as Record<string, unknown>;
        const title = typeof c.courseTitle === "string" ? c.courseTitle : "?";
        const pct =
          typeof c.progressPercent === "number" ? c.progressPercent : "?";
        const done = c.isCompleted === true ? "completed" : "in progress";
        lines.push(`- ${title}: ${pct}% (${done})`);
      }
    } else {
      lines.push("Courses: none on record.");
    }
    const ts = d.testSummary;
    if (ts && typeof ts === "object") {
      const t = ts as Record<string, unknown>;
      const ac = typeof t.attemptCount === "number" ? t.attemptCount : "?";
      const am = typeof t.averageMarks === "number" ? t.averageMarks : "?";
      const tw =
        typeof t.totalWrongAnswers === "number" ? t.totalWrongAnswers : "?";
      const tr =
        typeof t.totalAnswerRecords === "number" ? t.totalAnswerRecords : "?";
      const wr =
        typeof t.wrongAnswerRatePercent === "number"
          ? t.wrongAnswerRatePercent
          : "?";
      lines.push(
        `Test summary: ${ac} attempt(s); average mark ${am}; wrong answers ${tw} of ${tr} answer records (${wr}% wrong).`,
      );
    }
    return lines.join("\n");
  } catch {
    return null;
  }
}

function formatStudentProgressInCourseReply(toolJson: string): string | null {
  try {
    const d = JSON.parse(toolJson) as {
      error?: unknown;
      studentName?: unknown;
      courseTitle?: unknown;
      enrolled?: unknown;
      message?: unknown;
      progressPercent?: unknown;
      isCompleted?: unknown;
      enrolledAt?: unknown;
      lastUpdatedAt?: unknown;
    };
    if (typeof d.error === "string") {
      if (d.error === "Forbidden") return null;
      return d.error;
    }
    if (d.error != null) return null;
    if (typeof d.studentName !== "string" || typeof d.courseTitle !== "string")
      return null;
    if (d.enrolled === false && typeof d.message === "string") {
      return `${d.studentName} is not enrolled in ${d.courseTitle}.`;
    }
    if (typeof d.progressPercent !== "number") return null;
    const status = d.isCompleted === true ? "completed" : "in progress";
    let enrolled = "unknown";
    if (d.enrolledAt != null) {
      const dt = new Date(String(d.enrolledAt));
      if (!Number.isNaN(dt.getTime())) enrolled = dt.toISOString().slice(0, 10);
    }
    let updated = "";
    if (d.lastUpdatedAt != null) {
      const dt = new Date(String(d.lastUpdatedAt));
      if (!Number.isNaN(dt.getTime()))
        updated = ` Last updated ${dt.toISOString().slice(0, 10)}.`;
    }
    return `${d.studentName} in ${d.courseTitle}: ${d.progressPercent}% (${status}); enrolled ${enrolled}.${updated}`;
  } catch {
    return null;
  }
}

function formatStudentBestCourseReply(toolJson: string): string | null {
  try {
    const d = JSON.parse(toolJson) as {
      error?: unknown;
      studentName?: unknown;
      courses?: unknown;
    };
    if (typeof d.error === "string") {
      if (d.error === "Forbidden") return null;
      return d.error;
    }
    if (typeof d.studentName !== "string" || !Array.isArray(d.courses))
      return null;
    if (d.courses.length === 0) {
      return `${d.studentName} has no course enrollments on record.`;
    }
    const first = d.courses[0] as Record<string, unknown>;
    const title =
      typeof first.courseTitle === "string" ? first.courseTitle : "?";
    const pct =
      typeof first.progressPercent === "number" ? first.progressPercent : "?";
    const done = first.isCompleted === true ? "completed" : "in progress";
    return `${d.studentName} is doing best in "${title}" (${pct}% progress, ${done}). That is the top course by progress among their enrollments.`;
  } catch {
    return null;
  }
}

function formatStudentTestPerformanceReply(toolJson: string): string | null {
  try {
    const d = JSON.parse(toolJson) as {
      error?: unknown;
      studentName?: unknown;
      attemptCount?: unknown;
      averageMarksOnAttempts?: unknown;
      totalWrongAnswers?: unknown;
      totalAnswerRecords?: unknown;
      wrongAnswerRatePercent?: unknown;
    };
    if (typeof d.error === "string") {
      if (d.error === "Forbidden") return null;
      return d.error;
    }
    if (typeof d.studentName !== "string") return null;
    const ac = typeof d.attemptCount === "number" ? d.attemptCount : 0;
    const avg =
      typeof d.averageMarksOnAttempts === "number"
        ? d.averageMarksOnAttempts
        : "?";
    const tw =
      typeof d.totalWrongAnswers === "number" ? d.totalWrongAnswers : "?";
    const tr =
      typeof d.totalAnswerRecords === "number" ? d.totalAnswerRecords : "?";
    const wr =
      typeof d.wrongAnswerRatePercent === "number"
        ? d.wrongAnswerRatePercent
        : "?";
    if (ac === 0) {
      return `${d.studentName} has no test attempts on record yet.`;
    }
    return `${d.studentName} — tests: ${ac} attempt(s); average mark ${avg}; wrong answers ${tw} of ${tr} graded answers (${wr}% wrong).`;
  } catch {
    return null;
  }
}

function formatMostFailedQuestionsReply(toolJson: string): string | null {
  try {
    const d = JSON.parse(toolJson) as { error?: unknown; mostMissed?: unknown };
    if (typeof d.error === "string") {
      if (d.error === "Forbidden") return null;
      return d.error;
    }
    if (!Array.isArray(d.mostMissed)) return null;
    if (d.mostMissed.length === 0) {
      return "No wrong-answer counts on questions yet (or no attempts recorded).";
    }
    const lines = (d.mostMissed as Record<string, unknown>[])
      .slice(0, 15)
      .map((row, i) => {
        const preview =
          typeof row.questionPreview === "string"
            ? row.questionPreview.slice(0, 120)
            : "?";
        const wr =
          typeof row.wrongRatePercent === "number" ? row.wrongRatePercent : "?";
        const fc = typeof row.failCount === "number" ? row.failCount : "?";
        const ct = typeof row.courseTitle === "string" ? row.courseTitle : "?";
        const ch = row.chapterTitle != null ? String(row.chapterTitle) : "";
        return `${i + 1}. ${preview}${ch ? ` — ${ch}` : ""} — ${wr}% wrong (${fc} misses) · ${ct}`;
      });
    return `Questions students miss most often:\n${lines.join("\n")}`;
  } catch {
    return null;
  }
}

function formatFlaggedMidTestChaptersReply(toolJson: string): string | null {
  try {
    const d = JSON.parse(toolJson) as {
      error?: unknown;
      flaggedChapters?: unknown;
    };
    if (typeof d.error === "string") {
      if (d.error === "Forbidden") return null;
      return d.error;
    }
    const flagged = d.flaggedChapters;
    if (!Array.isArray(flagged)) return null;
    if (flagged.length === 0) {
      return "No chapters are flagged for weak mid-test performance (no averages below the pass mark with attempts on record).";
    }
    const lines = (flagged as Record<string, unknown>[]).map((row, i) => {
      const course =
        typeof row.courseTitle === "string" ? row.courseTitle : "?";
      const ch = typeof row.chapterTitle === "string" ? row.chapterTitle : "?";
      const avg = typeof row.averageMarks === "number" ? row.averageMarks : "?";
      const pass = typeof row.marksToPass === "number" ? row.marksToPass : "?";
      return `${i + 1}. ${course} — ${ch}: average ${avg} (pass mark ${pass})`;
    });
    return `Chapters flagged for weak mid-test performance:\n${lines.join("\n")}`;
  } catch {
    return null;
  }
}

function formatPlatformTestAggregatesReply(toolJson: string): string | null {
  try {
    const d = JSON.parse(toolJson) as {
      error?: unknown;
      scope?: unknown;
      totalAttempts?: unknown;
      sumOfMarks?: unknown;
      averageMarks?: unknown;
      wrongAnswerRatePercent?: unknown;
      totalAnswerRecords?: unknown;
      wrongAnswerCount?: unknown;
      minMarks?: unknown;
      maxMarks?: unknown;
    };
    if (typeof d.error === "string") {
      if (d.error === "Forbidden") return null;
      return d.error;
    }
    const scope = typeof d.scope === "string" ? d.scope : "platform";
    const ta = typeof d.totalAttempts === "number" ? d.totalAttempts : "?";
    const sum = typeof d.sumOfMarks === "number" ? d.sumOfMarks : "?";
    const avg = typeof d.averageMarks === "number" ? d.averageMarks : "?";
    const wr =
      typeof d.wrongAnswerRatePercent === "number"
        ? d.wrongAnswerRatePercent
        : "?";
    const tr =
      typeof d.totalAnswerRecords === "number" ? d.totalAnswerRecords : "?";
    const tw =
      typeof d.wrongAnswerCount === "number" ? d.wrongAnswerCount : "?";
    const min = typeof d.minMarks === "number" ? d.minMarks : "?";
    const max = typeof d.maxMarks === "number" ? d.maxMarks : "?";
    return `Test aggregates (${scope}): ${ta} attempt(s); sum of marks ${sum}; average mark ${avg}; min ${min}, max ${max}; ${tw} wrong answers out of ${tr} answer records (${wr}% wrong).`;
  } catch {
    return null;
  }
}

function formatTestPerformanceDemographicsReply(
  toolJson: string,
): string | null {
  try {
    const d = JSON.parse(toolJson) as {
      error?: unknown;
      message?: unknown;
      filters?: {
        gender?: unknown;
        district?: unknown;
        minAge?: unknown;
        maxAge?: unknown;
      };
      studentsInSegment?: unknown;
      testAttempts?: unknown;
      averageMarks?: unknown;
      sumOfAttemptMarks?: unknown;
      wrongAnswerRatePercent?: unknown;
      totalAnswerRecords?: unknown;
      wrongAnswerCount?: unknown;
    };
    if (typeof d.message === "string" && d.message.includes("No students")) {
      const f = d.filters;
      const parts: string[] = [];
      if (f && typeof f.district === "string" && f.district)
        parts.push(`district ${f.district}`);
      if (f && typeof f.gender === "string" && f.gender)
        parts.push(String(f.gender));
      return `No students match${parts.length ? ` (${parts.join(", ")})` : ""} for these filters.`;
    }
    if (typeof d.error === "string") {
      if (d.error === "Forbidden") return null;
      return d.error;
    }
    const filt = d.filters;
    const seg: string[] = [];
    if (filt && typeof filt.gender === "string" && filt.gender)
      seg.push(`${filt.gender} students`);
    if (filt && typeof filt.district === "string" && filt.district)
      seg.push(`district ${filt.district}`);
    const scope = seg.length ? seg.join(", ") : "segment";
    const n =
      typeof d.studentsInSegment === "number" ? d.studentsInSegment : "?";
    const ta = typeof d.testAttempts === "number" ? d.testAttempts : "?";
    const sum =
      typeof d.sumOfAttemptMarks === "number" ? d.sumOfAttemptMarks : "?";
    const avg = typeof d.averageMarks === "number" ? d.averageMarks : "?";
    const wr =
      typeof d.wrongAnswerRatePercent === "number"
        ? d.wrongAnswerRatePercent
        : "?";
    const tr =
      typeof d.totalAnswerRecords === "number" ? d.totalAnswerRecords : "?";
    const tw =
      typeof d.wrongAnswerCount === "number" ? d.wrongAnswerCount : "?";
    return `Test aggregates (${scope}; ${n} students in segment): ${ta} attempt(s); sum of marks ${sum}; average mark ${avg}; ${tw} wrong answers out of ${tr} answer records (${wr}% wrong).`;
  } catch {
    return null;
  }
}

function completionsPeriodHumanLabel(period: string): string {
  switch (period) {
    case "last_week":
      return "the last 7 days";
    case "this_month":
      return "this calendar month (so far)";
    case "last_month":
      return "the last 30 days";
    case "last_year":
      return "the last 365 days";
    default:
      return period;
  }
}

function formatCompletionsOverTimeReply(toolJson: string): string | null {
  try {
    const d = JSON.parse(toolJson) as {
      error?: unknown;
      completedCount?: unknown;
      period?: unknown;
      rows?: unknown;
    };
    if (typeof d.error === "string") {
      if (d.error === "Forbidden") return null;
      return d.error;
    }
    const n = typeof d.completedCount === "number" ? d.completedCount : "?";
    const p = typeof d.period === "string" ? d.period : "";
    const label = completionsPeriodHumanLabel(p);
    let line = `Course completions in ${label}: ${n} course completion(s) recorded.`;
    const rows = Array.isArray(d.rows) ? d.rows : [];
    if (rows.length > 0) {
      const sample = rows.slice(0, 6).map((r, i) => {
        const row = r as Record<string, unknown>;
        const name =
          typeof row.studentName === "string" ? row.studentName : "?";
        const course =
          typeof row.courseTitle === "string" ? row.courseTitle : "?";
        return `  ${i + 1}. ${name} — ${course}`;
      });
      line += `\nRecent completions (sample):\n${sample.join("\n")}`;
      if (
        typeof d.completedCount === "number" &&
        d.completedCount > rows.length
      ) {
        line += `\n(Total completions in this period: ${d.completedCount}; sample shows up to ${rows.length}.)`;
      }
    }
    return line;
  } catch {
    return null;
  }
}

function formatTopPerformingCoursesReply(toolJson: string): string | null {
  try {
    const d = JSON.parse(toolJson) as {
      error?: unknown;
      byCompletionRate?: unknown;
    };
    if (typeof d.error === "string") {
      if (d.error === "Forbidden") return null;
      return d.error;
    }
    const arr = Array.isArray(d.byCompletionRate) ? d.byCompletionRate : [];
    if (arr.length === 0) {
      return "There isn’t enough enrollment data yet to rank courses by completion rate.";
    }
    const lines = arr.slice(0, 12).map((row, i) => {
      const r = row as Record<string, unknown>;
      const title = typeof r.courseTitle === "string" ? r.courseTitle : "?";
      const pct =
        typeof r.completionRatePercent === "number"
          ? r.completionRatePercent
          : "?";
      const en = typeof r.enrollments === "number" ? r.enrollments : "?";
      const co = typeof r.completed === "number" ? r.completed : "?";
      return `${i + 1}. ${title}: ${pct}% completion (${co}/${en} completed vs enrolled)`;
    });
    return `Top courses by completion rate (highest first):\n${lines.join("\n")}`;
  } catch {
    return null;
  }
}

function formatDashboardStatisticsReply(toolJson: string): string | null {
  try {
    const d = JSON.parse(toolJson) as {
      error?: unknown;
      totalStudents?: { value?: number };
      totalCourses?: { value?: number };
      completionRate?: { value?: number };
    };
    if (typeof d.error === "string") {
      if (d.error === "Forbidden") return null;
      return d.error;
    }
    const parts: string[] = [];
    const students = d.totalStudents?.value;
    const courses = d.totalCourses?.value;
    const completion = d.completionRate?.value;
    if (typeof students === "number") {
      parts.push(
        `${students} student${students === 1 ? "" : "s"} on the platform`,
      );
    }
    if (typeof courses === "number") {
      parts.push(`${courses} course${courses === 1 ? "" : "s"}`);
    }
    if (typeof completion === "number") {
      parts.push(`overall completion rate is ${completion}%`);
    }
    if (parts.length === 0) return null;
    return `${parts.join(", ")}.`;
  } catch {
    return null;
  }
}

function formatPlatformCertificateTotalsReply(toolJson: string): string | null {
  try {
    const d = JSON.parse(toolJson) as {
      error?: unknown;
      totalCertificatesIssued?: unknown;
      studentsWithAtLeastOneCertificate?: unknown;
      totalStudents?: unknown;
    };
    if (typeof d.error === "string") {
      if (d.error === "Forbidden") return null;
      return d.error;
    }
    const total =
      typeof d.totalCertificatesIssued === "number"
        ? d.totalCertificatesIssued
        : "?";
    const withCert =
      typeof d.studentsWithAtLeastOneCertificate === "number"
        ? d.studentsWithAtLeastOneCertificate
        : "?";
    const allStudents =
      typeof d.totalStudents === "number" ? d.totalStudents : "?";
    return `Certificate totals (platform): ${total} certificate(s) issued in total. ${withCert} of ${allStudents} students have at least one certificate.`;
  } catch {
    return null;
  }
}

function formatCourseReviewsReply(toolJson: string): string | null {
  try {
    const d = JSON.parse(toolJson) as {
      error?: unknown;
      courseTitle?: unknown;
      reviewCount?: unknown;
      reviewsReturned?: unknown;
      reviews?: unknown;
    };
    if (typeof d.error === "string") {
      if (d.error === "Forbidden") return null;
      return d.error;
    }
    const title = typeof d.courseTitle === "string" ? d.courseTitle : "?";
    const total = typeof d.reviewCount === "number" ? d.reviewCount : 0;
    const returned =
      typeof d.reviewsReturned === "number" ? d.reviewsReturned : 0;
    const reviews = Array.isArray(d.reviews) ? d.reviews : [];
    if (total === 0 || reviews.length === 0) {
      return `No learner reviews have been submitted for "${title}" in this platform yet.`;
    }
    const more =
      total > returned
        ? ` (showing ${returned} most recent of ${total} total).`
        : ` (${total} on record).`;
    const lines = reviews.map((raw, i) => {
      const r = raw as Record<string, unknown>;
      const name = typeof r.studentName === "string" ? r.studentName : "?";
      const rating = typeof r.rating === "number" ? r.rating : "?";
      const comment = typeof r.comment === "string" ? r.comment : "";
      const short =
        comment.length > 420 ? `${comment.slice(0, 417)}…` : comment;
      const cats = Array.isArray(r.categoryRatings) ? r.categoryRatings : [];
      const catStr =
        cats.length > 0
          ? ` · ${cats
              .map((c) => {
                const x = c as Record<string, unknown>;
                const lab = typeof x.label === "string" ? x.label : "?";
                const rt = typeof x.rating === "number" ? x.rating : "?";
                return `${lab}: ${rt}`;
              })
              .join("; ")}`
          : "";
      return `${i + 1}. ${name} — rating ${rating}${catStr} — ${short}`;
    });
    return `Reviews for "${title}"${more}\n${lines.join("\n")}`;
  } catch {
    return null;
  }
}

function formatDistrictPerformanceComparisonReply(
  toolJson: string,
): string | null {
  try {
    const d = JSON.parse(toolJson) as {
      error?: unknown;
      districts?: unknown;
      highestCompletionDistrict?: unknown;
      lowestCompletionDistrict?: unknown;
    };
    if (typeof d.error === "string") {
      if (d.error === "Forbidden") return null;
      return d.error;
    }
    if (!Array.isArray(d.districts)) return null;
    const rows = d.districts as Array<Record<string, unknown>>;
    const high =
      typeof d.highestCompletionDistrict === "string"
        ? d.highestCompletionDistrict
        : null;
    const low =
      typeof d.lowestCompletionDistrict === "string"
        ? d.lowestCompletionDistrict
        : null;
    const summary =
      high && low
        ? `Highest completion rate: ${high}. Lowest: ${low}.`
        : "District completion comparison:";
    const lines = rows.slice(0, 15).map((r) => {
      const dist = typeof r.district === "string" ? r.district : "?";
      const pct =
        typeof r.completionRatePercent === "number"
          ? r.completionRatePercent
          : "?";
      const en = typeof r.enrollments === "number" ? r.enrollments : "?";
      const co = typeof r.completed === "number" ? r.completed : "?";
      return `${dist}: ${pct}% (${co}/${en} completed vs enrolled)`;
    });
    return `${summary}\nBy district (best to worst):\n${lines.join("\n")}`;
  } catch {
    return null;
  }
}

function contentLooksLikeFakeDistrictComparisonPayload(text: string): boolean {
  const t = text.toLowerCase().replace(/\s/g, "");
  return (
    t.includes("performancecomparison") ||
    /"gender"\s*:\s*false/.test(text) ||
    (text.trim().startsWith("{") &&
      t.includes('"gender"') &&
      t.includes("performance"))
  );
}

function contentLooksLikeLlmRefusalToUseData(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes("i'm a large language model") ||
    t.includes("i am a large language model") ||
    t.includes("don't have real-time access") ||
    t.includes("don't have the exact data") ||
    t.includes("do not have real-time access") ||
    (t.includes("don't have access") && t.includes("student")) ||
    (t.includes("pre-existing information") && t.includes("don't have")) ||
    (t.includes("don't have direct access") &&
      (t.includes("review") || t.includes("rating")))
  );
}

function contentLooksLikeExternalCoursePlatformNonsense(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes("coursera") ||
    t.includes("edx") ||
    t.includes("openlearn") ||
    t.includes("trustpilot") ||
    t.includes("course report") ||
    t.includes("reviewmeta")
  );
}

function contentLooksLikeMetaConversation(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes("could you please provide more context") ||
    t.includes("i'll need more context") ||
    t.includes("please let me know how i can assist") ||
    (t.includes("without further information") &&
      t.includes("difficult to determine"))
  );
}

function contentLooksLikeHallucinatedProgressJson(text: string): boolean {
  return /coursesGetStudentProgress/i.test(text);
}

function contentLooksLikeAskingForNameWhenProvided(text: string): boolean {
  const t = text.toLowerCase();
  return (
    (t.includes("please provide") && t.includes("name")) ||
    (t.includes("provide the name") && t.includes("student")) ||
    t.includes("can you please provide the name") ||
    (t.includes("don't see") &&
      (t.includes("information") || t.includes("name"))) ||
    (t.includes("requires") &&
      t.includes("student name") &&
      t.includes("provide"))
  );
}

function contentLooksLikeToolMetaInstructions(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes("here's how you can call") ||
    t.includes("you can use the `get_") ||
    t.includes("```bash") ||
    t.includes("```ruby") ||
    t.includes("```javascript") ||
    t.includes("```js") ||
    (t.includes("you're using the") && t.includes("`get_")) ||
    t.includes("you want to use the `") ||
    t.includes("here's an example of how you can use") ||
    (t.includes("you can find") && t.includes("using the `get_")) ||
    (t.includes("function ") && t.includes("{") && t.includes("recommend")) ||
    (t.includes("get_completions_over_time") && text.includes("```")) ||
    t.includes("hypothetical function") ||
    t.includes("http/1.1") ||
    t.includes("authorization: bearer") ||
    t.includes("your_access_token") ||
    (t.includes("get /courses") && t.includes("http")) ||
    t.includes("get_course_enrollment_count('top')") ||
    t.includes('get_course_enrollment_count("top")')
  );
}

/** Model pasted fake JS/JSON instead of calling get_student_progress_in_course. */
function contentLooksLikeStudentProgressInCourseMeta(text: string): boolean {
  const t = text.toLowerCase();
  if (!t.includes("get_student_progress_in_course")) return false;
  return (
    /```/.test(text) ||
    t.includes("let studentname") ||
    t.includes("response(") ||
    (t.includes("you can find") && t.includes("performance data"))
  );
}

/** Model replied with SQL or "query format" instead of calling analytics tools. */
function contentLooksLikeSqlOrQueryNarration(text: string): boolean {
  const t = text.toLowerCase();
  if (/```\s*sql\b/i.test(text)) return true;
  if (/\bconverted into a query\b/.test(t) || /\bquery format\b/.test(t))
    return true;
  if (/\bselect\s+[\s\S]{0,400}\bfrom\b/i.test(text)) return true;
  if (t.includes("course_students") || t.includes("course students"))
    return true;
  return false;
}

function contentLooksLikePseudoImplementation(text: string): boolean {
  const t = text.toLowerCase();
  if (t.includes("// assume these functions exist")) return true;
  if (t.includes("// implementation to fetch")) return true;
  if (/function\s+get_students_at_dropout_risk\b/i.test(text)) return true;
  if (/function\s+getstudents_at_dropout_risk\b/i.test(text)) return true;
  if (t.includes("getstudents_in_progress")) return true;
  return false;
}

function toChatMessage(m: MessageLike): ChatMessage | null {
  if (!m.role || m.content === undefined) return null;
  if (m.role === "user" || m.role === "assistant")
    return { role: m.role, content: m.content };
  return null;
}

export async function chatWithTools(
  userMessage: string,
  history: MessageLike[],
  ctx: ChatContext,
): Promise<string> {
  const allTools = getToolsForContext(ctx);
  const useTools = isGreetingOrSmallTalk(userMessage) ? [] : allTools;
  const messages: ChatMessage[] = [
    { role: "system", content: systemPromptForChat(ctx, userMessage) },
    ...history.map(toChatMessage).filter((m): m is ChatMessage => m !== null),
    { role: "user", content: userMessage },
  ];

  try {
    if (!isGreetingOrSmallTalk(userMessage) && ctx.isStaff) {
      if (isStaffDashboardStatisticsQuestion(userMessage)) {
        const r = await runTool("get_dashboard_statistics", {}, ctx);
        const f = formatDashboardStatisticsReply(r);
        if (f) return f;
      }
      if (isStaffNotStartedQuestion(userMessage)) {
        const r = await runTool("get_students_not_started", {}, ctx);
        const f = formatNotStartedReply(r);
        if (f) return f;
      }
      if (isStaffInProgressNoCompleteQuestion(userMessage)) {
        const r = await runTool("get_students_in_progress", {}, ctx);
        const f = formatInProgressNoCompleteReply(r);
        if (f) return f;
      }
      if (isStaffCompletionsOverTimeQuestion(userMessage)) {
        const periods = extractCompletionsPeriodsFromQuestion(userMessage);
        if (periods.length > 0) {
          const parts: string[] = [];
          for (const period of periods) {
            const r = await runTool(
              "get_completions_over_time",
              { period },
              ctx,
            );
            const f = formatCompletionsOverTimeReply(r);
            if (f) parts.push(f);
          }
          if (parts.length > 0) return parts.join("\n\n");
        }
      }
      {
        const courseReviewTitle =
          extractCourseTitleForReviewsQuestion(userMessage);
        if (courseReviewTitle) {
          const r = await runTool(
            "get_course_reviews",
            { courseTitle: courseReviewTitle },
            ctx,
          );
          const f = formatCourseReviewsReply(r);
          if (f) return f;
        }
      }
      if (isStaffPlatformCertificateTotalsQuestion(userMessage)) {
        const r = await runTool("get_platform_certificate_totals", {}, ctx);
        const f = formatPlatformCertificateTotalsReply(r);
        if (f) return f;
      }
      if (isStaffTopPerformingCoursesQuestion(userMessage)) {
        const r = await runTool("get_course_completion_rates", {}, ctx);
        const f = formatTopPerformingCoursesReply(r);
        if (f) return f;
      }
      if (isStaffDropoutRiskQuestion(userMessage)) {
        const r = await runTool("get_students_at_dropout_risk", {}, ctx);
        const f = formatDropoutRiskReply(r);
        if (f) return f;
      }
      {
        const pc = extractStudentProgressInCourseNameAndTitle(userMessage);
        if (pc) {
          const r = await runTool(
            "get_student_progress_in_course",
            { name: pc.name, courseTitle: pc.courseTitle },
            ctx,
          );
          const f = formatStudentProgressInCourseReply(r);
          if (f) return f;
        }
      }
      {
        const bestName = extractStudentNameFromBestCourseQuestion(userMessage);
        if (bestName) {
          const r = await runTool(
            "get_student_progress_by_name",
            { name: bestName },
            ctx,
          );
          const f = formatStudentBestCourseReply(r);
          if (f) return f;
        }
      }
      if (isStaffTestPerformanceDemographicsQuestion(userMessage)) {
        const a = extractTestPerformanceDemographicsArgs(userMessage);
        if (Object.keys(a).length > 0) {
          const r = await runTool(
            "get_test_performance_by_demographics",
            a,
            ctx,
          );
          const f = formatTestPerformanceDemographicsReply(r);
          if (f) return f;
        }
      }
      {
        const testName =
          extractStudentNameFromTestPerformanceQuestion(userMessage);
        if (testName) {
          const r = await runTool(
            "get_student_test_performance_detail",
            { name: testName },
            ctx,
          );
          const f = formatStudentTestPerformanceReply(r);
          if (f) return f;
        }
      }
      {
        const profileName = extractStudentNameFromProfileRequest(userMessage);
        if (profileName) {
          const r = await runTool(
            "get_student_full_profile",
            { name: profileName },
            ctx,
          );
          const f = formatStudentFullProfileReply(r);
          if (f) return f;
        }
      }
      if (isStaffPerformanceTrendQuestion(userMessage)) {
        const perfDirect = await staffPerformanceTrendFromDatabase(
          userMessage,
          ctx,
        );
        if (perfDirect) return perfDirect;
      }
      if (isStaffEnrollmentTrendQuestion(userMessage)) {
        const enrollDirect = await staffEnrollmentTrendFromDatabase(
          userMessage,
          ctx,
        );
        if (enrollDirect) return enrollDirect;
      }
      if (isStaffMostFailedQuestionsQuestion(userMessage)) {
        const r = await runTool("get_most_failed_questions", {}, ctx);
        const f = formatMostFailedQuestionsReply(r);
        if (f) return f;
      }
      if (isStaffFlaggedMidTestChaptersQuestion(userMessage)) {
        const r = await runTool("get_chapters_flagged_mid_test", {}, ctx);
        const f = formatFlaggedMidTestChaptersReply(r);
        if (f) return f;
      }
      if (isStaffPlatformTestAggregatesQuestion(userMessage)) {
        const ct = extractCourseTitleForPlatformTestAggregates(userMessage);
        const r = await runTool(
          "get_platform_test_aggregates",
          ct ? { courseTitle: ct } : {},
          ctx,
        );
        const f = formatPlatformTestAggregatesReply(r);
        if (f) return f;
      }
      if (isStaffDistrictPerformanceComparisonQuestion(userMessage)) {
        const g = extractGenderForDistrictComparison(userMessage);
        const r = await runTool(
          "get_district_performance_comparison",
          g ? { gender: g } : {},
          ctx,
        );
        const f = formatDistrictPerformanceComparisonReply(r);
        if (f) return f;
      }
    }

    for (let i = 0; i < MAX_TURN; i++) {
      const response = await chat(messages, useTools);
      if ("content" in response) {
        const c = response.content?.trim() ?? "";
        if (ctx.isStaff && c) {
          if (isStaffNotStartedQuestion(userMessage)) {
            if (
              contentLooksLikeToolMetaInstructions(c) ||
              contentLooksLikeSqlOrQueryNarration(c)
            ) {
              const r = await runTool("get_students_not_started", {}, ctx);
              const f = formatNotStartedReply(r);
              if (f) return f;
            }
          }
          if (isStaffInProgressNoCompleteQuestion(userMessage)) {
            if (
              contentLooksLikeToolMetaInstructions(c) ||
              contentLooksLikeSqlOrQueryNarration(c)
            ) {
              const r = await runTool("get_students_in_progress", {}, ctx);
              const f = formatInProgressNoCompleteReply(r);
              if (f) return f;
            }
          }
          if (isStaffDropoutRiskQuestion(userMessage)) {
            if (
              contentLooksLikeToolMetaInstructions(c) ||
              contentLooksLikeSqlOrQueryNarration(c) ||
              contentLooksLikePseudoImplementation(c)
            ) {
              const r = await runTool("get_students_at_dropout_risk", {}, ctx);
              const f = formatDropoutRiskReply(r);
              if (f) return f;
            }
          }
          {
            const profileName =
              extractStudentNameFromProfileRequest(userMessage);
            if (profileName && contentLooksLikeAskingForNameWhenProvided(c)) {
              const r = await runTool(
                "get_student_full_profile",
                { name: profileName },
                ctx,
              );
              const f = formatStudentFullProfileReply(r);
              if (f) return f;
            }
          }
          {
            const pc = extractStudentProgressInCourseNameAndTitle(userMessage);
            if (
              pc &&
              (contentLooksLikeToolMetaInstructions(c) ||
                contentLooksLikeStudentProgressInCourseMeta(c) ||
                contentLooksLikeSqlOrQueryNarration(c))
            ) {
              const r = await runTool(
                "get_student_progress_in_course",
                { name: pc.name, courseTitle: pc.courseTitle },
                ctx,
              );
              const f = formatStudentProgressInCourseReply(r);
              if (f) return f;
            }
          }
          {
            const bestName =
              extractStudentNameFromBestCourseQuestion(userMessage);
            if (
              bestName &&
              (contentLooksLikeToolMetaInstructions(c) ||
                contentLooksLikeHallucinatedProgressJson(c) ||
                contentLooksLikeSqlOrQueryNarration(c))
            ) {
              const r = await runTool(
                "get_student_progress_by_name",
                { name: bestName },
                ctx,
              );
              const f = formatStudentBestCourseReply(r);
              if (f) return f;
            }
          }
          {
            const testName =
              extractStudentNameFromTestPerformanceQuestion(userMessage);
            if (
              testName &&
              (contentLooksLikeLlmRefusalToUseData(c) ||
                contentLooksLikeToolMetaInstructions(c))
            ) {
              const r = await runTool(
                "get_student_test_performance_detail",
                { name: testName },
                ctx,
              );
              const f = formatStudentTestPerformanceReply(r);
              if (f) return f;
            }
          }
          {
            const metaBad =
              contentLooksLikeToolMetaInstructions(c) ||
              contentLooksLikeSqlOrQueryNarration(c) ||
              contentLooksLikeMetaConversation(c);
            if (isStaffMostFailedQuestionsQuestion(userMessage) && metaBad) {
              const r = await runTool("get_most_failed_questions", {}, ctx);
              const f = formatMostFailedQuestionsReply(r);
              if (f) return f;
            }
          }
          {
            const metaBad =
              contentLooksLikeToolMetaInstructions(c) ||
              contentLooksLikeSqlOrQueryNarration(c) ||
              contentLooksLikeMetaConversation(c);
            if (isStaffFlaggedMidTestChaptersQuestion(userMessage) && metaBad) {
              const r = await runTool("get_chapters_flagged_mid_test", {}, ctx);
              const f = formatFlaggedMidTestChaptersReply(r);
              if (f) return f;
            }
          }
          {
            const metaBad =
              contentLooksLikeToolMetaInstructions(c) ||
              contentLooksLikeSqlOrQueryNarration(c) ||
              contentLooksLikeMetaConversation(c);
            if (isStaffPlatformTestAggregatesQuestion(userMessage) && metaBad) {
              const ct =
                extractCourseTitleForPlatformTestAggregates(userMessage);
              const r = await runTool(
                "get_platform_test_aggregates",
                ct ? { courseTitle: ct } : {},
                ctx,
              );
              const f = formatPlatformTestAggregatesReply(r);
              if (f) return f;
            }
          }
          {
            const metaBad =
              contentLooksLikeToolMetaInstructions(c) ||
              contentLooksLikeSqlOrQueryNarration(c) ||
              contentLooksLikeMetaConversation(c);
            if (
              isStaffTestPerformanceDemographicsQuestion(userMessage) &&
              metaBad
            ) {
              const a = extractTestPerformanceDemographicsArgs(userMessage);
              if (Object.keys(a).length > 0) {
                const r = await runTool(
                  "get_test_performance_by_demographics",
                  a,
                  ctx,
                );
                const f = formatTestPerformanceDemographicsReply(r);
                if (f) return f;
              }
            }
          }
          {
            const metaBad =
              contentLooksLikeToolMetaInstructions(c) ||
              contentLooksLikeSqlOrQueryNarration(c) ||
              contentLooksLikeMetaConversation(c) ||
              contentLooksLikeFakeDistrictComparisonPayload(c);
            if (
              isStaffDistrictPerformanceComparisonQuestion(userMessage) &&
              metaBad
            ) {
              const g = extractGenderForDistrictComparison(userMessage);
              const r = await runTool(
                "get_district_performance_comparison",
                g ? { gender: g } : {},
                ctx,
              );
              const f = formatDistrictPerformanceComparisonReply(r);
              if (f) return f;
            }
          }
          {
            const metaBad =
              contentLooksLikeToolMetaInstructions(c) ||
              contentLooksLikeSqlOrQueryNarration(c) ||
              contentLooksLikeMetaConversation(c);
            if (isStaffCompletionsOverTimeQuestion(userMessage) && metaBad) {
              const periods =
                extractCompletionsPeriodsFromQuestion(userMessage);
              if (periods.length > 0) {
                const parts: string[] = [];
                for (const period of periods) {
                  const r = await runTool(
                    "get_completions_over_time",
                    { period },
                    ctx,
                  );
                  const f = formatCompletionsOverTimeReply(r);
                  if (f) parts.push(f);
                }
                if (parts.length > 0) return parts.join("\n\n");
              }
            }
          }
          {
            const reviewTitle =
              extractCourseTitleForReviewsQuestion(userMessage);
            const reviewBad =
              contentLooksLikeToolMetaInstructions(c) ||
              contentLooksLikeSqlOrQueryNarration(c) ||
              contentLooksLikeMetaConversation(c) ||
              contentLooksLikeExternalCoursePlatformNonsense(c) ||
              contentLooksLikeLlmRefusalToUseData(c);
            if (reviewTitle && reviewBad) {
              const r = await runTool(
                "get_course_reviews",
                { courseTitle: reviewTitle },
                ctx,
              );
              const f = formatCourseReviewsReply(r);
              if (f) return f;
            }
          }
          {
            const metaBad =
              contentLooksLikeToolMetaInstructions(c) ||
              contentLooksLikeSqlOrQueryNarration(c) ||
              contentLooksLikeMetaConversation(c);
            if (
              isStaffPlatformCertificateTotalsQuestion(userMessage) &&
              metaBad
            ) {
              const r = await runTool(
                "get_platform_certificate_totals",
                {},
                ctx,
              );
              const f = formatPlatformCertificateTotalsReply(r);
              if (f) return f;
            }
          }
          {
            const metaBad =
              contentLooksLikeToolMetaInstructions(c) ||
              contentLooksLikeSqlOrQueryNarration(c) ||
              contentLooksLikeMetaConversation(c);
            if (isStaffTopPerformingCoursesQuestion(userMessage) && metaBad) {
              const r = await runTool("get_course_completion_rates", {}, ctx);
              const f = formatTopPerformingCoursesReply(r);
              if (f) return f;
            }
          }
          if (
            isStaffPerformanceTrendQuestion(userMessage) &&
            looksLikeJsonObject(c)
          ) {
            const perfRe = await staffPerformanceTrendFromDatabase(
              userMessage,
              ctx,
            );
            if (perfRe) return perfRe;
          }
          if (
            isStaffEnrollmentTrendQuestion(userMessage) &&
            contentLooksLikeEnrollmentTrendPayload(c)
          ) {
            const enrollRe = await staffEnrollmentTrendFromDatabase(
              userMessage,
              ctx,
            );
            if (enrollRe) return enrollRe;
          }
        }
        return c || NO_RESPONSE_MESSAGE;
      }
      const { toolCalls } = response;
      if (!toolCalls?.length) break;
      messages.push({
        role: "assistant",
        content: "",
        tool_calls: toolCalls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: { name: tc.name, arguments: tc.arguments },
        })),
      });
      for (const tc of toolCalls) {
        const args = parseArgs(tc.arguments);
        const result = await runTool(tc.name, args, ctx);
        messages.push({ role: "tool", tool_call_id: tc.id, content: result });
      }
      if (
        toolCalls.length === 1 &&
        toolCalls[0].name === "get_enrollment_trend"
      ) {
        const last = messages[messages.length - 1];
        if (last.role === "tool" && typeof last.content === "string") {
          const direct = formatEnrollmentTrendReply(last.content);
          if (direct) return direct;
        }
      }
      if (
        toolCalls.length === 1 &&
        toolCalls[0].name === "get_performance_trend"
      ) {
        const last = messages[messages.length - 1];
        if (last.role === "tool" && typeof last.content === "string") {
          const direct = formatPerformanceTrendReply(last.content);
          if (direct) return direct;
        }
      }
      if (
        toolCalls.length === 1 &&
        toolCalls[0].name === "get_students_not_started"
      ) {
        const last = messages[messages.length - 1];
        if (last.role === "tool" && typeof last.content === "string") {
          const direct = formatNotStartedReply(last.content);
          if (direct) return direct;
        }
      }
      if (
        toolCalls.length === 1 &&
        toolCalls[0].name === "get_students_in_progress"
      ) {
        const last = messages[messages.length - 1];
        if (last.role === "tool" && typeof last.content === "string") {
          const direct = formatInProgressNoCompleteReply(last.content);
          if (direct) return direct;
        }
      }
      if (
        toolCalls.length === 1 &&
        toolCalls[0].name === "get_students_at_dropout_risk"
      ) {
        const last = messages[messages.length - 1];
        if (last.role === "tool" && typeof last.content === "string") {
          const direct = formatDropoutRiskReply(last.content);
          if (direct) return direct;
        }
      }
      if (
        toolCalls.length === 1 &&
        toolCalls[0].name === "get_student_full_profile"
      ) {
        const last = messages[messages.length - 1];
        if (last.role === "tool" && typeof last.content === "string") {
          const direct = formatStudentFullProfileReply(last.content);
          if (direct) return direct;
        }
      }
      if (
        toolCalls.length === 1 &&
        toolCalls[0].name === "get_student_progress_in_course"
      ) {
        const last = messages[messages.length - 1];
        if (last.role === "tool" && typeof last.content === "string") {
          const direct = formatStudentProgressInCourseReply(last.content);
          if (direct) return direct;
        }
      }
      if (
        toolCalls.length === 1 &&
        toolCalls[0].name === "get_student_progress_by_name"
      ) {
        const last = messages[messages.length - 1];
        if (last.role === "tool" && typeof last.content === "string") {
          const direct = formatStudentBestCourseReply(last.content);
          if (direct) return direct;
        }
      }
      if (
        toolCalls.length === 1 &&
        toolCalls[0].name === "get_student_test_performance_detail"
      ) {
        const last = messages[messages.length - 1];
        if (last.role === "tool" && typeof last.content === "string") {
          const direct = formatStudentTestPerformanceReply(last.content);
          if (direct) return direct;
        }
      }
      if (
        toolCalls.length === 1 &&
        toolCalls[0].name === "get_most_failed_questions"
      ) {
        const last = messages[messages.length - 1];
        if (last.role === "tool" && typeof last.content === "string") {
          const direct = formatMostFailedQuestionsReply(last.content);
          if (direct) return direct;
        }
      }
      if (
        toolCalls.length === 1 &&
        toolCalls[0].name === "get_chapters_flagged_mid_test"
      ) {
        const last = messages[messages.length - 1];
        if (last.role === "tool" && typeof last.content === "string") {
          const direct = formatFlaggedMidTestChaptersReply(last.content);
          if (direct) return direct;
        }
      }
      if (
        toolCalls.length === 1 &&
        toolCalls[0].name === "get_platform_test_aggregates"
      ) {
        const last = messages[messages.length - 1];
        if (last.role === "tool" && typeof last.content === "string") {
          const direct = formatPlatformTestAggregatesReply(last.content);
          if (direct) return direct;
        }
      }
      if (
        toolCalls.length === 1 &&
        toolCalls[0].name === "get_test_performance_by_demographics"
      ) {
        const last = messages[messages.length - 1];
        if (last.role === "tool" && typeof last.content === "string") {
          const direct = formatTestPerformanceDemographicsReply(last.content);
          if (direct) return direct;
        }
      }
      if (
        toolCalls.length === 1 &&
        toolCalls[0].name === "get_district_performance_comparison"
      ) {
        const last = messages[messages.length - 1];
        if (last.role === "tool" && typeof last.content === "string") {
          const direct = formatDistrictPerformanceComparisonReply(last.content);
          if (direct) return direct;
        }
      }
      if (
        toolCalls.length === 1 &&
        toolCalls[0].name === "get_completions_over_time"
      ) {
        const last = messages[messages.length - 1];
        if (last.role === "tool" && typeof last.content === "string") {
          const direct = formatCompletionsOverTimeReply(last.content);
          if (direct) return direct;
        }
      }
      if (
        toolCalls.length === 1 &&
        toolCalls[0].name === "get_course_reviews"
      ) {
        const last = messages[messages.length - 1];
        if (last.role === "tool" && typeof last.content === "string") {
          const direct = formatCourseReviewsReply(last.content);
          if (direct) return direct;
        }
      }
      if (
        toolCalls.length === 1 &&
        toolCalls[0].name === "get_platform_certificate_totals"
      ) {
        const last = messages[messages.length - 1];
        if (last.role === "tool" && typeof last.content === "string") {
          const direct = formatPlatformCertificateTotalsReply(last.content);
          if (direct) return direct;
        }
      }
      if (
        toolCalls.length === 1 &&
        toolCalls[0].name === "get_course_completion_rates"
      ) {
        const last = messages[messages.length - 1];
        if (
          last.role === "tool" &&
          typeof last.content === "string" &&
          isStaffTopPerformingCoursesQuestion(userMessage)
        ) {
          const direct = formatTopPerformingCoursesReply(last.content);
          if (direct) return direct;
        }
      }
    }
  } catch (e) {
    if (isRateLimitError(e)) return RATE_LIMIT_MESSAGE;
    if (isLlmTimeoutError(e) || isLlmConnectionError(e)) {
      return LLM_UNREACHABLE_MESSAGE;
    }
    throw e;
  }

  return NO_RESPONSE_MESSAGE;
}
