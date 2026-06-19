import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Pressable,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getPostCourseRecommendations } from '@/services/course.api';
import type {
  IPostCourseRecommendationsData,
  IPostCourseRecommendationChapter,
  PostCourseRecommendationReason,
  PostCourseRecommendationSeverity,
} from '@/types';
import { getApiErrorMessage } from '@/utils/apiError';

function reasonLabelRw(reason: PostCourseRecommendationReason): string {
  switch (reason) {
    case 'below_pass':
      return 'Amanota hasi';
    case 'barely_passed':
      return 'Wanyereye gusa';
    case 'fast_pace_review':
      return 'Subiramo (byihutiye)';
    case 'incomplete_slides':
      return 'Amashusho atarakozwa neza';
    default:
      return reason;
  }
}

interface SeverityTheme {
  label: string;
  border: string;
  badgeBg: string;
  badgeText: string;
  pillBg: string;
  pillText: string;
  chipBg: string;
  chipText: string;
  btnBorder: string;
  btnText: string;
}

const SEVERITY_THEMES: Record<PostCourseRecommendationSeverity, SeverityTheme> = {
  high: {
    label: 'Bikomeye',
    border: '#DC2626',
    badgeBg: '#DC2626',
    badgeText: '#FFFFFF',
    pillBg: '#FEE2E2',
    pillText: '#991B1B',
    chipBg: '#FEE2E2',
    chipText: '#991B1B',
    btnBorder: '#DC2626',
    btnText: '#B91C1C',
  },
  moderate: {
    label: 'Biringaniye',
    border: '#D97706',
    badgeBg: '#D97706',
    badgeText: '#FFFFFF',
    pillBg: '#FEF3C7',
    pillText: '#92400E',
    chipBg: '#FEF3C7',
    chipText: '#92400E',
    btnBorder: '#D97706',
    btnText: '#B45309',
  },
  low: {
    label: 'Byoroheje',
    border: '#059669',
    badgeBg: '#059669',
    badgeText: '#FFFFFF',
    pillBg: '#D1FAE5',
    pillText: '#065F46',
    chipBg: '#E0F2FE',
    chipText: '#075985',
    btnBorder: '#059669',
    btnText: '#047857',
  },
};

export interface PostCourseRecommendationsModalProps {
  visible: boolean;
  /** When missing or invalid, the modal shows an error message. */
  courseId: string | null | undefined;
  onClose: () => void;
}

export default function PostCourseRecommendationsModal({
  visible,
  courseId,
  onClose,
}: PostCourseRecommendationsModalProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = Dimensions.get('window');
  const [recLoading, setRecLoading] = useState(false);
  const [recError, setRecError] = useState<string | null>(null);
  const [recData, setRecData] = useState<IPostCourseRecommendationsData | null>(null);

  useEffect(() => {
    if (!visible) {
      setRecData(null);
      setRecError(null);
      setRecLoading(false);
      return;
    }

    if (!courseId || courseId === 'undefined') {
      setRecLoading(false);
      setRecError(
        'Id ya somo ntabwo ihari. Subira winjire ku rubuga rw’impamyabumenyi.',
      );
      setRecData(null);
      return;
    }

    let cancelled = false;
    setRecLoading(true);
    setRecError(null);
    setRecData(null);

    getPostCourseRecommendations(courseId)
      .then((res) => {
        if (!cancelled) setRecData(res.data);
      })
      .catch((e: unknown) => {
        if (!cancelled) setRecError(getApiErrorMessage(e));
      })
      .finally(() => {
        if (!cancelled) setRecLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [visible, courseId]);

  const buildRecommendedParam = (data: IPostCourseRecommendationsData): string =>
    data.chapters.map((c) => `${c.chapterId}:${c.severity}`).join(',');

  const goToCourseChapter = (sectionId: string | undefined) => {
    if (!recData) return;
    const recommended = buildRecommendedParam(recData);
    const params: Record<string, string> = { recommended };
    if (sectionId) params.sectionId = sectionId;
    router.push({
      pathname: `/courses/${recData.courseId}/chapters`,
      params,
    } as never);
    onClose();
  };

  const goToCourseFromRecommendation = () => {
    if (!recData) return;
    goToCourseChapter(recData.chapters[0]?.sectionId);
  };

  const renderRecommendationBody = (data: IPostCourseRecommendationsData) => {
    const hasChapters = data.chapters.length > 0;

    if (!hasChapters) {
      return (
        <>
          <Text style={styles.recModalBody}>{data.summaryMessageRw}</Text>
          <TouchableOpacity
            style={styles.recModalPrimaryBtn}
            onPress={goToCourseFromRecommendation}
          >
            <Text style={styles.recModalPrimaryBtnText}>Jya ku isomo</Text>
          </TouchableOpacity>
        </>
      );
    }

    return (
      <>
        <Text style={styles.recModalCourseTitle}>{data.courseTitle}</Text>
        {data.completedQuickly ? (
          <View style={styles.recCallout}>
            <Text style={styles.recCalloutTitle}>Warangiye vuba</Text>
            <Text style={styles.recCalloutBody}>
              Warangije isomo vuba ku buryo butandukanye n&apos;igihe cy&apos;amasomo;
              reba neza ibice byerekana hano no ku isomo.
            </Text>
          </View>
        ) : null}
        <Text style={styles.recModalSectionLabel}>
          Turagusaba kongera usubiremo ibi bice by&apos;inyongera:
        </Text>
        {data.chapters.map((ch: IPostCourseRecommendationChapter) => {
          const theme = SEVERITY_THEMES[ch.severity] ?? SEVERITY_THEMES.moderate;
          const visibleReasons = ch.reasons.filter((r) => r !== 'no_attempt');
          return (
            <View
              key={ch.chapterId}
              style={[styles.recChapterCard, { borderLeftColor: theme.border }]}
            >
              <View style={styles.recChapterTopRow}>
                <View
                  style={[styles.recChapterBadge, { backgroundColor: theme.badgeBg }]}
                >
                  <Text
                    style={[styles.recChapterBadgeText, { color: theme.badgeText }]}
                  >
                    {ch.chapterNumber}
                  </Text>
                </View>
                <Text style={styles.recChapterTitle} numberOfLines={4}>
                  {ch.chapterTitle}
                </Text>
                <View
                  style={[styles.recSeverityPill, { backgroundColor: theme.pillBg }]}
                >
                  <View style={[styles.recSeverityDot, { backgroundColor: theme.border }]} />
                  <Text style={[styles.recSeverityPillText, { color: theme.pillText }]}>
                    {theme.label}
                  </Text>
                </View>
              </View>
              {visibleReasons.length > 0 ? (
                <View style={styles.recChipWrap}>
                  {visibleReasons.map((r) => (
                    <View
                      key={r}
                      style={[styles.recChip, { backgroundColor: theme.chipBg }]}
                    >
                      <Text style={[styles.recChipText, { color: theme.chipText }]}>
                        {reasonLabelRw(r)}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
              <View style={styles.recMetricsBox}>
                {ch.attemptCount > 0 ? (
                  <Text style={styles.recMetricsText}>
                    Inshuro: {ch.attemptCount} · Amanota hejuru: {ch.bestMarks ?? '—'} ·
                    Agenzu: {ch.marksToPass ?? '—'}
                  </Text>
                ) : (
                  <Text style={styles.recMetricsMuted}>
                    Amasomo yo kuri iki cyiciro ntago yizwe neza, subiramo.
                  </Text>
                )}
              </View>
              <TouchableOpacity
                style={[styles.recChapterBtn, { borderColor: theme.btnBorder }]}
                onPress={() => goToCourseChapter(ch.sectionId)}
                activeOpacity={0.85}
              >
                <Text style={[styles.recChapterBtnText, { color: theme.btnText }]}>
                  Jya ku cyiciro
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
        <TouchableOpacity
          style={styles.recModalPrimaryBtn}
          onPress={goToCourseFromRecommendation}
        >
          <Text style={styles.recModalPrimaryBtnText}>Jya ku isomo</Text>
        </TouchableOpacity>
      </>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.recModalOverlay}>
        <Pressable style={styles.recModalBackdrop} onPress={onClose} />
        <View
          style={[
            styles.recModalCard,
            { maxHeight: windowHeight * 0.9, paddingBottom: Math.max(insets.bottom, 14) },
          ]}
        >
          <View style={styles.recModalGrabber} />
          <Text style={styles.recModalTitle}>Inama z&apos;inyongera</Text>
          {recLoading ? (
            <View style={styles.recModalLoading}>
              <ActivityIndicator size="large" color="#3363AD" />
              <Text style={styles.recModalHint}>Turimo gutegura inama…</Text>
            </View>
          ) : recError ? (
            <Text style={styles.recModalError}>{recError}</Text>
          ) : recData ? (
            <ScrollView
              style={[styles.recModalScroll, { maxHeight: windowHeight * 0.62 }]}
              contentContainerStyle={styles.recModalScrollContent}
              showsVerticalScrollIndicator
            >
              {renderRecommendationBody(recData)}
            </ScrollView>
          ) : null}
          <TouchableOpacity style={styles.recModalCloseBtn} onPress={onClose}>
            <Text style={styles.recModalCloseBtnText}>Funga</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  recModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  recModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  recModalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 8,
    zIndex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 16,
  },
  recModalGrabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    marginBottom: 12,
  },
  recModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#3363AD',
    marginBottom: 10,
  },
  recModalCourseTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 14,
    lineHeight: 22,
  },
  recModalScroll: {},
  recModalScrollContent: {
    paddingBottom: 12,
  },
  recModalBody: {
    fontSize: 15,
    lineHeight: 24,
    color: '#1f2937',
    marginBottom: 16,
  },
  recModalSectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
    lineHeight: 20,
  },
  recCallout: {
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  recCalloutTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#B45309',
    marginBottom: 4,
  },
  recCalloutBody: {
    fontSize: 13,
    lineHeight: 19,
    color: '#92400E',
  },
  recChapterCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderLeftWidth: 4,
    borderLeftColor: '#3363AD',
  },
  recChapterTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  recSeverityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  recSeverityDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  recSeverityPillText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  recChapterBadge: {
    minWidth: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#3363AD',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  recChapterBadgeText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  recChapterTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
    lineHeight: 21,
  },
  recChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  recChip: {
    backgroundColor: '#E8EEF7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  recChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3363AD',
  },
  recMetricsBox: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#CBD5E1',
  },
  recMetricsText: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },
  recMetricsMuted: {
    fontSize: 13,
    color: '#64748B',
    fontStyle: 'italic',
  },
  recChapterBtn: {
    marginTop: 12,
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#3363AD',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  recChapterBtnText: {
    color: '#3363AD',
    fontWeight: '700',
    fontSize: 14,
  },
  recModalLoading: {
    paddingVertical: 24,
    alignItems: 'center',
    gap: 12,
  },
  recModalHint: {
    fontSize: 14,
    color: '#6B7280',
  },
  recModalError: {
    fontSize: 15,
    color: '#b91c1c',
    marginBottom: 12,
  },
  recModalPrimaryBtn: {
    backgroundColor: '#3363AD',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  recModalPrimaryBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  recModalCloseBtn: {
    marginTop: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  recModalCloseBtnText: {
    color: '#3363AD',
    fontWeight: '600',
    fontSize: 16,
  },
});
