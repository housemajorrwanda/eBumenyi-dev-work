import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Pressable,
  Dimensions,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bot } from 'lucide-react-native';
import { getPostCourseRecommendations } from '@/services/course.api';
import type { IPostCourseRecommendationsData } from '@/types';
import { getApiErrorMessage } from '@/utils/apiError';
import { useAuth } from '@/hooks/useAuth';
import RecommendationBody from '@/components/RecommendationBody';
import { toRecommendedQueryParam } from '@/constants/recommendations';

export interface PostCourseRecommendationsModalProps {
  visible: boolean;
  /** When missing or invalid, the modal shows an error message. */
  courseId: string | null | undefined;
  onClose: () => void;
}

function TypingIndicator() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const DURATION = 350;
    const DELAY = 150;
    const makeAnim = (dot: Animated.Value, startDelay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(startDelay),
          Animated.timing(dot, { toValue: 1, duration: DURATION, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: DURATION, useNativeDriver: true }),
          Animated.delay(DELAY * 3 - startDelay),
        ]),
      );
    const a1 = makeAnim(dot1, 0);
    const a2 = makeAnim(dot2, DELAY);
    const a3 = makeAnim(dot3, DELAY * 2);
    a1.start();
    a2.start();
    a3.start();
    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [dot1, dot2, dot3]);

  const lift = (dot: Animated.Value) =>
    dot.interpolate({ inputRange: [0, 1], outputRange: [0, -4] });

  return (
    <View style={styles.typingRow}>
      <View style={styles.assistantAvatar}>
        <Bot size={18} color="#3363AD" />
      </View>
      <View style={styles.typingBubble}>
        {[dot1, dot2, dot3].map((dot, i) => (
          <Animated.View
            key={i}
            style={[styles.typingDot, { transform: [{ translateY: lift(dot) }] }]}
          />
        ))}
      </View>
    </View>
  );
}

export default function PostCourseRecommendationsModal({
  visible,
  courseId,
  onClose,
}: PostCourseRecommendationsModalProps) {
  const router = useRouter();
  const { user } = useAuth();
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
        'Id ya somo ntabwo ihari. Subira winjire ku rubuga rw\u2019impamyabumenyi.',
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

  const buildRecommendedParam = (data: IPostCourseRecommendationsData) =>
    toRecommendedQueryParam(data.chapters);

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

  const userContext = useMemo(
    () => ({
      fullNames: user?.fullNames,
      district: user?.district,
      sector: user?.sector,
    }),
    [user?.fullNames, user?.district, user?.sector],
  );

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
          <View style={styles.headerRow}>
            <View style={styles.headerAvatar}>
              <Bot size={20} color="#fff" />
            </View>
            <View>
              <Text style={styles.recModalTitle}>Inama z&apos;inyongera</Text>
              <Text style={styles.recModalSubtitle}>Umujyanama w&apos;amasomo</Text>
            </View>
          </View>

          {recLoading ? (
            <View style={styles.recModalLoading}>
              <TypingIndicator />
              <Text style={styles.recModalHint}>Turimo gutegura inama zawe…</Text>
            </View>
          ) : recError ? (
            <Text style={styles.recModalError}>{recError}</Text>
          ) : recData ? (
            <ScrollView
              style={[styles.recModalScroll, { maxHeight: windowHeight * 0.62 }]}
              contentContainerStyle={styles.recModalScrollContent}
              showsVerticalScrollIndicator
            >
              <RecommendationBody
                key={`${recData.courseId}-${user?.fullNames ?? 'anon'}`}
                data={recData}
                userContext={userContext}
                onGoToChapter={(sectionId) => goToCourseChapter(sectionId)}
                onGoToCourse={goToCourseFromRecommendation}
              />
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
    backgroundColor: '#F0F4F8',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
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
    backgroundColor: '#CBD5E1',
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3363AD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recModalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1e293b',
  },
  recModalSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 1,
  },
  recModalScroll: {},
  recModalScrollContent: {
    paddingBottom: 12,
  },
  assistantAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E8EEF7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    flexShrink: 0,
  },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingVertical: 8,
    paddingHorizontal: 2,
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#fff',
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  typingDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#94A3B8',
  },
  recModalLoading: {
    paddingVertical: 20,
    paddingHorizontal: 2,
    gap: 12,
  },
  recModalHint: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
  },
  recModalError: {
    fontSize: 15,
    color: '#b91c1c',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  recModalCloseBtn: {
    marginTop: 8,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 4,
  },
  recModalCloseBtnText: {
    color: '#3363AD',
    fontWeight: '600',
    fontSize: 16,
  },
});
