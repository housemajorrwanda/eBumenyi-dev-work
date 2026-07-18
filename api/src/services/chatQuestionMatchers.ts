/** Normalize typing/OS quirks so keyword matches work (e.g. curly apostrophe in "haven't"). */
export function normalizeQuestionForMatch(msg: string): string {
  return msg
    .toLowerCase()
    .replace(/\u2019/g, "'")
    .replace(/\u2018/g, "'")
    .replace(/\u2032/g, "'");
}

export function isNotStartedAnyCourseQuestion(msg: string): boolean {
  const t = normalizeQuestionForMatch(msg);
  if (
    t.includes("in progress") &&
    (t.includes("complet") || t.includes("haven't completed"))
  )
    return false;
  const mentionsNoStart =
    t.includes("haven't started") ||
    t.includes("have not started") ||
    t.includes("not started any") ||
    (t.includes("never started") && t.includes("course"));
  const mentionsNoActivity =
    t.includes("no activity") &&
    (t.includes("student") || t.includes("how many"));
  if (!mentionsNoStart && !mentionsNoActivity) return false;
  return (
    t.includes("course") ||
    t.includes("student") ||
    t.includes("how many") ||
    mentionsNoActivity
  );
}

export function isInProgressNoCompleteQuestion(msg: string): boolean {
  const t = normalizeQuestionForMatch(msg);
  const inProg = t.includes("in progress") || t.includes("in-progress");
  if (!inProg) return false;
  return (
    t.includes("haven't completed any") ||
    t.includes("have not completed any") ||
    t.includes("not completed any course") ||
    t.includes("not completed any") ||
    (t.includes("but") &&
      t.includes("complet") &&
      (t.includes("any") || t.includes("yet")))
  );
}

/**
 * Extract a student name from common "full profile" phrasing.
 * Handles: "full profile for X", "X's full profile", "everything about X".
 */
export function extractStudentNameFromProfileRequest(
  msg: string,
): string | null {
  const trimmed = msg.trim().replace(/\u2019/g, "'");

  const lowerTrim = trimmed.toLowerCase();
  const possIdx = lowerTrim.indexOf("'s full profile");
  if (possIdx >= 0) {
    const before = trimmed.slice(0, possIdx).trim();
    const name = before
      .replace(/^.*\b(?:give me|show me|get me|i want|please|tell me)\s+/i, "")
      .replace(/^(?:a|the|my)\s+/i, "")
      .trim();
    if (name.length >= 2 && name.length < 120) return name;
  }

  const every = trimmed.match(/everything\s+about\s+(.+)$/i);
  if (every) {
    const name = every[1].replace(/[.?!]+$/g, "").trim();
    if (name.length >= 2 && name.length < 120) return name;
  }

  const lower = normalizeQuestionForMatch(trimmed);
  const hasProfileIntent =
    lower.includes("full profile") ||
    lower.includes("complete profile") ||
    (lower.includes("profile") &&
      (lower.includes("student") ||
        lower.includes("learner") ||
        /\bprofile\s+for\b/.test(lower)));

  if (hasProfileIntent) {
    const idx = trimmed.toLowerCase().lastIndexOf(" for ");
    if (idx >= 0) {
      const rest = trimmed
        .slice(idx + 5)
        .trim()
        .replace(/[.?!]+$/g, "")
        .trim();
      if (
        rest.length >= 2 &&
        rest.length < 120 &&
        !/^(?:give|show|get|me|a|the|student|learners)\b/i.test(rest) &&
        !/^(?:a|the)\s+student$/i.test(rest) &&
        !/^(?:students?|everyone|all|learners)$/i.test(rest)
      ) {
        return rest;
      }
    }
  }

  return null;
}

/**
 * "How is [name] doing in [course]?" or "[name] performance in [course]".
 * Course title is everything after the last "doing in" / "performance in" anchor.
 */
export function extractStudentProgressInCourseNameAndTitle(
  msg: string,
): { name: string; courseTitle: string } | null {
  const trimmed = msg.trim().replace(/\u2019/g, "'");
  const m1 = trimmed.match(/^how\s+is\s+(.+?)\s+doing\s+in\s+(.+)$/is);
  if (m1) {
    const name = m1[1]
      .trim()
      .replace(/[.?!]+$/g, "")
      .trim();
    const courseTitle = m1[2]
      .trim()
      .replace(/[.?!]+$/g, "")
      .trim();
    if (
      name.length >= 2 &&
      name.length < 120 &&
      courseTitle.length >= 2 &&
      courseTitle.length < 300
    ) {
      return { name, courseTitle };
    }
  }
  const m2 = trimmed.match(/^(.+?)\s+performance\s+in\s+(.+)$/is);
  if (m2) {
    let name = m2[1].trim();
    name = name
      .replace(/^(?:how\s+is|what\s+is|tell\s+me\s+about|show\s+me)\s+/i, "")
      .trim();
    const courseTitle = m2[2]
      .trim()
      .replace(/[.?!]+$/g, "")
      .trim();
    if (
      name.length >= 2 &&
      name.length < 120 &&
      courseTitle.length >= 2 &&
      courseTitle.length < 300
    ) {
      return { name, courseTitle };
    }
  }
  return null;
}

/** "Which course is [name] doing best in?" — name only (uses get_student_progress_by_name). */
export function extractStudentNameFromBestCourseQuestion(
  msg: string,
): string | null {
  const trimmed = msg.trim().replace(/\u2019/g, "'");
  const patterns = [
    /which\s+course\s+is\s+(.+?)\s+doing\s+best\s+in/i,
    /which\s+course\s+is\s+(.+?)\s+performing\s+best(?:\s+in|\s+at)?/i,
    /what\s+course\s+is\s+(.+?)\s+doing\s+best/i,
    /which\s+course\s+does\s+(.+?)\s+do\s+best\s+in/i,
    /which\s+course\s+is\s+(.+?)\s+best\s+at/i,
  ];
  for (const re of patterns) {
    const m = trimmed.match(re);
    if (m) {
      const name = m[1].replace(/[.?!]+$/g, "").trim();
      if (name.length >= 2 && name.length < 120) return name;
    }
  }
  return null;
}

/** "How is [name] doing on tests?" — marks / wrong answers (get_student_test_performance_detail). */
export function extractStudentNameFromTestPerformanceQuestion(
  msg: string,
): string | null {
  const trimmed = msg.trim().replace(/\u2019/g, "'");
  const t = normalizeQuestionForMatch(trimmed);
  if (!t.includes("test") && !t.includes("marks") && !t.includes("wrong"))
    return null;
  const m = trimmed.match(/\bhow\s+is\s+(.+?)\s+doing\s+on\s+tests?\b/is);
  if (m) {
    let name = m[1].trim();
    name = name.replace(/\s*[—–]\s*.*$/u, "").trim();
    name = name.replace(/[.?!]+$/g, "").trim();
    if (name.length >= 2 && name.length < 120) return name;
  }
  const m2 = trimmed.match(
    /\b(?:test\s+performance|marks\s+and\s+wrong)\b.*?\b(?:for|about)\s+(.+?)$/i,
  );
  if (m2) {
    const name = m2[1].replace(/[.?!]+$/g, "").trim();
    if (name.length >= 2 && name.length < 120) {
      if (/^students\s+in\s+/i.test(name) || /^learners\s+in\s+/i.test(name))
        return null;
      if (/^(?:female|male)\s+students?\b/i.test(name)) return null;
      if (/^(?:female|male)\s+students?\s+only\b/i.test(name)) return null;
      return name;
    }
  }
  return null;
}

/**
 * Test marks / wrong-answer aggregates for a slice (gender, district, age) — not one named learner.
 * Excludes platform-wide-only questions (those go to get_platform_test_aggregates).
 */
export function isTestPerformanceDemographicsQuestion(msg: string): boolean {
  const t = normalizeQuestionForMatch(msg);
  const aboutTests =
    (t.includes("test") &&
      (t.includes("performance") ||
        t.includes("marks") ||
        t.includes("attempt"))) ||
    (t.includes("marks") && (t.includes("average") || t.includes("wrong"))) ||
    (t.includes("wrong") && t.includes("answer")) ||
    t.includes("wrong-answer");
  if (!aboutTests) return false;

  const hasFemale = /\bfemale\b|\bwomen\b|\bgirls\b/.test(t);
  const hasMale = /\bmale\b|\bmen\b|\bboys\b/.test(t);
  const genderSegment = hasFemale !== hasMale;

  const hasDistrictPhrase =
    /\bstudents\s+in\s+/.test(t) ||
    /\blearners\s+in\s+/.test(t) ||
    /\bin\s+[a-z][a-z\s]+\s+only\b/.test(t);

  return genderSegment || hasDistrictPhrase;
}

/** Args for get_test_performance_by_demographics from natural language. */
export function extractTestPerformanceDemographicsArgs(msg: string): {
  gender?: "male" | "female";
  district?: string;
} {
  const t = normalizeQuestionForMatch(msg);
  const hasFemale = /\bfemale\b|\bwomen\b|\bgirls\b/.test(t);
  const hasMale = /\bmale\b|\bmen\b|\bboys\b/.test(t);
  let gender: "male" | "female" | undefined;
  if (hasFemale && !hasMale) gender = "female";
  if (hasMale && !hasFemale) gender = "male";

  let district: string | undefined;
  const studentsIn = msg.match(
    /\b(?:students|learners)\s+in\s+(.+?)(?:\s*[.?!]|$)/i,
  );
  if (studentsIn) {
    district = studentsIn[1].replace(/\s+only\s*$/i, "").trim();
  }
  if (!district) {
    const inOnly = msg.match(/\bin\s+([A-Za-z][A-Za-z\s]+?)\s+only\b/i);
    if (inOnly) district = inOnly[1].trim();
  }
  if (!district) {
    const forDistrict = msg.match(
      /\b(?:in|for)\s+the\s+([A-Za-z][A-Za-z\s]+?)\s+district\b/i,
    );
    if (forDistrict) district = forDistrict[1].trim();
  }

  const out: { gender?: "male" | "female"; district?: string } = {};
  if (gender) out.gender = gender;
  if (district) out.district = district;
  return out;
}

/** Course title for learner-submitted course reviews (CourseReview), e.g. "reviews for …". */
export function extractCourseTitleForReviewsQuestion(
  msg: string,
): string | null {
  const trimmed = msg.trim().replace(/\u2019/g, "'");
  const patterns = [
    /what\s+are\s+the\s+reviews\s+for\s+(.+?)\s*$/is,
    /reviews?\s+for\s+(.+?)\s*$/is,
    /reviews?\s+of\s+(.+?)\s*$/is,
    /ratings?\s+for\s+(.+?)\s*$/is,
    /feedback\s+(?:on|for)\s+(?:the\s+)?(?:course\s+)?(.+?)\s*$/is,
    /course\s+reviews?\s+for\s+(.+?)\s*$/is,
  ];
  for (const re of patterns) {
    const m = trimmed.match(re);
    if (m) {
      let s = m[1]
        .trim()
        .replace(/[.?!]+$/g, "")
        .trim();
      s = s.replace(/^["']|["']$/g, "").trim();
      if (s.length >= 2 && s.length < 400) return s;
    }
  }
  return null;
}

export function isCourseReviewsQuestion(msg: string): boolean {
  return extractCourseTitleForReviewsQuestion(msg) != null;
}

export function isMostFailedQuestionsQuestion(msg: string): boolean {
  const t = normalizeQuestionForMatch(msg);
  return (
    t.includes("miss most") ||
    t.includes("most missed") ||
    t.includes("most often") ||
    t.includes("hardest question") ||
    t.includes("most failed question") ||
    (t.includes("question") &&
      t.includes("wrong") &&
      (t.includes("most") || t.includes("often")))
  );
}

export function isFlaggedMidTestChaptersQuestion(msg: string): boolean {
  const t = normalizeQuestionForMatch(msg);
  return (
    (t.includes("flagged") &&
      t.includes("chapter") &&
      (t.includes("mid") || t.includes("weak"))) ||
    (t.includes("weak") && t.includes("mid") && t.includes("chapter")) ||
    t.includes("mid-test performance") ||
    t.includes("mid chapter test")
  );
}

export function isPlatformTestAggregatesQuestion(msg: string): boolean {
  const t = normalizeQuestionForMatch(msg);
  if (isTestPerformanceDemographicsQuestion(msg)) return false;
  if (
    t.includes("same as above") &&
    (t.includes("tied to") || t.includes("only for"))
  ) {
    return true;
  }
  const marks = t.includes("mark") || t.includes("marks");
  const wrong = t.includes("wrong") && t.includes("answer");
  const sum = t.includes("sum");
  return (
    (t.includes("platform") && (marks || wrong || sum)) ||
    (marks && sum && t.includes("average")) ||
    (t.includes("wrong-answer rate") &&
      (t.includes("platform") || t.includes("average")))
  );
}

/** Course name after "tied to …" for scoped platform test stats. */
export function extractCourseTitleForPlatformTestAggregates(
  msg: string,
): string | null {
  const trimmed = msg.trim().replace(/\u2019/g, "'");
  const m = trimmed.match(/\btied\s+to\s+(.+?)(?:\?|$)/i);
  if (m) {
    const s = m[1]
      .trim()
      .replace(/[.?!]+$/g, "")
      .trim();
    if (s.length >= 3 && s.length < 300) return s;
  }
  return null;
}

export function isDistrictPerformanceComparisonQuestion(msg: string): boolean {
  const t = normalizeQuestionForMatch(msg);
  if (!t.includes("district")) return false;
  return (
    t.includes("compare") ||
    t.includes("comparison") ||
    (t.includes("highest") && t.includes("lowest")) ||
    (t.includes("across") && t.includes("district")) ||
    (t.includes("completion") &&
      t.includes("rate") &&
      (t.includes("which") ||
        t.includes("best") ||
        t.includes("worst") ||
        t.includes("highest")))
  );
}

export function extractGenderForDistrictComparison(
  msg: string,
): "male" | "female" | undefined {
  const t = normalizeQuestionForMatch(msg);
  const hasMale = /\bmale\b/.test(t);
  const hasFemale = /\bfemale\b/.test(t);
  if (hasMale && !hasFemale) return "male";
  if (hasFemale && !hasMale) return "female";
  return undefined;
}

/** At-risk / dropout / stalled learners — list or identify students needing follow-up. */
export function isDropoutRiskStudentsQuestion(msg: string): boolean {
  const t = normalizeQuestionForMatch(msg);
  const mentionsFollowUp =
    t.includes("needs follow-up") ||
    t.includes("need follow-up") ||
    t.includes("needs follow up") ||
    t.includes("who needs follow") ||
    t.includes("follow up with");
  const mentionsStalled =
    t.includes("stalled") && (t.includes("learner") || t.includes("student"));
  const mentionsDropout =
    t.includes("dropout") ||
    t.includes("dropping out") ||
    t.includes("drop out") ||
    t.includes("drop-outs");
  const mentionsRiskStudents =
    t.includes("at risk") &&
    (t.includes("student") ||
      t.includes("learner") ||
      t.includes("who") ||
      t.includes("which") ||
      t.includes("anyone"));
  return (
    mentionsDropout ||
    mentionsStalled ||
    mentionsFollowUp ||
    mentionsRiskStudents
  );
}

/** Course completions in a recent window — get_completions_over_time (not enrollment trend). */
export function isCompletionsOverTimeQuestion(msg: string): boolean {
  const t = normalizeQuestionForMatch(msg);
  if (
    t.includes("enroll") &&
    !t.includes("complet") &&
    !t.includes("finish") &&
    !t.includes("finished")
  ) {
    return false;
  }
  const asksFinishing =
    (t.includes("finish") && (t.includes("course") || t.includes("courses"))) ||
    (t.includes("finished") && t.includes("course")) ||
    (t.includes("complet") &&
      (t.includes("course") || t.includes("courses"))) ||
    t.includes("completions") ||
    (t.includes("how many") &&
      t.includes("student") &&
      (t.includes("finish") || t.includes("complet")));
  const periods = extractCompletionsPeriodsFromQuestion(msg);
  const asksTime = periods.length > 0;
  return asksFinishing && asksTime;
}

/** Which period keys appear (order preserved). */
export function extractCompletionsPeriodsFromQuestion(msg: string): string[] {
  const t = normalizeQuestionForMatch(msg);
  const out: string[] = [];
  const push = (p: string) => {
    if (!out.includes(p)) out.push(p);
  };
  if (/\blast\s+week\b|\bpast\s+week\b/.test(t)) push("last_week");
  if (/\bthis\s+month\b/.test(t)) push("this_month");
  if (/\blast\s+month\b|\bpast\s+month\b/.test(t)) push("last_month");
  if (/\blast\s+year\b|\bpast\s+year\b/.test(t)) push("last_year");
  return out;
}

/**
 * Platform-wide totals: how many certificate records exist, how many students have ≥1.
 * Not for district-filtered counts (use get_students_with_certificate_by_district).
 */
/** Courses with highest completion / best outcomes — get_course_completion_rates.byCompletionRate. */
export function isTopPerformingCoursesQuestion(msg: string): boolean {
  const t = normalizeQuestionForMatch(msg);
  if (!t.includes("course") && !t.includes("courses")) return false;
  if (/\btop\s+student/.test(t) || /\bbest\s+student/.test(t)) return false;
  if (t.includes("district") || t.includes("sector")) return false;
  return (
    (t.includes("top") && t.includes("perform")) ||
    (t.includes("best") && t.includes("perform")) ||
    (t.includes("highest") &&
      (t.includes("completion") || t.includes("perform"))) ||
    (t.includes("succeed") && (t.includes("more") || t.includes("most"))) ||
    (t.includes("perform") && t.includes("best") && t.includes("course"))
  );
}

export function isPlatformCertificateTotalsQuestion(msg: string): boolean {
  const t = normalizeQuestionForMatch(msg);
  if (!t.includes("certif")) return false;
  if (
    t.includes("zero certificate") ||
    t.includes("without certificate") ||
    t.includes("no certificate")
  ) {
    return false;
  }
  if (t.includes("district")) return false;
  if (t.includes("review")) return false;
  return (
    t.includes("how many") ||
    t.includes("total") ||
    t.includes("number of") ||
    (t.includes("count") && t.includes("certif")) ||
    (t.includes("certificate") &&
      (t.includes("received") || t.includes("issued") || t.includes("earned")))
  );
}

export function isDashboardStatisticsQuestion(msg: string): boolean {
  const t = normalizeQuestionForMatch(msg);
  if (t.includes("district") || t.includes("sector") || t.includes("per ")) {
    return false;
  }
  if (
    t.includes("enrolled in") ||
    t.includes("in progress") ||
    t.includes("haven't") ||
    t.includes("have not")
  ) {
    return false;
  }
  if (t.includes("female") || t.includes("male") || t.includes("gender")) {
    return false;
  }
  if (t.includes("certificate") && !/\bstudent/.test(t)) return false;
  const howMany =
    t.includes("how many") ||
    t.includes("total number") ||
    t.includes("number of");
  const students =
    t.includes("student") || t.includes("trainee") || t.includes("learner");
  const courses = t.includes("course");
  const completion = t.includes("completion rate");
  return howMany && (students || courses || completion);
}
