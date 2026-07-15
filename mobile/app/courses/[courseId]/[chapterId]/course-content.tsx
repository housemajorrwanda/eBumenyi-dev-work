/* eslint-disable react-hooks/exhaustive-deps */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, useWindowDimensions, Alert, Modal, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Header from '@/components/Header';
import DocumentViewer from '@/components/DocumentViewer';
import LastSlide from '@/components/LastSlide';
import ChapterReviewCard from '@/components/ChapterReviewCard';
import { ICourse, IChapter } from '@/types';
import { getCourseById, getChapterById, createSlideProgressById, getMidTestById, getStudentCourseProgressByCourseId, addChapterreview, getMyChapterReviews } from '@/services/course.api';
import Footer from '@/components/Footer';
import PagerView from 'react-native-pager-view';
import TopToolbar from '@/components/common/TopToolbar';
import BottomToolBar from '@/components/common/BottomToolBar';
import * as ScreenOrientation from 'expo-screen-orientation';
import StorageService from '@/services/storage.service';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { Pin, PinOff, Volume2 } from 'lucide-react-native';
import { SlideNarratorHost, SlideNarratorUiState } from '@/components/course/SlideNarratorHost';
import {
  DEFAULT_NARRATION_VOICE,
  loadNarrationVoice,
  NarrationVoice,
} from '@/services/narrationVoice';

interface QuestionnaireAnswer {
  selectedOption?: number;
  selectedLabel?: string;
  correctLabel?: string;
  confirmed?: boolean;
  isCorrect?: boolean;
  hasAnswered?: boolean;
  questionText?: string;
}

export default function CourseContentScreen() {
  const { courseId, chapterId, slideId } = useLocalSearchParams<{ courseId: string, chapterId: string, slideId?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [currentPage, setCurrentPage] = useState<number>(0);

  const [course, setCourse] = useState<ICourse | null>(null);
  const [chapter, setChapter] = useState<IChapter | null>(null);
  const [loading, setLoading] = useState(true);
  const [transformedData, setTransformedData] = useState<any[]>([]);
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const pagerRef = useRef<PagerView>(null);
  const [hasNavigatedToSlideId, setHasNavigatedToSlideId] = useState<boolean>(false);

  // State to track questionnaire answers
  const [questionnaireAnswers, setQuestionnaireAnswers] = useState<{ 
    [key: string]: QuestionnaireAnswer 
  }>({});

  // State to track feedback modal visibility - blocks navigation while open
  const [feedbackModalOpen, setFeedbackModalOpen] = useState<boolean>(false);

  // Zoom state
  const [currentZoom, setCurrentZoom] = useState<number>(1.0);
  const [, setIsCurrentSlidePinned] = useState<boolean>(false);
  const [slidesPinStatus, setSlidesPinStatus] = useState<{ [slideId: string]: boolean }>({});
  const documentViewerRefs = useRef<{ [key: string]: any }>({});
  // Tracks which slide IDs have been marked complete (mirrors web's completedSlideIds Set)
  const [completedSlideIds, setCompletedSlideIds] = useState<Set<string>>(new Set());
  // Prevents concurrent slide-progress API calls (mirrors web's markingRef)
  const markingRef = useRef(false);
   // State and helpers for top-toolbar download/share
  const [topDownloading, setTopDownloading] = useState(false);
  // State to track current page within documents (PDFs, slides)
  const [documentPages, setDocumentPages] = useState<{ [slideId: string]: number }>({});
  const [documentTotalPages, setDocumentTotalPages] = useState<{ [slideId: string]: number }>({});

  const [narrationSession, setNarrationSession] = useState<{
    slideId: string;
    page: number;
    voice: NarrationVoice;
    playRequestId: number;
    file?: string | null;
    note?: string | null;
    description?: string | null;
  } | null>(null);
  const [narrationVoice, setNarrationVoice] = useState<NarrationVoice>(
    DEFAULT_NARRATION_VOICE,
  );
  const narrationPlayRequestRef = useRef(0);
  const [narrationUi, setNarrationUi] = useState<SlideNarratorUiState>({
    loading: false,
    playing: false,
    error: null,
  });

  useEffect(() => {
    loadNarrationVoice().then(setNarrationVoice).catch(() => undefined);
  }, []);

  const handleNarrationStateChange = useCallback((state: SlideNarratorUiState) => {
    setNarrationUi(state);
  }, []);

  const stopNarration = useCallback(() => {
    setNarrationSession(null);
    setNarrationUi({ loading: false, playing: false, error: null });
  }, []);

  useEffect(() => {
    if (narrationUi.error) {
      Alert.alert('Soma', narrationUi.error);
      setNarrationUi((prev) => ({ ...prev, error: null }));
    }
  }, [narrationUi.error]);

  const getFileNameFromUrl = (url: string) => {
    try {
      const parts = url.split('/');
      const last = parts[parts.length - 1];
      return decodeURIComponent(last.split('?')[0]);
    } catch (e) {
      console.log(e);
      return `document_${Date.now()}`;
    }
  };

  const cleanFileName = (rawName: string) => {
    if (!rawName) return rawName;
    let name = rawName.split('?')[0];
    try { name = decodeURIComponent(name); } catch {}
    name = name.replace(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}_/, '');
    name = name.replace(/^[0-9a-fA-F]{8,}_/, '');
    name = name.replace(/^\d+_/, '');
    name = name.replace(/^_+|_+$/g, '');
    return name;
  };

  const [hasCurrentAnswer, setHasCurrentAnswer] = useState<{ [key: string]: boolean }>({});

  // Transform data function - now includes result slides
  const transformCourseData = (chapter: any, midTestData: any) => {
    const items: any[] = [];
    if (!chapter) return items;
    
    // Add slides as content type, video, or image
    (chapter.slides || []).forEach((slide: any) => {
      let fileType = 'content';
      if (typeof slide.file === 'string') {
        const lower = slide.file.toLowerCase();
        if (lower.match(/\.(mp4|mov|webm|mkv)$/)) fileType = 'video';
        else if (lower.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/)) fileType = 'image';
        else if (lower.match(/\.pdf$/)) fileType = 'content';
      }
      items.push({
        type: fileType,
        id: slide.id,
        chapterId: slide.chapterId,
        note: slide.note,
        description: slide.description,
        slideNumber: slide.slideNumber,
        file: slide.file,
        isPublished: slide.isPublished,
        createdAt: slide.createdAt,
        updatedAt: slide.updatedAt
      });
    });
    
    // Add each test question as its own page
    if (midTestData && chapter.midTest && chapter.midTest.id === midTestData.id && typeof chapter.activityAt === 'number') {
      (midTestData.questionnaires || []).forEach((q: any, idx: number) => {
        items.push({
          type: 'test-question',
          id: `${midTestData.id}-q${idx}`,
          chapterId: midTestData.chapterId,
          testData: midTestData,
          questionnaire: q,
          currentQuestionIndex: idx,
          totalQuestions: midTestData.questionnaires.length,
          slideNumber: chapter.activityAt + idx / 1000
        });
      });
    }
    
    // Sort by slideNumber
    items.sort((a, b) => a.slideNumber - b.slideNumber);
    return items;
  };

  // Remove useWindowDimensions from addResultSlides, pass width as param
  const addResultSlides = (items: any[], answers: { [key: string]: QuestionnaireAnswer }, width: number) => {
    const testQuestions = items.filter(item => item.type === 'test-question');
    
    if (testQuestions.length === 0) {
      // No test questions, just add a simple completion slide
      items.push({
        type: 'result-slide',
        id: 'completion-slide',
        slideNumber: items.length > 0 ? items[items.length - 1].slideNumber + 1 : 1
      });
      return items;
    }

    // Prepare results data
    const results = testQuestions.map((question, index) => {
      const answer = answers[question.id] || {};
      return {
        question: question.questionnaire.question,
        userAnswer: answer.selectedLabel || 'Nta gisubizo',
        correctAnswer: question.questionnaire.correctLabel,
        isCorrect: answer.selectedLabel === question.questionnaire.correctLabel
      };
    });

    // Calculate how many result pages we need
    const isTablet = width > 700;
    const resultsPerPage = isTablet ? 8 : 5;
    const totalResultPages = Math.ceil(results.length / resultsPerPage);

    // Add result slides with unique IDs
    for (let i = 0; i < totalResultPages; i++) {
      items.push({
        type: 'result-slide',
        id: `test-result-${i}`, // Use unique prefix to avoid conflicts
        results: results,
        currentPage: i + 1,
        totalPages: totalResultPages,
        slideNumber: items.length > 0 ? items[items.length - 1].slideNumber + 1 + (i * 0.001) : 1
      });
    }

    return items;
  };

  useEffect(() => {
    const load = async () => {
      if (!courseId || !chapterId) return setLoading(false);
      try {
        const [courseResponse, chapterResponse] = await Promise.all([
          getCourseById(courseId as string),
          getChapterById(chapterId as string)
        ]);
        setCourse(courseResponse.data);
        setChapter(chapterResponse.data);
        
        let midTestData = null;
        if (chapterResponse.data?.midTest?.id) {
          try {
            const midTestResponse = await getMidTestById(chapterResponse.data.midTest.id);
            midTestData = midTestResponse.data;
          } catch (e) {
            console.log('Failed to load mid test',e);
          }
        }

        // Transform the data
        const transformed = transformCourseData(chapterResponse.data, midTestData);
        setTransformedData(transformed);
        
      } catch (e) {
        console.log('Failed to load course/chapter for content', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [courseId, chapterId]);

  // Sync completed chapters + slide IDs from server on mount (same pattern as web's getCourseProgress call)
  useEffect(() => {
    const syncCompletedChaptersFromServer = async () => {
      if (!courseId) return;
      try {
        const response = await getStudentCourseProgressByCourseId(courseId as string);
        const completedChapters = response.data.chapterProgress.filter(ch => ch.isCompleted);
        for (const ch of completedChapters) {
          await StorageService.markChapterCompleted(ch.chapterId);
        }
        // Populate the in-memory Set with already-completed slide IDs so we don't re-submit them
        if (Array.isArray(response.data.completedSlideIds)) {
          setCompletedSlideIds(new Set(response.data.completedSlideIds));
        }
      } catch (error) {
        console.log('Error syncing completed chapters:', error);
      }
    };
    syncCompletedChaptersFromServer();
  }, [courseId]);

  // Update transformed data when answers change to include result slides
  useEffect(() => {
    if (transformedData.length > 0) {
      // Always add result slides, whether there are answers or not
      const baseItems = transformedData.filter(item => item.type !== 'result-slide');
      const itemsWithResults = addResultSlides([...baseItems], questionnaireAnswers, width);
      
      // Only update if the structure has actually changed
      if (itemsWithResults.length !== transformedData.length || 
          JSON.stringify(itemsWithResults.map(i => i.id)) !== JSON.stringify(transformedData.map(i => i.id))) {
        setTransformedData(itemsWithResults);
      }
    }
  }, [questionnaireAnswers, width]);

  // Load pinned slides from AsyncStorage
  useEffect(() => {
    const loadPinnedSlides = async () => {
      if (!courseId || !chapterId || transformedData.length === 0) return;
      try {
        const status: { [slideId: string]: boolean } = {};
        for (const item of transformedData) {
          if (item.id && item.type !== 'test-question' && item.type !== 'result-slide') {
            const isPinned = await StorageService.isSlidePinned(courseId as string, chapterId as string, item.id);
            status[item.id] = isPinned;
          }
        }
        setSlidesPinStatus(status);
        // Set current slide pinned status
        if (transformedData[currentPage] && transformedData[currentPage].id) {
          setIsCurrentSlidePinned(status[transformedData[currentPage].id] || false);
        }
      } catch (error) {
        console.log('Error loading pinned slides status:', error);
        setIsCurrentSlidePinned(false);
      }
    };
    loadPinnedSlides();
  }, [courseId, chapterId, transformedData]);

  // Reset navigation flag when slideId changes
  useEffect(() => {
    setHasNavigatedToSlideId(false);
  }, [slideId]);

  // Handle navigation to specific slide by ID
  useEffect(() => {
    if (!hasNavigatedToSlideId && slideId && transformedData.length > 0) {
      const targetPageIndex = transformedData.findIndex(item => item.id === slideId);
      if (targetPageIndex !== -1 && targetPageIndex !== currentPage) {
        // Small delay to ensure pager is ready
        setTimeout(() => {
          setCurrentPage(targetPageIndex);
          pagerRef.current?.setPage(targetPageIndex);
          setHasNavigatedToSlideId(true);
        }, 100);
      }
    }
  }, [slideId, transformedData, hasNavigatedToSlideId, currentPage]);

  // Mirrors web's markCurrentComplete: dedup via Set, concurrency guard, auto-marks chapter done
  // when every content slide in this chapter has been visited.
  const markCurrentSlideComplete = useCallback(async (slideId: string) => {
    if (!slideId || completedSlideIds.has(slideId) || markingRef.current) return;
    markingRef.current = true;
    try {
      await createSlideProgressById({ slideId, isCompleted: true });
      setCompletedSlideIds(prev => {
        const next = new Set(prev).add(slideId);
        // Auto-mark chapter complete in local cache when all content slides are done
        const contentSlides = transformedData.filter(
          item => item.type === 'content' || item.type === 'image' || item.type === 'video'
        );
        if (contentSlides.length > 0 && contentSlides.every(s => next.has(s.id))) {
          if (chapterId) StorageService.markChapterCompleted(chapterId as string);
        }
        return next;
      });
    } catch (error) {
      console.log('Error recording slide progress:', error);
    } finally {
      markingRef.current = false;
    }
  }, [completedSlideIds, transformedData, chapterId]);

  // Navigation handlers with feedback modal blocking
  const handleNext = async () => {
    if (feedbackModalOpen) return; // Block navigation when feedback is open
    if (currentPage < transformedData.length - 1) {
      // If current page is a test question and it's not answered yet, block navigation
      const cur = transformedData[currentPage];
      if (cur && cur.type === 'test-question' && !hasCurrentAnswer[cur.id]) {
        Alert.alert('Ibisabwa', 'Nyamuneka subiza iki kibazo mbere yo gukomeza.');
        return;
      }
      const currentItem = transformedData[currentPage];
      if (currentItem.type === "content" || currentItem.type === "image" || currentItem.type === "video") {
        await markCurrentSlideComplete(currentItem.id);
      }

      // Check if we can navigate within the current document
      const currentDocPage = documentPages[currentItem.id] || 1;
      const totalDocPages = documentTotalPages[currentItem.id] || 1;

      if ((currentItem.type === 'content' || currentItem.type === 'image' || currentItem.type === 'video') && currentDocPage < totalDocPages) {
        // Navigate to next page within the document
        const viewer = documentViewerRefs.current[currentItem.id];
        if (viewer && typeof viewer.goToPage === 'function') {
          const nextDocPage = currentDocPage + 1;
          viewer.goToPage(nextDocPage);
          setDocumentPages(prev => ({ ...prev, [currentItem.id]: nextDocPage }));
          return;
        }
      }

      // If we can't navigate within document or at end of document, navigate to next slide
      // Pause any media in the current viewer before navigating
      const viewer = documentViewerRefs.current[currentItem.id];
      if (viewer && typeof viewer.pauseMedia === 'function') {
        try { viewer.pauseMedia(); } catch (err) { console.log('pause viewer error', err); }
      }
      if (pagerRef.current) {
        pagerRef.current.setPage(currentPage + 1);
      } else {
        setCurrentPage(prev => prev + 1);
      }
    } else {
      // On the last slide — mark it complete (dedup inside markCurrentSlideComplete prevents re-submission).
      // Auto-chapter-complete fires inside the Set update callback when all content slides are done.
      const lastItem = transformedData[currentPage];
      if (lastItem && (lastItem.type === "content" || lastItem.type === "image" || lastItem.type === "video")) {
        await markCurrentSlideComplete(lastItem.id);
      }
    }
  };

  const handlePrevious = async () => {
    if (feedbackModalOpen) return; // Block navigation when feedback is open
    if (currentPage > 0) {
      const currentItem = transformedData[currentPage];

      // Check if we can navigate within the current document
      const currentDocPage = documentPages[currentItem.id] || 1;

      if ((currentItem.type === 'content' || currentItem.type === 'image' || currentItem.type === 'video') && currentDocPage > 1) {
        // Navigating within a document page — mark the slide as viewed (like web's goToSlide)
        markCurrentSlideComplete(currentItem.id);
        const viewer = documentViewerRefs.current[currentItem.id];
        if (viewer && typeof viewer.goToPage === 'function') {
          const prevDocPage = currentDocPage - 1;
          viewer.goToPage(prevDocPage);
          setDocumentPages(prev => ({ ...prev, [currentItem.id]: prevDocPage }));
          return;
        }
      }

      // Changing slides — mark current slide as viewed before going back (mirrors web's goToSlide)
      if (currentItem.type === 'content' || currentItem.type === 'image' || currentItem.type === 'video') {
        markCurrentSlideComplete(currentItem.id);
      }
      // Pause any media in the current viewer before navigating
      const viewer = documentViewerRefs.current[currentItem.id];
      if (viewer && typeof viewer.pauseMedia === 'function') {
        try { viewer.pauseMedia(); } catch (err) { console.log('pause viewer error', err); }
      }
      if (pagerRef.current) {
        pagerRef.current.setPage(currentPage - 1);
      } else {
        setCurrentPage(prev => prev - 1);
      }
    }
  };

  const handleReset = () => {
    if (feedbackModalOpen) return; // Block reset when feedback is open
    // Reset zoom to normal (1.0) instead of going to first page
    setCurrentZoom(1.0);
    const currentItem = transformedData[currentPage];
    if (!currentItem) return;

    // Send reset zoom message to DocumentViewer
    const documentViewer = documentViewerRefs.current[currentItem.id];
    if (documentViewer && documentViewer.resetZoom) {
      documentViewer.resetZoom();
    }
  };

  // Zoom handlers
  const handleZoomIn = () => {
    if (feedbackModalOpen) return; // Block zoom when feedback is open
    const newZoom = Math.min(currentZoom + 0.2, 5.0); // Max zoom 5x (increased from 3x)
    setCurrentZoom(newZoom);
    sendZoomToCurrentViewer(newZoom);
  };

  const handleZoomOut = () => {
    if (feedbackModalOpen) return; // Block zoom when feedback is open
    const newZoom = Math.max(currentZoom - 0.2, 0.3); // Min zoom 0.3x (decreased from 0.5x)
    setCurrentZoom(newZoom);
    sendZoomToCurrentViewer(newZoom);
  };

  const sendZoomToCurrentViewer = (zoom: number) => {
    const currentItem = transformedData[currentPage];
    if (!currentItem) return;

    // Send zoom message to DocumentViewer refs
    const documentViewer = documentViewerRefs.current[currentItem.id];
    if (documentViewer && documentViewer.setZoom) {
      documentViewer.setZoom(zoom);
    }
  };

  // Handler for previous question
  const handlePrevQuestion = () => {
    if (feedbackModalOpen) return; // Block navigation when feedback is open
    const curIdx = currentPage;

    // Pause any media in the current viewer before navigating
    const currentItem = transformedData[curIdx];
    const currentViewer = documentViewerRefs.current[currentItem?.id];
    if (currentViewer && typeof currentViewer.pauseMedia === 'function') {
      try { currentViewer.pauseMedia(); } catch (err) { console.log('pause viewer error', err); }
    }

    // Try to find previous test-question (another question to go back to)
    let prevQuestionIdx = -1;
    for (let i = curIdx - 1; i >= 0; i--) {
      if (transformedData[i] && transformedData[i].type === 'test-question') {
        prevQuestionIdx = i;
        break;
      }
    }

    if (prevQuestionIdx >= 0) {
      if (pagerRef.current) {
        try { pagerRef.current.setPage(prevQuestionIdx); } catch { setCurrentPage(prevQuestionIdx); }
      } else {
        setCurrentPage(prevQuestionIdx);
      }
      return;
    }

    // No previous question found — go to previous non-question slide (content/result)
    let prevNonQuestionIdx = -1;
    for (let i = curIdx - 1; i >= 0; i--) {
      if (transformedData[i] && transformedData[i].type !== 'test-question') {
        prevNonQuestionIdx = i;
        break;
      }
    }

    if (prevNonQuestionIdx >= 0) {
      if (pagerRef.current) {
        try { pagerRef.current.setPage(prevNonQuestionIdx); } catch { setCurrentPage(prevNonQuestionIdx); }
      } else {
        setCurrentPage(prevNonQuestionIdx);
      }
    }
  };


  // Handler for toggling orientation
  const handleToggleOrientation = async () => {
    if (feedbackModalOpen) return; // Block orientation when feedback is open
    const orientation = await ScreenOrientation.getOrientationAsync();
    if (
      orientation === ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
      orientation === ScreenOrientation.Orientation.LANDSCAPE_RIGHT
    ) {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT);
    } else {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    }
  };

  // Pin/Unpin slide functions
  const handlePinSlide = async (slideId: string) => {
    if (!courseId || !chapterId) return;
    
    const slideIndex = transformedData.findIndex(item => item.id === slideId);
    if (slideIndex === -1) return;
    
    const slideData = transformedData[slideIndex];
    
    try {
      const slideInfo = {
        title: slideData.type === 'content' ? `Slide ${slideData.slideNumber || (slideIndex + 1)}` : 
               slideData.type === 'image' ? `Image Slide ${slideData.slideNumber || (slideIndex + 1)}` :
               slideData.type === 'video' ? `Video Slide ${slideData.slideNumber || (slideIndex + 1)}` :
               slideData.type === 'test-question' ? `Question ${slideData.currentQuestionIndex + 1}` :
               `Slide ${slideData.slideNumber || (slideIndex + 1)}`,
        chapterTitle: chapter?.title || '',
        sectionTitle: course?.sections?.find(s => s.chapters?.some(c => c.id === chapterId))?.title || '',
        sectionNumber: (course?.sections?.findIndex(s => s.chapters?.some(c => c.id === chapterId)) || 0) + 1,
        type: slideData.type,
        slideNumber: slideData.slideNumber || (slideIndex + 1)
      };
      
      const isCurrentlyPinned = slidesPinStatus[slideId] || false;
      
      if (isCurrentlyPinned) {
        await StorageService.unpinSlide(courseId as string, chapterId as string, slideId);
        setSlidesPinStatus(prev => ({ ...prev, [slideId]: false }));
        if (slideIndex === currentPage) setIsCurrentSlidePinned(false);
      } else {
        await StorageService.pinSlide(courseId as string, chapterId as string, slideId, slideInfo);
        setSlidesPinStatus(prev => ({ ...prev, [slideId]: true }));
        if (slideIndex === currentPage) setIsCurrentSlidePinned(true);
      }
    } catch (error) {
      console.log('Error toggling pin status:', error);
    }
  };

  // WebView message handler
  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      // Handle feedback modal state changes - disable navigation when modal is open
      if (data && data.type === 'feedbackModalState') {
        setFeedbackModalOpen(data.isOpen === true);
      }

      // Handle document page changes (PDF and slides)
      if (data && data.type === 'pageChange') {
        const current = transformedData[currentPage];
        if (current && current.id) {
          setDocumentPages(prev => ({ ...prev, [current.id]: data.page }));
        }
      }

      // Handle document ready with total pages
      if (data && data.type === 'pdfReady') {
        const current = transformedData[currentPage];
        if (current && current.id) {
          setDocumentTotalPages(prev => ({ ...prev, [current.id]: data.total }));
          // Initialize current page if not set
          if (!documentPages[current.id]) {
            setDocumentPages(prev => ({ ...prev, [current.id]: 1 }));
          }
        }
      }

      // When questionnaire is submitted inside the WebView, mark the current page as answered
      if (data && data.type === 'questionnaireSubmitted') {
        const current = transformedData[currentPage];
        if (current && current.id) {
          setHasCurrentAnswer(prev => ({ ...prev, [current.id]: true }));
          // store a minimal answer record to be used for result slides
          setQuestionnaireAnswers(prev => ({
            ...prev,
            [current.id]: {
              selectedLabel: (data.selectedOptions && data.selectedOptions[0]) || undefined,
              correctLabel: (data.correctAnswers && data.correctAnswers[0]) || undefined,
              confirmed: true,
              hasAnswered: true
            }
          }));
        }
      }

      // Keep existing handlers (optionSelected, etc.) if any
    } catch (error) {
      console.log('Error parsing WebView message:', error);
    }
  };

  // Finish chapter helper (used by LastSlide finish and result slide flow)
  const handleFinishChapter = async () => {
    try {
      if (!course || !chapterId || !courseId) return;
      // mark completed locally/server
      await StorageService.markChapterCompleted(chapterId as string);

      // Find the next chapter in sequence
      let targetSectionId: string | null = null;

      // Get all chapters in flat list
      const allChapters: { id: string, sectionId: string }[] = [];
      for (const section of course.sections || []) {
        for (const ch of section.chapters || []) {
          allChapters.push({ id: ch.id, sectionId: section.id });
        }
      }

      // Find index of current chapter
      const currentIndex = allChapters.findIndex(ch => ch.id === chapterId);
      if (currentIndex !== -1 && currentIndex + 1 < allChapters.length) {
        const nextChapter = allChapters[currentIndex + 1];
        targetSectionId = nextChapter.sectionId;
      }

      if (targetSectionId) {
        // Navigate to chapters list and activate the target section
        router.push({ pathname: `/courses/${courseId}/chapters`, params: { sectionId: targetSectionId } });
        return;
      }

      // No next chapter found — if final test exists, activate it; otherwise fall back to first section
      if (course.finalTest && course.finalTest.length > 0) {
        router.push({ pathname: `/courses/${courseId}/chapters`, params: { sectionId: 'final-test' } });
        return;
      }

      const fallbackSectionId = course.sections?.[0]?.id ?? undefined;
      router.push({ pathname: `/courses/${courseId}/chapters`, params: { sectionId: fallbackSectionId } });
    } catch (err) {
      console.log('handleFinishChapter error', err);
    }
  };

  // Cancel questionnaire handler: go back to previous non-question slide
  const handleCancelQuestionnaire = () => {
    let prevSlideIdx = currentPage - 1;
    while (prevSlideIdx >= 0 && transformedData[prevSlideIdx].type === 'test-question') {
      prevSlideIdx--;
    }
    if (prevSlideIdx >= 0) {
      if (pagerRef.current) {
        try { pagerRef.current.setPage(prevSlideIdx); } catch (err) { console.log('pager setPage error', err); setCurrentPage(prevSlideIdx); }
      } else {
        setCurrentPage(prevSlideIdx);
      }
    }
  };

  const [showChapterReviewModal, setShowChapterReviewModal] = useState(false);
  const [checkingChapterReview, setCheckingChapterReview] = useState(false);

  const onLastSlideFinish = async () => {
    try {
      // Mark the last content slide before finishing (mirrors web's handleNextChapter calling markCurrentComplete first)
      const lastContentSlide = [...transformedData].reverse().find(
        item => item.type === 'content' || item.type === 'image' || item.type === 'video'
      );
      if (lastContentSlide) {
        await markCurrentSlideComplete(lastContentSlide.id);
      }

      if (!course || !chapterId) {
        handleFinishChapter();
        return;
      }

      // Check local storage first
      const localReviewed = await StorageService.getChapterReviewStatus(course.id, chapterId);
      if (localReviewed) {
        handleFinishChapter();
        return;
      }

      setCheckingChapterReview(true);
      // Fallback to server check
      try {
        const myReviews = await getMyChapterReviews();
        const found = (myReviews || []).find((r: any) => r.chapterId === chapterId || (r.chapter && r.chapter.id === chapterId));
        if (found) {
          // store locally
          await StorageService.storeChapterReviewStatus(chapterId, {
            rating: found.rating || 0,
            reviewCriteria: found.reviewCriteria || [],
            comment: found.comment || ''
          });
          setCheckingChapterReview(false);
          handleFinishChapter();
          return;
        }
      } catch (err) {
        console.log('Error checking server chapter reviews', err);
      } finally {
        setCheckingChapterReview(false);
      }

      // No review found -> show modal to collect chapter review
      console.log('[onLastSlideFinish] no review found, showing ChapterReviewCard modal');
      setShowChapterReviewModal(true);
    } catch (err) {
      console.log('onLastSlideFinish error', err);
      handleFinishChapter();
    }
  };

  const handleSubmitChapterReview = async (data: { courseId?: string; chapterId: string; chapterNumber?: number; categoryRatings: { id: string; category: string; label: string; rating: number }[]; comment: string; }) => {
    try {
      console.log('submitting chapter review (categoryRatings)', data);

      // Derive a simplified local representation for existing storage format
      const labels = (data.categoryRatings || []).map((c) => c.label || c.category || '');
      // derive an overall rating as the rounded average of category ratings
      const ratings = (data.categoryRatings || []).map((c) => Number(c.rating) || 0);
      const avg = ratings.length > 0 ? Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length) : 0;

      // Build payload matching CreateChapterReviewDto: include averaged rating
      const payload = {
        chapterId: data.chapterId,
        comment: data.comment || '',
        categoryRatings: data.categoryRatings || [],
        rating: avg,
      };

      console.log('payload:', payload);
      await addChapterreview(payload);

      // store locally using the existing storage signature
      await StorageService.storeChapterReviewStatus(data.chapterId, {
        rating: avg,
        reviewCriteria: labels,
        comment: data.comment || '',
      });
    } catch (err) {
      console.log('Error submitting chapter review', err);
      // proceed anyway
    } finally {
      setShowChapterReviewModal(false);
      // continue finishing chapter
      handleFinishChapter();
    }
  };

  if (loading) return <View style={{flex:1, justifyContent:'center', alignItems:'center'}}><Text>tegereza...</Text></View>;
  if (!chapter) return <View style={{flex:1, justifyContent:'center', alignItems:'center'}}><Text>Chapter ntabwo ibonetse</Text></View>;
  if (transformedData.length === 0) return <View style={{flex:1, justifyContent:'center', alignItems:'center'}}><Text>Nta byatangajwe</Text></View>;

  // PagerView onPageSelected handler — fires on swipe between slides
  const onPageSelected = (e: any) => {
    const page = e.nativeEvent.position;
    stopNarration();
    // Mark the slide being LEFT as complete before moving (mirrors web's goToSlide)
    const prevItem = transformedData[currentPage];
    if (prevItem && (prevItem.type === 'content' || prevItem.type === 'image' || prevItem.type === 'video')) {
      markCurrentSlideComplete(prevItem.id);
    }
    // Pause any media playing in the previous viewer
    const prevViewer = documentViewerRefs.current[prevItem?.id];
    if (prevViewer && typeof prevViewer.pauseMedia === 'function') {
      try { prevViewer.pauseMedia(); } catch (err) { console.log('pause prev viewer error', err); }
    }

    setCurrentPage(page);
  };

  // Current item and state
  const currentItem = transformedData[currentPage];
  const isTestQuestion = currentItem && currentItem.type === 'test-question';
  const isResultSlide = currentItem && currentItem.type === 'result-slide';
  const hasAnswer = isTestQuestion ? hasCurrentAnswer[currentItem.id] || false : false;

  // Disable pager swipe when on a questionnaire page
  const pagerScrollEnabled = !isTestQuestion;

  // Determine button text and behavior
  const getButtonConfig = () => {
    if (isResultSlide) {
      return { 
        text: currentItem.currentPage === currentItem.totalPages ? 'Hagarara' : 'Komeza', 
        onPress: currentItem.currentPage === currentItem.totalPages ? async () => {
          // Use onLastSlideFinish so we run the chapter-review check and show ChapterReviewCard when needed
          await onLastSlideFinish();
        } : handleNext 
      };
    }
    
    if (!isTestQuestion) {
      return { text: 'Imbere', onPress: handleNext };
    }
    
    return { 
      text: hasAnswer ? 'Komeza' : 'Komeza', 
      onPress: handleNext 
    };
  };

  const buttonConfig = getButtonConfig();

  const startNarration = async (voice: NarrationVoice = narrationVoice) => {
    if (!currentItem || isTestQuestion || isResultSlide) return;
    const preferredVoice = await loadNarrationVoice().catch(() => voice);
    if (preferredVoice !== narrationVoice) {
      setNarrationVoice(preferredVoice);
    }
    const docPage = documentPages[currentItem.id] ?? 1;
    narrationPlayRequestRef.current += 1;
    setNarrationSession({
      slideId: currentItem.id,
      page: docPage,
      voice: preferredVoice,
      playRequestId: narrationPlayRequestRef.current,
      file: currentItem.file,
      note: currentItem.note,
      description: currentItem.description,
    });
  };

  const handleReadAloud = async () => {
    if (!currentItem || isTestQuestion || isResultSlide) return;
    if (narrationUi.playing || narrationUi.loading) {
      stopNarration();
      return;
    }
    await startNarration();
  };

  return (
    <View style={[styles.container, { paddingBottom: !isLandscape ? Math.max(insets.bottom + 10 , 86) : 0 }]}> 
      { !isLandscape && <Header /> }
      <TopToolbar
        title={chapter.title || 'Course Content'}
        course={course!}
        currentPage={String(currentPage + 1)}
        onToggleOrientation={handleToggleOrientation}
        isLandscape={isLandscape}
        canDownload={!(isTestQuestion || (currentPage === transformedData.length - 1))}
        downloading={topDownloading}
        onDownload={async () => {
          if (topDownloading) return;
          setTopDownloading(true);
          try {
            const currentItemLocal = transformedData[currentPage];
            if (!currentItemLocal) return;
            if (currentItemLocal.type === 'content' && currentItemLocal.file) {
              const viewer = documentViewerRefs.current[currentItemLocal.id];
              if (viewer && viewer.getExportUri) {
                const exportUri = await viewer.getExportUri();
                if (exportUri) {
                  await Sharing.shareAsync(exportUri, { dialogTitle: 'Bika Icyapa' });
                }
              } else {
                const remote = String(currentItemLocal.file);
                if (remote.startsWith('http://') || remote.startsWith('https://')) {
                  const rawName = getFileNameFromUrl(remote);
                  const fileName = cleanFileName(rawName) || `document_${Date.now()}`;
                  const localPath = FileSystem.documentDirectory + fileName;
                  try {
                    const res = await FileSystem.downloadAsync(remote, localPath);
                    await Sharing.shareAsync(res.uri, { dialogTitle: fileName });
                  } catch (dlErr) {
                    console.log('Failed to download & share current file', dlErr);
                  }
                } else {
                  try {
                    await Sharing.shareAsync(remote, { dialogTitle: 'Bika Icyapa' });
                  } catch (e) {
                    console.log('Failed to share local current file', e);
                  }
                }
              }
            } else {
              console.log('Download not supported for current item type');
            }
          } catch (e) {
            console.log('Error handling top toolbar download', e);
          } finally {
            setTopDownloading(false);
          }
        }}
        slideId={currentItem?.id}
      />
      <View style={styles.contentArea}>
          <View style={{ flex: 1 }}>
            <PagerView
              ref={pagerRef}
              style={{ flex: 1}}
              initialPage={currentPage}
              onPageSelected={onPageSelected}
              orientation="horizontal"
              overdrag={true}
              offscreenPageLimit={1}
              scrollEnabled={pagerScrollEnabled}
            >
              {transformedData.map((item, idx) => (
                <View key={item.id || idx} style={{ flex: 1, position: 'relative' }}>
                  {item.type === 'result-slide' ? (
                    <LastSlide onFinish={onLastSlideFinish} />
                  ) : (
                    <DocumentViewer 
                      ref={(ref) => {
                        if (ref) documentViewerRefs.current[item.id] = ref;
                      }}
                      uri={item.type === 'content' ? item.file : undefined}
                      type={item.type}
                      slides={(item.type === 'image' || item.type === 'video') && item.file ? 
                        [{ file: item.file, note: item.note }] : undefined}
                      testData={item.type === 'test-question' ? item.testData : undefined}
                      questionnaire={item.type === 'test-question' ? item.questionnaire : undefined}
                      currentQuestionIndex={item.type === 'test-question' ? item.currentQuestionIndex : undefined}
                      onMessage={handleWebViewMessage}
                    />
                  )}
                  {item.type !== 'test-question' && item.type !== 'result-slide' && (
                    <>
                      <TouchableOpacity
                        style={styles.pinButton}
                        onPress={() => handlePinSlide(item.id)}
                      >
                        {slidesPinStatus[item.id] ? (
                          <PinOff color="#F59E0B" size={16} />
                        ) : (
                          <Pin color="#333" size={16} />
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.readAloudButton}
                        onPress={handleReadAloud}
                        disabled={idx === currentPage && narrationUi.loading}
                      >
                        <Volume2
                          color={
                            idx === currentPage && narrationUi.playing
                              ? '#F59E0B'
                              : idx === currentPage && narrationUi.loading
                                ? '#94A3B8'
                                : '#3363AD'
                          }
                          size={16}
                        />
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              ))}
            </PagerView>
          </View>
      </View>
      <View style={{ position: 'relative', zIndex: 20, elevation: 20, marginBottom: !isLandscape ? insets.bottom : 0 }}>
        <BottomToolBar 
          currentPage={currentPage + 1}
          totalPages={transformedData.length}
          onNext={buttonConfig.onPress}
          onPrev={isTestQuestion ? handlePrevQuestion : handlePrevious}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          reset={handleReset}
          onToggleOrientation={handleToggleOrientation}
          isLandscape={isLandscape}
          showQuestionnaire={isTestQuestion}
          canSubmitQuestionnaire={false}
          isLastQuestion={isTestQuestion && currentItem.currentQuestionIndex === currentItem.totalQuestions - 1}
          currentQuestionIndex={isTestQuestion ? currentItem.currentQuestionIndex : undefined}
          totalQuestions={isTestQuestion ? currentItem.totalQuestions : undefined}
          hasCurrentAnswer={hasAnswer}
          onCancelQuestionnaire={isTestQuestion ? handleCancelQuestionnaire : undefined}
          nextButtonText={buttonConfig.text}
          feedbackModalOpen={feedbackModalOpen}
        />
      </View>
      {narrationSession && (
        <SlideNarratorHost
          slideId={narrationSession.slideId}
          page={narrationSession.page}
          voice={narrationSession.voice}
          playRequestId={narrationSession.playRequestId}
          file={narrationSession.file}
          note={narrationSession.note}
          description={narrationSession.description}
          onStateChange={handleNarrationStateChange}
        />
      )}
      { !isLandscape && (
        <Footer
          activeTab="training"
          onTabPress={tabName => {
            if (tabName === 'index') {
              router.push('/');
            } else {
              router.push(`/${tabName}`);
            }
          }}
        />
      )}
      { checkingChapterReview && (
        <Modal visible={checkingChapterReview} animationType="none" transparent={false}>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
            <ActivityIndicator size="large" color="#3363AD" />
            <Text style={{ marginTop: 12, textAlign: 'center', color: '#374151' }}>Genzura niba waratanze igitekerezo...</Text>
          </View>
        </Modal>
      )}

      { showChapterReviewModal && (
        <Modal visible={showChapterReviewModal} animationType="slide" transparent={false}>
          <ChapterReviewCard
            courseId={course?.id ?? ''}
            chapterId={chapterId ?? ''}
            chapterTitle={chapter?.title ?? ''}
            chapterNumber={chapter?.chapterNumber ?? 0}
            courseCoverIcon={course?.coverIcon ?? ''}
            courseTitle={course?.title ?? ''}
            onSubmit={handleSubmitChapterReview}
            onClose={() => { setShowChapterReviewModal(false); /* if user closes without review, still continue */ handleFinishChapter(); }}
          />
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    position: 'relative',
  },
  contentArea: {
    flex: 1,
  },
  pinButton: {
    position: 'absolute',
    top: 6,
    left: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 18,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  readAloudButton: {
    position: 'absolute',
    top: 6,
    right: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 18,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
});