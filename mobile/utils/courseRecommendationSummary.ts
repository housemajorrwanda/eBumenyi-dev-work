import type {
  IPostCourseRecommendationsData,
  IPostCourseRecommendationChapter,
  PostCourseRecommendationReason,
} from '@/types';

export type SummaryContext = {
  fullNames?: string | null;
  district?: string | null;
  sector?: string | null;
};

function firstName(fullNames: string): string {
  const trimmed = fullNames.trim();
  if (!trimmed) return 'mukoresha';
  return trimmed.split(/\s+/)[0] ?? trimmed;
}

function locationBit(district?: string | null, sector?: string | null): string {
  if (district?.trim()) return ` wo mu Karere ka ${district.trim()}`;
  if (sector?.trim()) return ` wo mu ${sector.trim()}`;
  return '';
}

function formatElapsed(hours: number | null): string | null {
  if (hours == null || hours <= 0) return null;
  if (hours < 1) {
    const mins = Math.round(hours * 60);
    return mins <= 1 ? "munsi y'iminota imwe" : `iminota ${mins}`;
  }
  const rounded = Math.round(hours * 10) / 10;
  return rounded === 1 ? 'isaha imwe' : `masaha ${rounded}`;
}

function formatExpected(minutes: number): string {
  if (minutes < 60) return `iminota ${minutes}`;
  const hours = Math.round((minutes / 60) * 10) / 10;
  return hours === 1 ? 'isaha imwe' : `masaha ${hours}`;
}

function primaryReason(
  reason: PostCourseRecommendationReason,
  ch: IPostCourseRecommendationChapter,
): string | null {
  switch (reason) {
    case 'no_attempt':
      return ch.attemptCount === 0 ? 'ntiwigeze ukora ikizamini' : null;
    case 'below_pass':
      if (ch.bestMarks != null && ch.marksToPass != null) {
        const gap = ch.marksToPass - ch.bestMarks;
        return gap > 0
          ? `amanota ${ch.bestMarks}% (akenka ${gap}% ngo ube wanyuze)`
          : `amanota ${ch.bestMarks}% ari hasi y'agenzura`;
      }
      return "amanota ari hasi y'agenzura";
    case 'barely_passed':
      return ch.bestMarks != null
        ? `wanyereye gusa (${ch.bestMarks}%)`
        : 'wanyereye gusa ku kizamini';
    case 'incomplete_slides':
      return 'amashusho menshi ntiyarangije';
    case 'fast_pace_review':
      return 'warisuye vuba — bisaba gusubiramo';
    default:
      return null;
  }
}

function worstChapterLine(ch: IPostCourseRecommendationChapter): string | null {
  for (const reason of ch.reasons) {
    const line = primaryReason(reason, ch);
    if (line) return `Icyiciro ${ch.chapterNumber}: ${line}`;
  }
  return null;
}

function chapterStats(chapters: IPostCourseRecommendationChapter[]) {
  const belowPass = chapters.filter((c) => c.reasons.includes('below_pass'));
  const withMarks = chapters.filter((c) => c.bestMarks != null && c.attemptCount > 0);

  return {
    noAttemptCount: chapters.filter(
      (c) => c.attemptCount === 0 || c.reasons.includes('no_attempt'),
    ).length,
    belowPassCount: belowPass.length,
    barelyPassedCount: chapters.filter((c) => c.reasons.includes('barely_passed')).length,
    incompleteCount: chapters.filter((c) => c.reasons.includes('incomplete_slides')).length,
    totalAttempts: chapters.reduce((sum, c) => sum + c.attemptCount, 0),
    worstBelowPass: [...belowPass]
      .filter((c) => c.bestMarks != null)
      .sort((a, b) => (a.bestMarks ?? 0) - (b.bestMarks ?? 0))[0],
    avgMarks:
      withMarks.length > 0
        ? Math.round(
            withMarks.reduce((sum, c) => sum + (c.bestMarks ?? 0), 0) / withMarks.length,
          )
        : null,
  };
}

export function buildCoursePerformanceSummary(
  data: IPostCourseRecommendationsData,
  ctx?: SummaryContext | string | null,
): string {
  const context: SummaryContext =
    typeof ctx === 'string' || ctx == null ? { fullNames: ctx } : ctx;

  const name = firstName(context.fullNames ?? '');
  const location = locationBit(context.district, context.sector);
  const { courseTitle, completedQuickly, chapters, elapsedHours, expectedLessonMinutes } =
    data;

  const parts: string[] = [
    `Muraho ${name}${location}! Urangije «${courseTitle}».`,
  ];

  const elapsed = formatElapsed(elapsedHours);
  const expected = formatExpected(expectedLessonMinutes);

  if (elapsed) {
    parts.push(
      completedQuickly
        ? `Warangije mu ${elapsed}, aho amasomo yari yateganyijwe nka ${expected} — waginze vuba cyane.`
        : `Warangije mu ${elapsed} (amasomo yari yateganyijwe nka ${expected}).`,
    );
  } else if (completedQuickly) {
    parts.push(
      `Warangije vuba ku buryo butandukanye n'igihe cy'amasomo (byateganyijwe nka ${expected}).`,
    );
  }

  if (chapters.length === 0) {
    parts.push(
      'Umusaruro wawe ku masomo ya hagati ni mwiza — nta cyiciro cyagaragaye nko kugira ngo usubiremo. Komeza utyo!',
    );
    return parts.join(' ');
  }

  const stats = chapterStats(chapters);
  const highCount = chapters.filter((c) => c.severity === 'high').length;
  const moderateCount = chapters.filter((c) => c.severity === 'moderate').length;

  const testBits: string[] = [];
  if (stats.totalAttempts > 0) {
    testBits.push(
      `wakoze ibizamini inshuro ${stats.totalAttempts} ku bice ${chapters.length} byagaragaye`,
    );
  }
  if (stats.avgMarks != null && stats.belowPassCount + stats.barelyPassedCount > 0) {
    testBits.push(`amanota yawe agera kuri ${stats.avgMarks}%`);
  }
  if (testBits.length > 0) {
    parts.push(`Mu by'ibizamini, ${testBits.join(', ')}.`);
  }

  if (stats.worstBelowPass) {
    const line = worstChapterLine(stats.worstBelowPass);
    if (line) parts.push(`${line} — ari nacyo gikomeye cyane.`);
  } else if (stats.noAttemptCount === chapters.length) {
    parts.push(
      `Ntiwigeze ukora ibizamini ${stats.noAttemptCount} by'icyiciro byose byagaragaye hano — bisaba ko utangira ukore ibizamini bya buri cyiciro.`,
    );
  } else if (stats.noAttemptCount > 0) {
    const word = stats.noAttemptCount === 1 ? "ry'icyiciro" : "by'icyiciro";
    parts.push(`Ntiwigeze ukora ibizamini ${stats.noAttemptCount} ${word}.`);
  }

  if (stats.barelyPassedCount > 0 && !stats.worstBelowPass) {
    parts.push(
      `Hari ibice ${stats.barelyPassedCount} aho wanyereye gusa — bisaba kongera kwiga.`,
    );
  }

  if (stats.incompleteCount > 0) {
    const verb =
      stats.incompleteCount === 1 ? 'ntiyarangije' : 'ntiyarangije neza';
    parts.push(`Kandi hari amashusho ${stats.incompleteCount} ${verb} ku bice bimwe.`);
  }

  if (highCount > 0) {
    const moderate =
      moderateCount > 0 ? `, ${moderateCount} biringaniye` : '';
    parts.push(
      `Turagusaba gusubiramo ibice ${chapters.length} bikurikira — ${highCount} by'ingenzi cyane${moderate}.`,
    );
  } else {
    parts.push(
      `Turagusaba gusubiramo ibice ${chapters.length} bikurikira kugira ngo umenye neza.`,
    );
  }

  return parts.join(' ');
}
