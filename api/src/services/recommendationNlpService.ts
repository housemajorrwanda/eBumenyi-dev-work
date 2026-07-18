export type RecReason =
  | "no_attempt"
  | "below_pass"
  | "barely_passed"
  | "fast_pace_review"
  | "incomplete_slides";

export type Severity = "high" | "moderate" | "low";

export interface RecommendationChapterInput {
  chapterId: string;
  sectionId: string;
  chapterTitle: string;
  chapterNumber: number;
  bestMarks: number | null;
  marksToPass: number | null;
  attemptCount: number;
  reasons: RecReason[];
  severity: Severity;
}

export interface ConversationalMessage {
  id: string;
  role: "assistant";
  content: string;
  chapterId?: string;
  sectionId?: string;
  actionLabel?: string;
  severity?: Severity;
}

export interface ConversationalRecommendationResult {
  messages: ConversationalMessage[];
  generatedByNlp: boolean;
}

type RecommendationNlpInput = {
  studentFirstName: string;
  courseTitle: string;
  completedQuickly: boolean;
  chapters: RecommendationChapterInput[];
};

function firstNameFrom(fullNames: string): string {
  const trimmed = fullNames.trim();
  if (!trimmed) return "mukoresha";
  return trimmed.split(/\s+/)[0] ?? trimmed;
}

function reasonPhraseRw(
  reasons: RecReason[],
  attemptCount: number,
  bestMarks: number | null,
  marksToPass: number | null,
): string {
  const visible = reasons.filter((r) => r !== "no_attempt");
  if (visible.length === 0 && attemptCount === 0) {
    return "ntiwigeze ukora ikizamini cy'iki cyiciro";
  }
  const parts: string[] = [];
  if (reasons.includes("below_pass") && bestMarks != null && marksToPass != null) {
    parts.push(`amanota yawe (${bestMarks}) yari hasi y'agenzura (${marksToPass})`);
  } else if (reasons.includes("barely_passed")) {
    parts.push("wanyereye gusa ku kizamini");
  }
  if (reasons.includes("incomplete_slides")) {
    parts.push("amashusho menshi ntiyarangije neza");
  }
  if (reasons.includes("fast_pace_review")) {
    parts.push("bisaba gusubiramo vuba");
  }
  return parts.join(", ") || "bisaba gusubiramo";
}

function buildFallbackMessages(input: RecommendationNlpInput): ConversationalMessage[] {
  const name = input.studentFirstName;
  const { courseTitle, completedQuickly, chapters } = input;
  const messages: ConversationalMessage[] = [];

  if (chapters.length === 0) {
    messages.push({
      id: "intro",
      role: "assistant",
      content: completedQuickly
        ? `Muraho ${name}! Warangije «${courseTitle}» vuba cyane, ariko ukoze neza ku masomo ya hagati. Komeza utyo — urimo gukora neza!`
        : `Muraho ${name}! Nasanze ko umusaruro wawe kuri «${courseTitle}» ni mwiza. Urakoze cyane — komeza utyo!`,
    });
    messages.push({
      id: "closing",
      role: "assistant",
      content: "Niba ushaka gusubiramo ibice by'isomo, kanda hepfo ujye ku isomo.",
      actionLabel: "Jya ku isomo",
    });
    return messages;
  }

  messages.push({
    id: "intro",
    role: "assistant",
    content: completedQuickly
      ? `Muraho ${name}! Urangije «${courseTitle}», ariko nabyibutse ko warangije vuba — reba neza ibi bice nkurikira.`
      : `Muraho ${name}! Nasanze ibitabo byawe bya «${courseTitle}» — mfite inama nke zishobora kugufasha gukomeza neza.`,
  });

  chapters.forEach((ch) => {
    const why = reasonPhraseRw(
      ch.reasons,
      ch.attemptCount,
      ch.bestMarks,
      ch.marksToPass,
    );
    messages.push({
      id: `chapter-${ch.chapterId}`,
      role: "assistant",
      content: `Icyiciro ${ch.chapterNumber}\n${ch.chapterTitle}\n\n${why}. Subiramo umenye neza.`,
      chapterId: ch.chapterId,
      sectionId: ch.sectionId,
      actionLabel: "Jya ku cyiciro",
      severity: ch.severity,
    });
  });

  messages.push({
    id: "closing",
    role: "assistant",
    content: `Ushobora gusubiramo buri cyiciro cyangwa ukajya ku isomo «${courseTitle}» uhereye aho ukeneye. Niba ukeneye ubufasha, ntuzuyaze kutubaza!`,
    actionLabel: "Jya ku isomo",
  });

  return messages;
}

export function extractStudentFirstName(fullNames: string | null | undefined): string {
  return firstNameFrom(fullNames ?? "");
}

export function buildTemplateConversationalRecommendations(
  input: RecommendationNlpInput,
): ConversationalRecommendationResult {
  return { messages: buildFallbackMessages(input), generatedByNlp: false };
}

export async function generateConversationalRecommendations(
  input: RecommendationNlpInput,
): Promise<ConversationalRecommendationResult> {
  return buildTemplateConversationalRecommendations(input);
}
