import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Bot } from 'lucide-react-native';
import StreamingText from '@/components/StreamingText';
import { SEVERITY_DOT } from '@/constants/recommendations';
import type {
  IPostCourseRecommendationsData,
  IPostCourseRecommendationChapter,
  PostCourseRecommendationSeverity,
} from '@/types';
import {
  buildCoursePerformanceSummary,
  type SummaryContext,
} from '@/utils/courseRecommendationSummary';

const CHAPTER_LIST_LABEL = 'Ibice usabwe gusubiramo:';

function SeverityDot({ severity }: { severity: PostCourseRecommendationSeverity }) {
  return (
    <View style={[styles.severityDot, { backgroundColor: SEVERITY_DOT[severity] }]} />
  );
}

function CoachBubble({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.messageRow}>
      <View style={styles.avatar}>
        <Bot size={18} color="#3363AD" />
      </View>
      <View style={styles.messageContent}>
        <View style={styles.bubble}>{children}</View>
      </View>
    </View>
  );
}

type StreamingChapterListProps = {
  chapters: IPostCourseRecommendationChapter[];
  onGoToChapter: (sectionId: string) => void;
  onComplete: () => void;
};

function StreamingChapterList({
  chapters,
  onGoToChapter,
  onComplete,
}: StreamingChapterListProps) {
  const [activeIndex, setActiveIndex] = useState(-1);

  const done = activeIndex >= 0 ? chapters.slice(0, activeIndex) : [];
  const current =
    activeIndex >= 0 && activeIndex < chapters.length ? chapters[activeIndex] : null;

  const onLabelDone = () => setActiveIndex(0);
  const onChapterDone = () => {
    if (activeIndex + 1 >= chapters.length) onComplete();
    else setActiveIndex((n) => n + 1);
  };

  return (
    <CoachBubble>
      {activeIndex === -1 ? (
        <StreamingText
          text={CHAPTER_LIST_LABEL}
          style={styles.listLabel}
          onComplete={onLabelDone}
        />
      ) : (
        <Text style={styles.listLabel}>{CHAPTER_LIST_LABEL}</Text>
      )}

      <View style={styles.list}>
        {done.map((ch) => (
          <TouchableOpacity
            key={ch.chapterId}
            style={styles.bulletRow}
            onPress={() => onGoToChapter(ch.sectionId)}
            activeOpacity={0.7}
          >
            <SeverityDot severity={ch.severity} />
            <Text style={styles.bulletText} numberOfLines={3}>
              {ch.chapterTitle}
            </Text>
          </TouchableOpacity>
        ))}

        {current ? (
          <View style={styles.bulletRow}>
            <SeverityDot severity={current.severity} />
            <StreamingText
              key={current.chapterId}
              text={current.chapterTitle}
              style={styles.bulletText}
              onComplete={onChapterDone}
            />
          </View>
        ) : null}
      </View>
    </CoachBubble>
  );
}

type RecommendationBodyProps = {
  data: IPostCourseRecommendationsData;
  userContext: SummaryContext;
  onGoToChapter: (sectionId: string) => void;
  onGoToCourse: () => void;
};

export default function RecommendationBody({
  data,
  userContext,
  onGoToChapter,
  onGoToCourse,
}: RecommendationBodyProps) {
  const [summaryDone, setSummaryDone] = useState(false);
  const [chaptersDone, setChaptersDone] = useState(false);

  const summary = useMemo(
    () => buildCoursePerformanceSummary(data, userContext),
    [data, userContext],
  );

  const chapters = data.chapters ?? [];
  const showChapters = summaryDone && chapters.length > 0;
  const showButton = chapters.length > 0 ? chaptersDone : summaryDone;

  return (
    <View style={styles.container}>
      <CoachBubble>
        <StreamingText
          key={summary}
          text={summary}
          onComplete={() => setSummaryDone(true)}
        />
      </CoachBubble>

      {showChapters ? (
        <StreamingChapterList
          chapters={chapters}
          onGoToChapter={onGoToChapter}
          onComplete={() => setChaptersDone(true)}
        />
      ) : null}

      {showButton ? (
        <TouchableOpacity style={styles.primaryBtn} onPress={onGoToCourse} activeOpacity={0.85}>
          <Text style={styles.primaryBtnText}>Jya ku isomo</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 4 },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E8EEF7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    flexShrink: 0,
  },
  messageContent: { flex: 1, maxWidth: '88%' },
  bubble: {
    backgroundColor: '#fff',
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  listLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 10,
  },
  list: { gap: 10 },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 2,
  },
  severityDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    marginTop: 6,
    flexShrink: 0,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: '#1e293b',
    fontWeight: '500',
  },
  primaryBtn: {
    marginTop: 12,
    marginHorizontal: 2,
    backgroundColor: '#3363AD',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});
