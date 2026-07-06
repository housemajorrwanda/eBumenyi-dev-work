import { useState, useRef, useEffect, useCallback, FC } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Plus, Trash2, ChevronRight, ChevronLeft, ChevronDown, ChevronUp, Upload, X, Eye, Bell } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { ICourse } from "@/types";
import DraftRestoreModal from "@/components/Dialogs/DraftRestoreModal";
import { CourseLoader } from "@/components/Loader";
import { uploadFileByType, uploadVideoFile } from "@/services/uploader.api";
import { createCourse, updateCourse, notifyCourseUsers } from "@/services/course.service";
import { CourseSlideForm, transformCourseToFormData } from "@/utils/constants/courseTransformers";

interface ICourseForm {
  item?: ICourse;
  onClose?: () => void;
  isModal?: boolean;
}

// Auto-save configuration
const AUTO_SAVE_KEY = 'course_draft_autosave';

// Auto-save utilities
const saveToLocalStorage = (key: string, data: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify({
      data,
      timestamp: Date.now(),
      version: '1.0'
    }));
  } catch (error) {
    console.warn('Failed to save to localStorage:', error);
  }
};

const loadFromLocalStorage = (key: string) => {
  try {
    const saved = localStorage.getItem(key);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
        return parsed.data;
      }
    }
  } catch (error) {
    console.warn('Failed to load from localStorage:', error);
  }
  return null;
};

const clearFromLocalStorage = (key: string) => {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.warn('Failed to clear localStorage:', error);
  }
};

// Updated steps with new Test step
const steps = ["Course", "Intro", "Sections", "Chapters", "Slides", "Tests", "Publish"];

// File upload component (FIXED: video upload and upload state management)
const FileUpload = ({
  label,
  accept,
  file,
  preview,
  onFileChange,
  onRemove,
  onUrlChange,
  required = false,
  hasError = false,
  isUploading,
  setIsUploading,
  setUploadingFile
}: {
  label: string;
  accept: string;
  file: File | null;
  preview: string | null;
  onFileChange: (file: File | null, preview: string | null) => void;
  onRemove: () => void;
  onUrlChange: (url: string) => void;
  required?: boolean;
  hasError?: boolean;
  isUploading?: boolean;
  setIsUploading?: (loading: boolean) => void;
  setUploadingFile?: (file: { name: string; type: 'video' | 'pdf' | 'image' | 'document' } | null) => void;
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Use parent upload state if provided, otherwise use local state
  const uploading = isUploading ?? false;
  const setUploading = setIsUploading ?? (() => {});
  
  // const isSlideUpload = label.includes("Slide Content");

  const getFileType = (file: File): 'video' | 'pdf' | 'image' | 'document' => {
    const fileName = file.name.toLowerCase();
    const mimeType = file.type.toLowerCase();
    
    if (mimeType.startsWith('video/') || fileName.includes('.mp4') || fileName.includes('.webm') || fileName.includes('.avi') || fileName.includes('.mov')) {
      return 'video';
    } else if (mimeType === 'application/pdf' || fileName.includes('.pdf')) {
      return 'pdf';
    } else if (mimeType.startsWith('image/') || fileName.includes('.jpg') || fileName.includes('.jpeg') || fileName.includes('.png') || fileName.includes('.gif') || fileName.includes('.webp')) {
      return 'image';
    } else {
      return 'document';
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      const reader = new FileReader();
      reader.onload = () => {
        onFileChange(selectedFile, reader.result as string);
      };
      reader.readAsDataURL(selectedFile);

      setUploading(true);
      setUploadingFile?.({
        name: selectedFile.name,
        type: getFileType(selectedFile)
      });
      
      try {
        // FIX: Use uploadVideoFile for video files, uploadFileByType for others
        let response;
        const fileType = getFileType(selectedFile);
        if (fileType === 'video') {
          response = await uploadVideoFile(selectedFile);
        } else {
          response = await uploadFileByType(selectedFile);
        }
        
        if (response.statusCode === 200 && response.data) {
          onUrlChange(response.data.url);
          toast.success('File uploaded successfully');
        } else {
          toast.error(response.message || 'Upload failed');
          onRemove();
        }
      } catch (error) {
        console.error('Upload failed:', error);
        toast.error('Upload failed. Please try again.');
        onRemove();
      } finally {
        setUploading(false);
        setUploadingFile?.(null);
      }
    }
  };

  const handleDrop = async (event: React.DragEvent) => {
    event.preventDefault();
    const droppedFile = event.dataTransfer.files?.[0];
    if (droppedFile) {
      const reader = new FileReader();
      reader.onload = () => {
        onFileChange(droppedFile, reader.result as string);
      };
      reader.readAsDataURL(droppedFile);

      setUploading(true);
      setUploadingFile?.({
        name: droppedFile.name,
        type: getFileType(droppedFile)
      });
      
      try {
        // FIX: Use uploadVideoFile for video files, uploadFileByType for others
        let response;
        const fileType = getFileType(droppedFile);
        if (fileType === 'video') {
          response = await uploadVideoFile(droppedFile);
        } else {
          response = await uploadFileByType(droppedFile);
        }
        
        if (response.statusCode === 200 && response.data) {
          onUrlChange(response.data.url);
          toast.success('File uploaded successfully');
        } else {
          toast.error(response.message || 'Upload failed');
          onRemove();
        }
      } catch (error) {
        console.error('Upload failed:', error);
        toast.error('Upload failed. Please try again.');
        onRemove();
      } finally {
        setUploading(false);
        setUploadingFile?.(null);
      }
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      
      {preview ? (
        <div className="relative group">
          <div className={`relative border-2 rounded-lg overflow-hidden bg-gray-50 ${
            hasError ? 'border-red-300' : 'border-gray-200'
          }`}>
            {(() => {
              if (file?.type?.startsWith('image/')) {
                return (
                  <>
                    <img 
                      src={preview} 
                      alt="Preview" 
                      className="w-full h-36 object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        target.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                    <div className="hidden w-full h-36 flex items-center justify-center bg-gray-100">
                      <div className="text-center">
                        <div className="text-4xl mb-2">🖼️</div>
                        <div className="text-sm font-medium text-gray-600">Image Preview</div>
                        <div className="text-xs text-gray-500">Failed to load</div>
                      </div>
                    </div>
                  </>
                );
              } else if (file?.type?.startsWith('video/')) {
                return (
                  <video 
                    src={preview} 
                    className="w-full h-36 object-cover"
                    controls
                  />
                );
              } else if (file?.type) {
                return (
                  <div className="w-full h-36 flex items-center justify-center bg-gray-100">
                    <div className="text-center">
                      <div className="text-4xl mb-2">📄</div>
                      <div className="text-sm font-medium text-gray-600">{file?.name || 'File'}</div>
                      <div className="text-xs text-gray-500">{file?.type || 'Unknown type'}</div>
                    </div>
                  </div>
                );
              } else if (preview && !file) {
                const urlLower = preview.toLowerCase();
                if (urlLower.includes('.mp4') || urlLower.includes('.webm') || urlLower.includes('.avi') || urlLower.includes('.mov')) {
                  return (
                    <video 
                      src={preview} 
                      className="w-full h-36 object-cover"
                      controls
                    />
                  );
                } else if (urlLower.includes('.pdf') || urlLower.includes('.doc') || urlLower.includes('.docx') || urlLower.includes('.ppt') || urlLower.includes('.pptx')) {
                  return (
                    <div className="w-full h-36 flex items-center justify-center bg-gray-100">
                      <div className="text-center">
                        <div className="text-4xl mb-2">📄</div>
                        <div className="text-sm font-medium text-gray-600">Document</div>
                        <div className="text-xs text-gray-500">
                          {urlLower.includes('.pdf') ? 'PDF Document' :
                           urlLower.includes('.doc') ? 'Word Document' :
                           urlLower.includes('.ppt') ? 'PowerPoint Document' : 'Document'}
                        </div>
                      </div>
                    </div>
                  );
                } else {
                  return (
                    <>
                      <img 
                        src={preview} 
                        alt="Preview" 
                        className="w-full h-36 object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          target.nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                      <div className="hidden w-full h-36 flex items-center justify-center bg-gray-100">
                        <div className="text-center">
                          <div className="text-4xl mb-2">🖼️</div>
                          <div className="text-sm font-medium text-gray-600">Image Preview</div>
                          <div className="text-xs text-gray-500">Failed to load</div>
                        </div>
                      </div>
                    </>
                  );
                }
              } else {
                return (
                  <div className="w-full h-36 flex items-center justify-center bg-gray-100">
                    <div className="text-center">
                      <div className="text-4xl mb-2">📄</div>
                      <div className="text-sm font-medium text-gray-600">{file?.name || 'Unknown file'}</div>
                      <div className="text-xs text-gray-500">{file?.type || 'Unknown type'}</div>
                    </div>
                  </div>
                );
              }
            })()}
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 flex items-center justify-center">
              <div className="opacity-0 group-hover:opacity-100 flex gap-2 transition-opacity duration-200">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-white text-gray-700 p-2 rounded-full hover:bg-gray-100 transition-colors"
                  title="Change file"
                >
                  <Upload size={16} />
                </button>
                <button
                  type="button"
                  onClick={onRemove}
                  className="bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition-colors"
                  title="Remove file"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          </div>
          {(file || preview) && (
            <div className="mt-2 text-xs text-gray-500 flex items-center gap-1">
              <Eye size={12} />
              {file ? (
                <>
                  {file.name || 'Unknown file'} ({((file.size || 0) / 1024).toFixed(1)} KB)
                  {uploading && (
                    <span className="ml-2 text-blue-600 font-medium">Uploading...</span>
                  )}
                </>
              ) : preview ? (
                <>
                  {(() => {
                    const urlLower = preview.toLowerCase();
                    if (urlLower.includes('.mp4')) return 'Video file (MP4)';
                    if (urlLower.includes('.pdf')) return 'PDF Document';
                    if (urlLower.includes('.doc')) return 'Word Document';
                    if (urlLower.includes('.ppt')) return 'PowerPoint Document';
                    if (urlLower.includes('.jpg') || urlLower.includes('.png') || urlLower.includes('.gif')) return 'Image file';
                    return 'Uploaded file';
                  })()}
                </>
              ) : null}
            </div>
          )}
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={`h-36 border-2 border-dashed rounded-lg p-6 text-center transition-all ${
            uploading 
              ? 'border-blue-300 bg-blue-50 cursor-wait' 
              : hasError 
              ? 'border-red-300 hover:border-red-400 hover:bg-red-50 cursor-pointer' 
              : 'border-gray-300 hover:border-[#4d81d2] hover:bg-blue-50 cursor-pointer'
          }`}
        >
          {uploading ? (
            <>
              <div className="animate-spin mx-auto mb-2 w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full"></div>
              <p className="text-sm font-medium text-blue-600">Uploading...</p>
            </>
          ) : (
            <>
              <Upload className="mx-auto mb-2 text-gray-400" size={32} />
              <p className="text-sm font-medium text-gray-600 mb-1">
                Click to upload or drag and drop
              </p>
              <p className="text-xs text-gray-500">
                {(() => {
                  const a = (accept || '').toLowerCase();
                  if (a === 'image/*') return 'PNG, JPG, GIF, WebP up to 10MB';
                  if (a === 'video/*') return 'MP4, WebM, AVI up to 500MB';

                  const hasPdf = a.includes('.pdf') || a.includes('application/pdf') || a === 'pdf/*';
                  const hasDoc = a.includes('.doc') || a.includes('.docx');
                  const hasPpt = a.includes('.ppt') || a.includes('.pptx');

                  if (hasPdf && !hasDoc && !hasPpt) return 'PDF up to 10MB';
                  if (hasPdf || hasDoc || hasPpt) return 'PDF, DOC, DOCX, PPT, PPTX up to 10MB';

                  return 'Images, Videos, Documents up to 20MB';
                })()}
              </p>
            </>
          )}
        </div>
      )}
      
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileSelect}
        disabled={uploading}
        className="hidden"
      />
    </div>
  );
};

// Interfaces for course structure
interface ActivityOption {
  label?: string;
  image?: string;
  imageFile?: File | null;
  imagePreview?: string | null;
}

interface ActivityQuestion {
  question: string;
  questionImage?: string;
  feedbackStatement?: string;
  questionImageFile?: File | null;
  questionImagePreview?: string | null;
  allowMultiple: boolean;
  options: ActivityOption[];
  correctAnswer: ActivityOption;
  correctAnswers?: number[];
  correctAnswerIndex?: number;
}

interface ActivityInstruction {
  questionToBeAnswered: number;
  marksToPass: number;
  description: string;
}

interface CourseSlide {
  note: string;
  description: string;
  type: string;
  slideNumber: number;
  file: string;
  isPublished?: boolean;
  slideFile?: File | null;
  slidePreview?: string | null;
  isActivitySlide?: boolean;
  isPreTestSlide?: boolean;
  isFinalTestSlide?: boolean;
  isFinalExamSlide?: boolean;
  activity?: {
    instruction: ActivityInstruction;
    questions: ActivityQuestion[];
  };
}

interface CourseChapter {
  title: string;
  description: string;
  type: string;
  chapterNumber: number;
  activityAt: number;
  lessonDuration: number;
  isPublished: boolean;
  slides: CourseSlide[];
  midTestSlide?: CourseSlide; // Only mid test remains in chapters
}

interface CourseSection {
  title: string;
  description: string;
  chapters: CourseChapter[];
}

// New interfaces for tests
interface CourseTest {
  questionToBeAnswered: number;
  marksToPass: number;
  description: string;
}

interface QuestionBankItem {
  question: string;
  questionImage?: string;
  feedbackStatement?: string;
  questionImageFile?: File | null;
  questionImagePreview?: string | null;
  allowMultiple: boolean;
  options: ActivityOption[];
  correctAnswer: ActivityOption;
  correctAnswers?: number[];
  correctAnswerIndex?: number;
  courseId?: string;
  midTestId?: string;
}

const NewCoursePage:FC<ICourseForm> = ({ item, onClose, isModal = false }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeStep, setActiveStep] = useState(0);

  // Get courseName and existing course data from navigation state or props
  const initialCourseName = location.state?.courseName || "";
  const courseToEdit = item || location.state?.course;
  const existingCourse = courseToEdit ? transformCourseToFormData(courseToEdit) : null;

  const [course, setCourse] = useState({
    title: existingCourse?.title || initialCourseName || "",
    coverIcon: existingCourse?.coverIcon || "",
    description: existingCourse?.description || "",
    isPublished: existingCourse?.isPublished || false,
  });

  const [savedCourseId, setSavedCourseId] = useState<string | null>(
    courseToEdit?.id ?? null,
  );
  const [pendingNotificationType, setPendingNotificationType] = useState<
    "created" | "updated" | null | undefined
  >(courseToEdit?.pendingNotificationType ?? null);
  const [isNotifying, setIsNotifying] = useState(false);

  const [courseIntro, setCourseIntro] = useState({
    title: existingCourse?.intro?.title || initialCourseName || "",
    summary: existingCourse?.intro?.summary || "",
    bannerImage: existingCourse?.intro?.bannerImage || "",
    thumbnail: existingCourse?.intro?.thumbnail || "",
  });

  // File states for uploads and previews
  const [courseFiles, setCourseFiles] = useState({
    coverIconFile: null as File | null,
    coverIconPreview: existingCourse?.coverIcon || null,
  });

  const [courseIntroFiles, setCourseIntroFiles] = useState({
    bannerImageFile: null as File | null,
    bannerImagePreview: existingCourse?.intro?.bannerImage || null,
    thumbnailFile: null as File | null,
    thumbnailPreview: existingCourse?.intro?.thumbnail || null,
  });

  // New state for tests and question bank
  const [preTest, setPreTest] = useState<CourseTest>({
    questionToBeAnswered: existingCourse?.preTest?.questionToBeAnswered || 0,
    marksToPass: existingCourse?.preTest?.marksToPass || 0,
    description: existingCourse?.preTest?.description || "",
  });

  const [finalTest, setFinalTest] = useState<CourseTest>({
    questionToBeAnswered: existingCourse?.finalTest?.questionToBeAnswered || 0,
    marksToPass: existingCourse?.finalTest?.marksToPass || 0,
    description: existingCourse?.finalTest?.description || "",
  });

    const [finalExam, setFinalExam] = useState<CourseTest>({
    questionToBeAnswered: existingCourse?.finalExam?.questionToBeAnswered || 0,
    marksToPass: existingCourse?.finalExam?.marksToPass || 0,
    description: existingCourse?.finalExam?.description || "",
  });
  
  // Fix the question bank initialization
  const [questionBank, setQuestionBank] = useState<QuestionBankItem[]>(
    existingCourse?.questionBank?.map(q => ({
      question: q.question || '',
      questionImage: q.questionImage || '',
      feedbackStatement: q.feedbackStatement || '',
      questionImageFile: null,
      questionImagePreview: q.questionImage || null,
      allowMultiple: q.allowMultiple || false,
      options: q.options?.map(opt => ({
        label: opt.label || '',
        image: opt.image || '',
        imageFile: null,
        imagePreview: opt.image || null,
      })) || [],
      correctAnswer: q.correctAnswer ? {
        label: q.correctAnswer.label || '',
        image: q.correctAnswer.image || '',
        imageFile: null,
        imagePreview: q.correctAnswer.image || null,
      } : { label: '', image: '', imageFile: null, imagePreview: null },
      correctAnswers: q.correctAnswers || [],
      correctAnswerIndex: q.correctAnswerIndex,
    })) || []
  );

  const [sections, setSections] = useState<CourseSection[]>(
    existingCourse?.sections.map(section => ({
      ...section,
      chapters: section.chapters.map(chapter => ({
        ...chapter,
        type: "",
        slides: chapter.slides.map((slide: CourseSlideForm) => {
          const fileUrl = slide.file || "";
          
          let slideType = "";
          if (fileUrl) {
            const urlLower = fileUrl.toLowerCase();
            if (urlLower.includes('.mp4') || urlLower.includes('.webm') || urlLower.includes('.avi') || urlLower.includes('.mov')) {
              slideType = "video";
            } else if (urlLower.includes('.pdf') || urlLower.includes('.doc') || urlLower.includes('.docx') || urlLower.includes('.ppt') || urlLower.includes('.pptx')) {
              slideType = "document";
            } else if (urlLower.includes('.jpg') || urlLower.includes('.jpeg') || urlLower.includes('.png') || urlLower.includes('.gif') || urlLower.includes('.webp')) {
              slideType = "image";
            }
          }
          
          return {
            ...slide,
            type: slideType,
            file: fileUrl,
            slidePreview: fileUrl,
          };
        }),
        midTestSlide: chapter.midTestSlide ? {
          ...chapter.midTestSlide,
          type: "test",
        } : undefined
      })),
    })) || [
      {
        title: "",
        description: "",
        chapters: [
          {
            title: "",
            description: "",
            type: "",
            chapterNumber: 1,
            activityAt: 0,
            lessonDuration: 0,
            isPublished: true,
            slides: [
              {
                note: "",
                description: "",
                type: "",
                slideNumber: 1,
                file: "",
                isPublished: true,
                slideFile: null,
                slidePreview: null,
                isActivitySlide: false,
                isPreTestSlide: false,
                isFinalTestSlide: false,
              },
            ],
            midTestSlide: {
              note: "Mid Test",
              description: "Mid-test activity during the chapter",
              type: "test",
              slideNumber: 0,
              file: "",
              slideFile: null,
              slidePreview: null,
              isActivitySlide: true,
              isPreTestSlide: false,
              isFinalTestSlide: false,
              activity: {
                instruction: { questionToBeAnswered: 0, marksToPass: 0, description: '' },
                questions: []
              }
            }
          },
        ],
      },
    ]
  );

  const [collapsedSections, setCollapsedSections] = useState<Set<number>>(new Set());
  const [collapsedChapters, setCollapsedChapters] = useState<Set<string>>(new Set());
  const [collapsedSlides, setCollapsedSlides] = useState<Set<string>>(new Set());
  const [collapsedIndividualSlides, setCollapsedIndividualSlides] = useState<Set<string>>(new Set());
  
  // Validation state
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  
  // Loading states
  const [isDraftSaving, setIsDraftSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState<{ name: string; type: 'video' | 'pdf' | 'image' | 'document' } | null>(null);
  
  // Draft restore modal state
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [savedDataForRestore, setSavedDataForRestore] = useState<Record<string, unknown> | null>(null);

  // Mutations for create/update
  const createCourseMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => createCourse(data),
  });

  const updateCourseMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => updateCourse(id, data),
  });

  // Update course and intro titles when courseName changes from navigation
  useEffect(() => {
    if (initialCourseName && !course.title && !courseIntro.title) {
      setCourse(prev => ({ ...prev, title: initialCourseName }));
      setCourseIntro(prev => ({ ...prev, title: initialCourseName }));
    }
  }, [initialCourseName, course.title, courseIntro.title]);

  // Auto-save function
  const saveDataToStorage = useCallback(() => {
    try {
      const dataToSave = {
        course,
        courseIntro,
        sections,
        preTest,
        finalTest,
        finalExam,
        questionBank,
        activeStep,
        courseFiles: {
          coverIconPreview: courseFiles.coverIconPreview,
        },
        courseIntroFiles: {
          bannerImagePreview: courseIntroFiles.bannerImagePreview,
          thumbnailPreview: courseIntroFiles.thumbnailPreview,
        },
        timestamp: Date.now()
      };
      
      saveToLocalStorage(AUTO_SAVE_KEY, dataToSave);
    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  }, [course, courseIntro, sections, preTest, finalTest,finalExam, questionBank, activeStep, courseFiles.coverIconPreview, courseIntroFiles.bannerImagePreview, courseIntroFiles.thumbnailPreview]);

  // Load saved data on component mount
  useEffect(() => {
    const savedData = loadFromLocalStorage(AUTO_SAVE_KEY);
    const isEditingExistingCourse = existingCourse || courseToEdit || location.state?.course || initialCourseName;
    
    if (savedData && !isEditingExistingCourse) {
      setSavedDataForRestore(savedData);
      setShowDraftModal(true);
    }
  }, []);

  // FIX: Auto-save on data changes - Added all necessary dependencies
  useEffect(() => {
    if (activeStep === 0 && sections.length === 1 && sections[0].title === "") return;
    if (isDraftSaving || isPublishing) return;
    
    const isEditingExistingCourse = existingCourse || courseToEdit || location.state?.course;
    if (isEditingExistingCourse) return;

    const timeoutId = setTimeout(() => {
      saveDataToStorage();
    }, 2000);

    return () => clearTimeout(timeoutId);
  }, [
    course, 
    courseIntro, 
    sections, 
    preTest, 
    finalTest, 
    finalExam,
    questionBank, 
    activeStep, 
    isDraftSaving, 
    isPublishing, 
    saveDataToStorage, 
    existingCourse, 
    courseToEdit, 
    location.state?.course,
    // ADDED: Include file preview states that are part of the saved data
    courseFiles.coverIconPreview,
    courseIntroFiles.bannerImagePreview, 
    courseIntroFiles.thumbnailPreview
  ]);

  // Handle draft restoration
  const handleRestoreDraft = () => {
    if (savedDataForRestore) {
      const data = savedDataForRestore as Record<string, unknown>;
      
      if (data.course) {
        const restoredCourse = data.course as typeof course;
        setCourse(restoredCourse);
        if (restoredCourse.coverIcon) {
          setCourseFiles(prev => ({
            ...prev,
            coverIconPreview: restoredCourse.coverIcon,
          }));
        }
      }
      
      if (data.courseIntro) {
        const restoredIntro = data.courseIntro as typeof courseIntro;
        setCourseIntro(restoredIntro);
        setCourseIntroFiles(prev => ({
          ...prev,
          bannerImagePreview: restoredIntro.bannerImage || prev.bannerImagePreview,
          thumbnailPreview: restoredIntro.thumbnail || prev.thumbnailPreview,
        }));
      }
      
      if (data.sections) {
        const restoredSections = (data.sections as CourseSection[]).map(section => ({
          ...section,
          chapters: section.chapters.map(chapter => ({
            ...chapter,
            slides: chapter.slides.map(slide => ({
              ...slide,
              file: slide.file || "",
              slidePreview: slide.slidePreview || slide.file || null,
              slideFile: null,
            })),
            midTestSlide: chapter.midTestSlide ? {
              ...chapter.midTestSlide,
              file: chapter.midTestSlide.file || "",
              slidePreview: chapter.midTestSlide.slidePreview || chapter.midTestSlide.file || null,
              slideFile: null,
            } : undefined,
          })),
        }));
        
        setSections(restoredSections);
      }

      if (data.preTest) {
        setPreTest(data.preTest as CourseTest);
      }

      if (data.finalTest) {
        setFinalTest(data.finalTest as CourseTest);
      }
      if (data.finalExam) {
        setFinalExam(data.finalExam as CourseTest);
      }
      if (data.questionBank) {
        setQuestionBank(data.questionBank as QuestionBankItem[]);
      }
      
      if (typeof data.activeStep === 'number') {
        setActiveStep(data.activeStep);
      }
      
      if (data.courseFiles && typeof data.courseFiles === 'object' && data.courseFiles !== null) {
        const courseFilesData = data.courseFiles as Record<string, unknown>;
        setCourseFiles(prev => ({
          ...prev,
          coverIconPreview: courseFilesData.coverIconPreview as string | null,
        }));
      }
      
      if (data.courseIntroFiles && typeof data.courseIntroFiles === 'object' && data.courseIntroFiles !== null) {
        const courseIntroFilesData = data.courseIntroFiles as Record<string, unknown>;
        setCourseIntroFiles(prev => ({
          ...prev,
          bannerImagePreview: courseIntroFilesData.bannerImagePreview as string | null,
          thumbnailPreview: courseIntroFilesData.thumbnailPreview as string | null,
        }));
      }
    }
    
    setShowDraftModal(false);
    setSavedDataForRestore(null);
  };

  // Handle discarding draft
  const handleDiscardDraft = () => {
    clearFromLocalStorage(AUTO_SAVE_KEY);
    setShowDraftModal(false);
    setSavedDataForRestore(null);
  };

  // Function to check if all required fields are completed for publishing
  const canPublish = (): boolean => {
    // Check all steps except the publish step (last step)
    for (let i = 0; i < steps.length - 1; i++) {
      const validation = validateStep(i);
      if (!validation.isValid) {
        console.log(`Step ${i + 1} (${steps[i]}) validation failed:`, validation.errors);
        return false;
      }
    }
    
    // Check activity slide requirements
    for (const section of sections) {
      for (const chapter of section.chapters) {
        const slideCount = chapter.slides.length;
        const activityAt = chapter.activityAt;
        
        if (activityAt > 0) {
          // If activity is at position N, we need (N-1) regular slides + the activity slide
          const minRequiredSlides = activityAt - 1;
          if (slideCount < minRequiredSlides) {
            console.log(`Chapter "${chapter.title}" needs ${minRequiredSlides} slides but only has ${slideCount} (activity at position ${activityAt})`);
            return false;
          }
        }
      }
    }
    
    console.log('All validation checks passed, can publish!');
    return true;
  };

  const toggleSection = (idx: number) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  const toggleChapter = (sIdx: number, cIdx: number) => {
    const key = `${sIdx}-${cIdx}`;
    setCollapsedChapters(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleSlideGroup = (sIdx: number, cIdx: number) => {
    const key = `${sIdx}-${cIdx}`;
    setCollapsedSlides(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleIndividualSlide = (sIdx: number, cIdx: number, slIdx: number, slideType?: string) => {
    const key = slideType ? `${sIdx}-${cIdx}-${slideType}` : `${sIdx}-${cIdx}-${slIdx}`;
    setCollapsedIndividualSlides(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Validation functions for each step
  const validateStep = (stepIndex: number): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    switch (stepIndex) {
      case 0: // Course step
        if (!course.title.trim()) errors.push("Course title is required");
        if (!course.description.trim()) errors.push("Course description is required");
        if (!course.coverIcon.trim()) errors.push("Cover icon is required");
        break;
        
      case 1: // Intro step
        if (!courseIntro.title.trim()) errors.push("Intro title is required");
        if (!courseIntro.summary.trim()) errors.push("Summary is required");
        if (!courseIntro.bannerImage.trim()) errors.push("Banner image is required");
        if (!courseIntro.thumbnail.trim()) errors.push("Thumbnail is required");
        break;
        
      case 2: // Sections step
        sections.forEach((section, idx) => {
          if (!section.title.trim()) errors.push(`Section ${idx + 1} title is required`);
        });
        break;
        
      case 3: // Chapters step
        sections.forEach((section, sIdx) => {
          if (!section.chapters || section.chapters.length === 0) {
            errors.push(`Section ${sIdx + 1} must have at least one chapter`);
          } else {
            section.chapters.forEach((chapter, cIdx) => {
              if (!chapter.title.trim()) errors.push(`Chapter ${cIdx + 1} in Section ${sIdx + 1} title is required`);
              if (!chapter.lessonDuration || chapter.lessonDuration <= 0) errors.push(`Chapter ${cIdx + 1} in Section ${sIdx + 1} lesson duration is required`);
              if (!chapter.activityAt || chapter.activityAt <= 0) errors.push(`Chapter ${cIdx + 1} in Section ${sIdx + 1} activity slide number is required`);
            });
          }
        });
        break;
        
      case 4: // Slides step
        sections.forEach((section, sIdx) => {
          section.chapters.forEach((chapter, cIdx) => {
            chapter.slides.forEach((slide, slIdx) => {
              if (!slide.file.trim()) errors.push(`Slide ${slIdx + 1} in Chapter ${cIdx + 1}, Section ${sIdx + 1} content is required`);
            });
            
            // Only validate mid test slide (final test removed)
            if (chapter.midTestSlide) {
              const midTestErrors = validateTestSlide(chapter.midTestSlide, `Mid Test for Chapter ${cIdx + 1}, Section ${sIdx + 1}`);
              errors.push(...midTestErrors);
            }
          });
        });
        break;

      case 5: // Tests step
        // Validate pre-test
        if (!preTest.questionToBeAnswered || preTest.questionToBeAnswered <= 0) {
          errors.push("Pre-test: Questions to Answer is required and must be greater than 0");
        }
        if (!preTest.marksToPass || preTest.marksToPass < 0) {
          errors.push("Pre-test: Marks to Pass is required and must be greater or equal 0 but not empty");
        }
        if (!preTest.description.trim()) {
          errors.push("Pre-test: Test Description is required");
        }

        // Validate final test
        if (!finalTest.questionToBeAnswered || finalTest.questionToBeAnswered <= 0) {
          errors.push("Final test: Questions to Answer is required and must be greater than 0");
        }
        if (!finalTest.marksToPass || finalTest.marksToPass < 0) {
          errors.push("Final test: Marks to Pass is required and must be greater or equal 0 but not empty");
        }
        if (!finalTest.description.trim()) {
          errors.push("Final test: Test Description is required");
        }

         // Validate final test
        if (!finalExam.questionToBeAnswered || finalExam.questionToBeAnswered <= 0) {
          errors.push("Final exam: Questions to Answer is required and must be greater than 0");
        }
        if (!finalExam.marksToPass || finalExam.marksToPass < 0) {
          errors.push("Final exam: Marks to Pass is required and must be greater or equal 0 but not empty");
        }
        if (!finalExam.description.trim()) {
          errors.push("Final exam: Test Description is required");
        }

        // Validate question bank
        if (questionBank.length === 0) {
          errors.push("At least one question is required in the question bank");
        } else {
          questionBank.forEach((question, qIdx) => {
            if (!question.question.trim()) {
              errors.push(`Question ${qIdx + 1} in question bank: Question text is required`);
            }
            
            if (!question.options || question.options.length === 0) {
              errors.push(`Question ${qIdx + 1} in question bank: Must have at least one option`);
            } else {
              question.options.forEach((option, oIdx) => {
                if (!option.label || !option.label.trim()) {
                  errors.push(`Question ${qIdx + 1}, Option ${oIdx + 1} in question bank: Option text is required`);
                }
              });
              
              if (question.allowMultiple) {
                if (!question.correctAnswers || question.correctAnswers.length === 0) {
                  errors.push(`Question ${qIdx + 1} in question bank: Must have at least one correct answer selected`);
                }
              } else {
                if (question.correctAnswerIndex === undefined || question.correctAnswerIndex < 0) {
                  errors.push(`Question ${qIdx + 1} in question bank: Must have a correct answer selected`);
                }
              }
            }
          });
        }
        break;
        
      case 6: // Publish step
        break;
    }
    
    return { isValid: errors.length === 0, errors };
  };

  // Helper function to validate test slides
  const validateTestSlide = (slide: CourseSlide, context: string): string[] => {
    const errors: string[] = [];
    
    if (!slide.activity) {
      errors.push(`${context}: Test configuration is required`);
      return errors;
    }
    
    const { instruction, questions } = slide.activity;
    
    if (!instruction.questionToBeAnswered || instruction.questionToBeAnswered <= 0) {
      errors.push(`${context}: Questions to Answer is required and must be greater than 0`);
    }
    
    if (!instruction.marksToPass || instruction.marksToPass < 0) {
      errors.push(`${context}: Marks to Pass is required and must be greater or equal 0 but not empty`);
    }
    
    if (!instruction.description.trim()) {
      errors.push(`${context}: Test Description is required`);
    }
    
    if (!questions || questions.length === 0) {
      errors.push(`${context}: At least 1 question is required`);
    } else {
      questions.forEach((question, qIdx) => {
        if (!question.question.trim()) {
          errors.push(`${context}: Question ${qIdx + 1} text is required`);
        }
        
        if (!question.options || question.options.length === 0) {
          errors.push(`${context}: Question ${qIdx + 1} must have at least one option`);
        } else {
          question.options.forEach((option, oIdx) => {
            if (!option.label || !option.label.trim()) {
              errors.push(`${context}: Question ${qIdx + 1}, Option ${oIdx + 1} text is required`);
            }
          });
          
          if (question.allowMultiple) {
            if (!question.correctAnswers || question.correctAnswers.length === 0) {
              errors.push(`${context}: Question ${qIdx + 1} must have at least one correct answer selected`);
            }
          } else {
            if (question.correctAnswerIndex === undefined || question.correctAnswerIndex < 0) {
              errors.push(`${context}: Question ${qIdx + 1} must have a correct answer selected`);
            }
          }
        }
      });
      
      if (instruction.questionToBeAnswered > 0 && questions.length < instruction.questionToBeAnswered) {
        errors.push(`${context}: Test requires ${instruction.questionToBeAnswered} questions, but only ${questions.length} questions are created`);
      }
    }
    
    return errors;
  };

  const goToStep = (idx: number) => {
    if (idx > activeStep) {
      let canProceed = true;
      const allErrors: string[] = [];
      
      for (let i = activeStep; i < idx; i++) {
        const validation = validateStep(i);
        if (!validation.isValid) {
          canProceed = false;
          allErrors.push(`Complete Step ${i + 1} (${steps[i]}) first:`);
          allErrors.push(...validation.errors.map(error => `  • ${error}`));
        }
      }
      
      if (!canProceed) {
        setValidationErrors(allErrors);
        return;
      }
    }
    
    setValidationErrors([]);
    saveDataToStorage();
    setActiveStep(idx);
  };

  // Helper function to check if a test field has validation errors
  const hasTestFieldError = (context: string, fieldName: string): boolean => {
    return validationErrors.some(error => {
      const errorLower = error.toLowerCase();
      const contextLower = context.toLowerCase();
      const fieldLower = fieldName.toLowerCase();
      
      return errorLower.includes(contextLower) && errorLower.includes(fieldLower);
    });
  };

  // Helper function to render test slides (for mid test only now)
  const renderTestSlide = (
    slide: CourseSlide, 
    _sIdx: number, 
    _cIdx: number, 
    slideKey: string,
    testType: 'activity',
    onUpdate: (updatedSlide: CourseSlide) => void,
    onRemove?: () => void
  ) => {
    const isCollapsed = collapsedIndividualSlides.has(slideKey);
    const testConfig = {
      'activity': { color: 'orange', label: 'Mid Test' }
    };
    const config = testConfig[testType];

    const testContext = 'Activity Test';

    const colorClasses = {
      'activity': {
        container: 'border-orange-300 bg-orange-50',  
        header: 'bg-orange-100 border-orange-200',
        badge: 'bg-orange-500',
        section: 'bg-orange-50'
      }
    };

    return (
      <div className={`bg-gray-50 rounded-lg border-2 overflow-hidden ${colorClasses[testType].container}`}>
        <div className={`flex items-center justify-between p-4 border-b ${colorClasses[testType].header}`}>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const key = slideKey;
                setCollapsedIndividualSlides(prev => {
                  const next = new Set(prev);
                  if (next.has(key)) {
                    next.delete(key);
                  } else {
                    next.add(key);
                  }
                  return next;
                });
              }}
              className="p-1 hover:bg-gray-200 rounded transition-all"
            >
              {isCollapsed ? <ChevronRight size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
            </button>
            <h6 className="font-semibold text-gray-700 text-sm">
              {slide.note}
            </h6>
            <span className={`${colorClasses[testType].badge} text-white text-xs px-2 py-1 rounded-full font-medium`}>
              {config.label}
            </span>
          </div>
          {onRemove && (
            <button
              onClick={onRemove}
              className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-lg transition-all"
              title="Remove slide"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
        {!isCollapsed && (
          <div className="p-5 space-y-6">
            <div className="pt-6 mt-2">
              
              {/* Test Instructions */}
              <div className={`${colorClasses[testType].section} p-4 rounded-lg mb-6`}>
                <h4 className="font-semibold text-gray-800 mb-4">Test Instructions</h4>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Questions to Answer <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      placeholder="5"
                      min="1"
                      value={slide.activity?.instruction.questionToBeAnswered || ''}
                      onChange={e => {
                        const updatedSlide = { ...slide };
                        if (!updatedSlide.activity) {
                          updatedSlide.activity = {
                            instruction: { questionToBeAnswered: 0, marksToPass: 0, description: '' },
                            questions: []
                          };
                        }
                        updatedSlide.activity.instruction.questionToBeAnswered = parseInt(e.target.value) || 0;
                        onUpdate(updatedSlide);
                        if (validationErrors.length > 0) setValidationErrors([]);
                      }}
                      className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-all bg-white ${
                        hasTestFieldError(testContext, 'Questions to Answer') 
                          ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                          : 'border-gray-300 focus:ring-[#4d81d2] focus:border-transparent'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Marks to Pass <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      placeholder="70"
                      min="1"
                      max="100"
                      value={slide.activity?.instruction.marksToPass || ''}
                      onChange={e => {
                        const updatedSlide = { ...slide };
                        if (!updatedSlide.activity) {
                          updatedSlide.activity = {
                            instruction: { questionToBeAnswered: 0, marksToPass: 0, description: '' },
                            questions: []
                          };
                        }
                        updatedSlide.activity.instruction.marksToPass = parseInt(e.target.value) || 0;
                        onUpdate(updatedSlide);
                        if (validationErrors.length > 0) setValidationErrors([]);
                      }}
                      className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-all bg-white ${
                        hasTestFieldError(testContext, 'Marks to Pass') 
                          ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                          : 'border-gray-300 focus:ring-[#4d81d2] focus:border-transparent'
                      }`}
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Test Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    placeholder="Instructions for the test"
                    value={slide.activity?.instruction.description || ''}
                    onChange={e => {
                      const updatedSlide = { ...slide };
                      if (!updatedSlide.activity) {
                        updatedSlide.activity = {
                          instruction: { questionToBeAnswered: 0, marksToPass: 0, description: '' },
                          questions: []
                        };
                      }
                      updatedSlide.activity.instruction.description = e.target.value;
                      onUpdate(updatedSlide);
                      if (validationErrors.length > 0) setValidationErrors([]);
                    }}
                    rows={3}
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-all resize-none bg-white ${
                      hasTestFieldError(testContext, 'Test Description') 
                        ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                        : 'border-gray-300 focus:ring-[#4d81d2] focus:border-transparent'
                    }`}
                  />
                </div>
              </div>

              {/* Questions Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-gray-800">Test Questions</h4>
                  <button
                    onClick={() => {
                      const updatedSlide = { ...slide };
                      if (!updatedSlide.activity) {
                        updatedSlide.activity = {
                          instruction: { questionToBeAnswered: 0, marksToPass: 0, description: '' },
                          questions: []
                        };
                      }
                      updatedSlide.activity.questions.push({
                        question: '',
                        questionImage: '',
                        feedbackStatement: '',
                        questionImageFile: null,
                        questionImagePreview: null,
                        allowMultiple: false,
                        options: [{ label: '', image: '', imageFile: null, imagePreview: null }],
                        correctAnswer: { label: '', image: '', imageFile: null, imagePreview: null },
                        correctAnswers: [],
                        correctAnswerIndex: undefined
                      });
                      onUpdate(updatedSlide);
                      if (validationErrors.length > 0) setValidationErrors([]);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-[#4d81d2] text-white rounded-lg hover:bg-[#3d71c2] transition-all text-sm"
                  >
                    <Plus size={16} />
                    Add Question
                  </button>
                </div>

                {(slide.activity?.questions || []).map((question, qIdx) => (
                  <div key={qIdx} className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                      <h5 className="font-semibold text-gray-800 text-lg">Question {qIdx + 1}</h5>
                      <button
                        onClick={() => {
                          const updatedSlide = { ...slide };
                          if (updatedSlide.activity) {
                            updatedSlide.activity.questions = updatedSlide.activity.questions.filter((_, i) => i !== qIdx);
                            onUpdate(updatedSlide);
                          }
                        }}
                        className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Question <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          placeholder="Enter your question"
                          value={question.question}
                          onChange={e => {
                            const updatedSlide = { ...slide };
                            if (updatedSlide.activity) {
                              updatedSlide.activity.questions[qIdx].question = e.target.value;
                              onUpdate(updatedSlide);
                              if (validationErrors.length > 0) setValidationErrors([]);
                            }
                          }}
                          rows={5}
                          className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-all resize-none bg-white ${
                            hasTestFieldError(testContext, `Question ${qIdx + 1} text`) 
                              ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                              : 'border-gray-300 focus:ring-[#4d81d2] focus:border-transparent'
                          }`}
                        />
                      </div>
                      <div>
                        <FileUpload
                          label="Question Image (Optional)"
                          accept="image/*"
                          file={question.questionImageFile || null}
                          preview={question.questionImagePreview || null}
                          onFileChange={(file, preview) => {
                            const updatedSlide = { ...slide };
                            if (updatedSlide.activity) {
                              updatedSlide.activity.questions[qIdx].questionImageFile = file;
                              updatedSlide.activity.questions[qIdx].questionImagePreview = preview;
                              onUpdate(updatedSlide);
                            }
                          }}
                          onUrlChange={(url) => {
                            const updatedSlide = { ...slide };
                            if (updatedSlide.activity) {
                              updatedSlide.activity.questions[qIdx].questionImage = url;
                              onUpdate(updatedSlide);
                            }
                          }}
                          onRemove={() => {
                            const updatedSlide = { ...slide };
                            if (updatedSlide.activity) {
                              updatedSlide.activity.questions[qIdx].questionImageFile = null;
                              updatedSlide.activity.questions[qIdx].questionImagePreview = null;
                              updatedSlide.activity.questions[qIdx].questionImage = '';
                              onUpdate(updatedSlide);
                            }
                          }}
                          // FIX: Use parent upload state
                          isUploading={isUploading}
                          setIsUploading={setIsUploading}
                          setUploadingFile={setUploadingFile}
                        />
                      </div>
                       <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Feedback statement <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          placeholder="Enter your feedback statement"
                          value={question.feedbackStatement}
                          onChange={e => {
                            const updatedSlide = { ...slide };
                            if (updatedSlide.activity) {
                              updatedSlide.activity.questions[qIdx].feedbackStatement = e.target.value;
                              onUpdate(updatedSlide);
                              if (validationErrors.length > 0) setValidationErrors([]);
                            }
                          }}
                          rows={5}
                          className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-all resize-none bg-white ${
                            hasTestFieldError(testContext, `Question ${qIdx + 1} text`) 
                              ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                              : 'border-gray-300 focus:ring-[#4d81d2] focus:border-transparent'
                          }`}
                        />
                      </div>
                    </div>
                    
                    <div className="mb-6">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={question.allowMultiple}
                          onChange={e => {
                            const updatedSlide = { ...slide };
                            if (updatedSlide.activity) {
                              updatedSlide.activity.questions[qIdx].allowMultiple = e.target.checked;
                              onUpdate(updatedSlide);
                            }
                          }}
                          className="w-4 h-4 text-[#4d81d2] bg-gray-100 border-gray-300 rounded focus:ring-[#4d81d2] focus:ring-2"
                        />
                        <span className="text-sm font-medium text-gray-700">Allow Multiple Answers</span>
                      </label>
                    </div>

                    {/* Options Section */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h6 className="font-semibold text-gray-700">Answer Options</h6>
                        <button
                          onClick={() => {
                            const updatedSlide = { ...slide };
                            if (updatedSlide.activity) {
                              updatedSlide.activity.questions[qIdx].options.push({ 
                                label: '', 
                                image: '', 
                                imageFile: null, 
                                imagePreview: null 
                              });
                              onUpdate(updatedSlide);
                              if (validationErrors.length > 0) setValidationErrors([]);
                            }
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 bg-green-500 text-white rounded-md hover:bg-green-600 transition-all text-sm"
                        >
                          <Plus size={14} />
                          Add Option
                        </button>
                      </div>

                      {question.options.map((option, oIdx) => (
                        <div key={oIdx} className="bg-gray-50 p-4 rounded-lg border">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-medium text-gray-600">Option {oIdx + 1}</span>
                            <button
                              onClick={() => {
                                const updatedSlide = { ...slide };
                                if (updatedSlide.activity) {
                                  updatedSlide.activity.questions[qIdx].options = 
                                    updatedSlide.activity.questions[qIdx].options.filter((_, i) => i !== oIdx);
                                  onUpdate(updatedSlide);
                                }
                              }}
                              className="text-red-500 hover:text-red-700 p-1"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                          
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Option Text <span className="text-red-500">*</span>
                              </label>
                              <textarea
                                placeholder="Enter option text"
                                value={option.label || ''}
                                onChange={e => {
                                  const updatedSlide = { ...slide };
                                  if (updatedSlide.activity) {
                                    updatedSlide.activity.questions[qIdx].options[oIdx].label = e.target.value;
                                    onUpdate(updatedSlide);
                                    if (validationErrors.length > 0) setValidationErrors([]);
                                  }
                                }}
                                rows={5}
                                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-all resize-none bg-white ${
                                  hasTestFieldError(testContext, `Question ${qIdx + 1}, Option ${oIdx + 1} text`) 
                                    ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                                    : 'border-gray-300 focus:ring-[#4d81d2] focus:border-transparent'
                                }`}
                              />
                            </div>
                            <div>
                              <FileUpload
                                label="Option Image (Optional)"
                                accept="image/*"
                                file={option.imageFile || null}
                                preview={option.imagePreview || null}
                                onFileChange={(file, preview) => {
                                  const updatedSlide = { ...slide };
                                  if (updatedSlide.activity) {
                                    updatedSlide.activity.questions[qIdx].options[oIdx].imageFile = file;
                                    updatedSlide.activity.questions[qIdx].options[oIdx].imagePreview = preview;
                                    onUpdate(updatedSlide);
                                  }
                                }}
                                onUrlChange={(url) => {
                                  const updatedSlide = { ...slide };
                                  if (updatedSlide.activity) {
                                    updatedSlide.activity.questions[qIdx].options[oIdx].image = url;
                                    onUpdate(updatedSlide);
                                  }
                                }}
                                onRemove={() => {
                                  const updatedSlide = { ...slide };
                                  if (updatedSlide.activity) {
                                    updatedSlide.activity.questions[qIdx].options[oIdx].imageFile = null;
                                    updatedSlide.activity.questions[qIdx].options[oIdx].imagePreview = null;
                                    updatedSlide.activity.questions[qIdx].options[oIdx].image = '';
                                    onUpdate(updatedSlide);
                                  }
                                }}
                                // FIX: Use parent upload state
                                isUploading={isUploading}
                                setIsUploading={setIsUploading}
                                setUploadingFile={setUploadingFile}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                      {question.options.length === 0 && (
                        <div className="text-center py-4 text-gray-500 text-sm">
                          No options added. Click "Add Option" to get started.
                        </div>
                      )}
                    </div>

                    {/* Correct Answer Section */}
                    <div className="mt-6 pt-4 border-t border-gray-200">
                      <h6 className="font-semibold text-gray-700 mb-3">Correct Answer</h6>
                      {question.allowMultiple ? (
                        <div className="space-y-2">
                          <p className="text-sm text-gray-600 mb-3">Select all correct options:</p>
                          {question.options.map((option, oIdx) => (
                            <label key={oIdx} className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={question.correctAnswers?.includes(oIdx) || false}
                                onChange={e => {
                                  const updatedSlide = { ...slide };
                                  if (updatedSlide.activity) {
                                    const questionObj = updatedSlide.activity.questions[qIdx];
                                    if (!questionObj.correctAnswers) questionObj.correctAnswers = [];
                                    
                                    if (e.target.checked) {
                                      if (!questionObj.correctAnswers.includes(oIdx)) {
                                        questionObj.correctAnswers.push(oIdx);
                                      }
                                    } else {
                                      questionObj.correctAnswers = questionObj.correctAnswers.filter((idx: number) => idx !== oIdx);
                                    }
                                    onUpdate(updatedSlide);
                                    if (validationErrors.length > 0) setValidationErrors([]);
                                  }
                                }}
                                className="w-4 h-4 text-[#4d81d2] bg-gray-100 border-gray-300 rounded focus:ring-[#4d81d2] focus:ring-2"
                              />
                              <span className="text-sm text-gray-700">{option.label || `Option ${oIdx + 1}`}</span>
                            </label>
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-sm text-gray-600 mb-3">Select the correct option:</p>
                          {question.options.map((option, oIdx) => (
                            <label key={oIdx} className="flex items-center gap-2">
                              <input
                                type="radio"
                                name={`correct-${slideKey}-${qIdx}`}
                                checked={question.correctAnswerIndex === oIdx}
                                onChange={() => {
                                  const updatedSlide = { ...slide };
                                  if (updatedSlide.activity) {
                                    const questionObj = updatedSlide.activity.questions[qIdx];
                                    questionObj.correctAnswerIndex = oIdx;
                                    questionObj.correctAnswer = option;
                                    onUpdate(updatedSlide);
                                    if (validationErrors.length > 0) setValidationErrors([]);
                                  }
                                }}
                                className="w-4 h-4 text-[#4d81d2] bg-gray-100 border-gray-300 focus:ring-[#4d81d2] focus:ring-2"
                              />
                              <span className="text-sm text-gray-700">{option.label || `Option ${oIdx + 1}`}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
<div className="mt-4 flex justify-end">
                  <button
                    onClick={() => {
                      const updatedSlide = { ...slide };
                      if (!updatedSlide.activity) {
                        updatedSlide.activity = {
                          instruction: { questionToBeAnswered: 0, marksToPass: 0, description: '' },
                          questions: []
                        };
                      }
                      updatedSlide.activity.questions.push({
                        question: '',
                        questionImage: '',
                        feedbackStatement: '',
                        questionImageFile: null,
                        questionImagePreview: null,
                        allowMultiple: false,
                        options: [{ label: '', image: '', imageFile: null, imagePreview: null }],
                        correctAnswer: { label: '', image: '', imageFile: null, imagePreview: null },
                        correctAnswers: [],
                        correctAnswerIndex: undefined
                      });
                      onUpdate(updatedSlide);
                      if (validationErrors.length > 0) setValidationErrors([]);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-[#4d81d2] text-white rounded-lg hover:bg-[#3d71c2] transition-all text-sm"
                  >
                    <Plus size={16} />
                    Add Question
                  </button>
                  </div>
                  </div>
                ))}

                {(slide.activity?.questions || []).length === 0 && (
                  <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                    <p>No questions added yet. Click "Add Question" to get started.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };
  
  const nextStep = () => {
    const validation = validateStep(activeStep);
    if (validation.isValid) {
      setValidationErrors([]);
      saveDataToStorage();
      setActiveStep((s) => Math.min(s + 1, steps.length - 1));
    } else {
      setValidationErrors(validation.errors);
    }
  };
  
  const prevStep = () => {
    saveDataToStorage();
    setActiveStep((s) => Math.max(s - 1, 0));
  };

  // Manual save draft function
  const handleSaveDraft = async () => {
    saveDataToStorage();
    await handlePublish(true);
  };

  const syncCourseNotificationState = (response: unknown) => {
    const courseData = (response as { data?: { course?: ICourse } })?.data?.course;
    if (courseData?.id) setSavedCourseId(courseData.id);
    if (courseData) {
      setPendingNotificationType(courseData.pendingNotificationType ?? null);
      setCourse((prev) => ({
        ...prev,
        isPublished: courseData.isPublished ?? prev.isPublished,
      }));
    }
  };

  const handleNotifyUsers = async () => {
    const courseId = savedCourseId || courseToEdit?.id;
    if (!courseId) {
      toast.error("Save the course before notifying users");
      return;
    }
    setIsNotifying(true);
    try {
      const response = await notifyCourseUsers(courseId);
      syncCourseNotificationState(response);
      toast.success(response.message || "Users notified successfully");
    } catch (error: unknown) {
      const errorMessage =
        (error as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Failed to notify users";
      toast.error(errorMessage);
    } finally {
      setIsNotifying(false);
    }
  };

  const showNotifyButton =
    course.isPublished && !!pendingNotificationType && !!(savedCourseId || courseToEdit?.id);
  const notifyButtonLabel =
    pendingNotificationType === "created"
      ? "Notify users (new course)"
      : "Notify users (updates)";

  const handlePublish = async (isDraft: boolean) => {
    try {
      console.log('handlePublish called with isDraft:', isDraft);
      
      if (isDraft) {
        setIsDraftSaving(true);
      } else {
        setIsPublishing(true);
      }

      saveDataToStorage();

      // Validate all steps before publishing
      const allErrors: string[] = [];
      for (let i = 0; i < steps.length; i++) {
        const validation = validateStep(i);
        if (!validation.isValid) {
          allErrors.push(`Step ${i + 1} (${steps[i]}):`);
          allErrors.push(...validation.errors.map(error => `  • ${error}`));
        }
      }

      // Additional validation for activityAt vs slides count
      if (!isDraft) {
        sections.forEach((section) => {
          section.chapters.forEach((chapter) => {
            const slideCount = chapter.slides.length;
            const activityAt = chapter.activityAt;
            
            if (activityAt > 0) {
              // If activity is at position N, we need (N-1) regular slides + the activity slide
              const minRequiredSlides = activityAt - 1;
              
              if (slideCount < minRequiredSlides) {
                allErrors.push(`Chapter "${chapter.title}" in Section "${section.title}":`);
                allErrors.push(`  • Activity is set at slide ${activityAt}, but chapter only has ${slideCount} slides. Need at least ${minRequiredSlides} slides + activity.`);
              }
            }
          });
        });
      }

      if (allErrors.length > 0 && !isDraft) {
        console.log('Validation failed with errors:', allErrors);
        setValidationErrors(allErrors);
        setIsDraftSaving(false);
        setIsPublishing(false);
        return;
      }

      // Create JSON payload
      const courseData = {
        title: course.title || '',
        description: course.description || '',
        isPublished: !isDraft,
        coverIcon: course.coverIcon || '',
        
        // Course intro data
        courseIntro: {
          title: courseIntro.title || '',
          summary: courseIntro.summary || '',
          bannerImage: courseIntro.bannerImage || '',
          thumbnail: courseIntro.thumbnail || '',
        },

        // Pre-test and final test data
        preTest: {
          questionToBeAnswered: preTest.questionToBeAnswered || 0,
          marksToPass: preTest.marksToPass || 0,
          description: preTest.description || '',
        },

        finalTest: {
          questionToBeAnswered: finalTest.questionToBeAnswered || 0,
          marksToPass: finalTest.marksToPass || 0,
          description: finalTest.description || '',
        },

        finalExam: {
          questionToBeAnswered: finalExam.questionToBeAnswered || 0,
          marksToPass: finalExam.marksToPass || 0,
          description: finalExam.description || '',
        },

        // Question bank
        questionBank: questionBank.map(q => ({
          question: q.question || '',
          questionImage: q.questionImage || '',
          feedbackStatement: q.feedbackStatement || '',
          allowMultiple: q.allowMultiple ?? false,
          options: q.options.map(opt => ({
            label: opt.label || '',
            image: opt.image || ''
          })),
          correctAnswer: {
            label: q.correctAnswer?.label || '',
            image: q.correctAnswer?.image || ''
          },
          correctAnswers: q.correctAnswers || [],
          correctAnswerIndex: q.correctAnswerIndex
        })),

        // Sections with only mid test (no pre-test or final test in sections/chapters)
        sections: sections.map((section) => ({
          title: section.title || '',
          description: section.description || '',
          chapters: section.chapters.map((chapter, cIdx) => ({
            title: chapter.title || '',
            description: chapter.description || '',
            chapterNumber: chapter.chapterNumber || (cIdx + 1),
            activityAt: chapter.activityAt || 0,
            lessonDuration: chapter.lessonDuration || 0,
            isPublished: chapter.isPublished ?? true,
            slides: chapter.slides.map((slide, slIdx) => {
              const activityAt = chapter.activityAt || 0;
              let slideNumber = slIdx + 1;
              
              if (activityAt > 0 && slideNumber >= activityAt) {
                slideNumber = slideNumber + 1;
              }
              
              return {
                note: slide.note || '',
                description: slide.description || '',
                slideNumber: slideNumber,
                file: slide.file || '',
                isPublished: slide.isPublished ?? true,
              };
            }),
            midTest: chapter.midTestSlide ? {
              questionToBeAnswered: chapter.midTestSlide.activity?.instruction.questionToBeAnswered || 0,
              marksToPass: chapter.midTestSlide.activity?.instruction.marksToPass || 0,
              description: chapter.midTestSlide.activity?.instruction.description || '',
              // isPublished: chapter.midTestSlide.isPublished ?? true,
              questionnaires: chapter.midTestSlide.activity?.questions.map(q => ({
                question: q.question || '',
                questionImage: q.questionImage || '',
                feedbackStatement: q.feedbackStatement || '',
                allowMultiple: q.allowMultiple ?? false,
                options: q.options.map(opt => ({
                  label: opt.label || '',
                  image: opt.image || ''
                })),
                answers: q.allowMultiple 
                  ? (q.correctAnswers?.map(index => ({
                      label: q.options[index]?.label || '',
                      image: q.options[index]?.image || '',
                    })) || [])
                  : q.correctAnswerIndex !== undefined 
                    ? [{
                        label: q.options[q.correctAnswerIndex]?.label || '',
                        image: q.options[q.correctAnswerIndex]?.image || '',
                      }]
                    : [],
              })) || []
            } : null
          }))
        }))
      };

      // Handle create vs update with JSON payload
      console.log('Validation passed, calling API with courseData:', courseData);
      
      if (courseToEdit && courseToEdit.id) {
        console.log('Updating existing course with ID:', courseToEdit.id);
        updateCourseMutation.mutate(
          { id: courseToEdit.id, data: courseData },
          {
            onSuccess(res) {
              syncCourseNotificationState(res);
              const message = isDraft ? "Draft saved successfully" : "Course updated successfully";
              toast.success(message);
              if (!isDraft) {
                clearFromLocalStorage(AUTO_SAVE_KEY);
                queryClient.invalidateQueries({ queryKey: ['courses'] });
                
                if (isModal && onClose) {
                  onClose();
                } else {
                  navigate('/courses');
                }
              }
            },
            onError(error: unknown) {
              console.error('Update course error:', error);
              const errorMessage = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || `Failed to ${isDraft ? 'save draft' : 'update course'}`;
              toast.error(errorMessage);
            },
            onSettled() {
              setIsDraftSaving(false);
              setIsPublishing(false);
            }
          }
        );
      } else {
        console.log('Creating new course');
        createCourseMutation.mutate(courseData, {
          onSuccess(res) {
            syncCourseNotificationState(res);
            const message = isDraft ? "Draft saved successfully" : "Course created successfully";
            toast.success(message);
            if (!isDraft) {
              clearFromLocalStorage(AUTO_SAVE_KEY);
              queryClient.invalidateQueries({ queryKey: ['courses'] });
              
              if (isModal && onClose) {
                onClose();
              } else {
                navigate('/courses');
              }
            }
          },
          onError(error: unknown) {
            console.error('Create course error:', error);
            const errorMessage = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || `Failed to ${isDraft ? 'save draft' : 'create course'}`;
            toast.error(errorMessage);
          },
          onSettled() {
            setIsDraftSaving(false);
            setIsPublishing(false);
          }
        });
      }
      
    } catch (error) {
      console.error("Error processing course:", error);
      toast.error("Error processing course");
      setIsDraftSaving(false);
      setIsPublishing(false);
    }
  };

  // Helper function to render question form (reused for question bank)
  const renderQuestionForm = (question: QuestionBankItem, qIdx: number, onUpdate: (question: QuestionBankItem) => void, onRemove: () => void) => {
    return (
      <div key={qIdx} className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h5 className="font-semibold text-gray-800 text-lg">Question {qIdx + 1}</h5>
          <button
            onClick={onRemove}
            className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-lg transition-all"
          >
            <Trash2 size={18} />
          </button>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Question <span className="text-red-500">*</span>
            </label>
            <textarea
              placeholder="Enter your question"
              value={question.question}
              onChange={e => {
                onUpdate({ ...question, question: e.target.value });
                if (validationErrors.length > 0) setValidationErrors([]);
              }}
              rows={5}
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-all resize-none bg-white ${
                validationErrors.some(error => error.includes(`Question ${qIdx + 1} in question bank`)) 
                  ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                  : 'border-gray-300 focus:ring-[#4d81d2] focus:border-transparent'
              }`}
            />
          </div>
          <div>
            <FileUpload
              label="Question Image (Optional)"
              accept="image/*"
              file={question.questionImageFile || null}
              preview={question.questionImagePreview || null}
              // FIX: Use parent upload state
              isUploading={isUploading}
              setIsUploading={setIsUploading}
              setUploadingFile={setUploadingFile}
              onFileChange={(file, preview) => {
                onUpdate({ 
                  ...question, 
                  questionImageFile: file,
                  questionImagePreview: preview
                });
              }}
              onUrlChange={(url) => {
                onUpdate({ ...question, questionImage: url });
              }}
              onRemove={() => {
                onUpdate({ 
                  ...question, 
                  questionImageFile: null,
                  questionImagePreview: null,
                  questionImage: ''
                });
              }}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Feedback statement <span className="text-red-500">*</span>
            </label>
            <textarea
              placeholder="Enter your question"
              value={question.feedbackStatement}
              onChange={e => {
                onUpdate({ ...question, feedbackStatement: e.target.value });
                if (validationErrors.length > 0) setValidationErrors([]);
              }}
              rows={5}
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-all resize-none bg-white ${
                validationErrors.some(error => error.includes(`Question ${qIdx + 1} in question bank`)) 
                  ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                  : 'border-gray-300 focus:ring-[#4d81d2] focus:border-transparent'
              }`}
            />
          </div>
        </div>
        
        <div className="mb-6">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={question.allowMultiple}
              onChange={e => {
                onUpdate({ ...question, allowMultiple: e.target.checked });
              }}
              className="w-4 h-4 text-[#4d81d2] bg-gray-100 border-gray-300 rounded focus:ring-[#4d81d2] focus:ring-2"
            />
            <span className="text-sm font-medium text-gray-700">Allow Multiple Answers</span>
          </label>
        </div>

        {/* Options Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h6 className="font-semibold text-gray-700">Answer Options</h6>
            <button
              onClick={() => {
                onUpdate({
                  ...question,
                  options: [...question.options, { label: '', image: '', imageFile: null, imagePreview: null }]
                });
                if (validationErrors.length > 0) setValidationErrors([]);
              }}
              className="flex items-center gap-1 px-3 py-1.5 bg-green-500 text-white rounded-md hover:bg-green-600 transition-all text-sm"
            >
              <Plus size={14} />
              Add Option
            </button>
          </div>

          {question.options.map((option, oIdx) => (
            <div key={oIdx} className="bg-gray-50 p-4 rounded-lg border">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-600">Option {oIdx + 1}</span>
                <button
                  onClick={() => {
                    onUpdate({
                      ...question,
                      options: question.options.filter((_, i) => i !== oIdx)
                    });
                  }}
                  className="text-red-500 hover:text-red-700 p-1"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Option Text <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    placeholder="Enter option text"
                    value={option.label || ''}
                    onChange={e => {
                      const newOptions = [...question.options];
                      newOptions[oIdx] = { ...newOptions[oIdx], label: e.target.value };
                      onUpdate({ ...question, options: newOptions });
                      if (validationErrors.length > 0) setValidationErrors([]);
                    }}
                    rows={5}
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-all resize-none bg-white ${
                      validationErrors.some(error => error.includes(`Question ${qIdx + 1}, Option ${oIdx + 1} in question bank`)) 
                        ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                        : 'border-gray-300 focus:ring-[#4d81d2] focus:border-transparent'
                    }`}
                  />
                </div>
                <div>
                  <FileUpload
                    label="Option Image (Optional)"
                    accept="image/*"
                    file={option.imageFile || null}
                    preview={option.imagePreview || null}
                    // FIX: Use parent upload state
                    isUploading={isUploading}
                    setIsUploading={setIsUploading}
                    setUploadingFile={setUploadingFile}
                    onFileChange={(file, preview) => {
                      const newOptions = [...question.options];
                      newOptions[oIdx] = { ...newOptions[oIdx], imageFile: file, imagePreview: preview };
                      onUpdate({ ...question, options: newOptions });
                    }}
                    onUrlChange={(url) => {
                      const newOptions = [...question.options];
                      newOptions[oIdx] = { ...newOptions[oIdx], image: url };
                      onUpdate({ ...question, options: newOptions });
                    }}
                    onRemove={() => {
                      const newOptions = [...question.options];
                      newOptions[oIdx] = { 
                        ...newOptions[oIdx], 
                        imageFile: null, 
                        imagePreview: null, 
                        image: '' 
                      };
                      onUpdate({ ...question, options: newOptions });
                    }}
                  />
                </div>
              </div>
            </div>
          ))}

          {question.options.length === 0 && (
            <div className="text-center py-4 text-gray-500 text-sm">
              No options added. Click "Add Option" to get started.
            </div>
          )}
        </div>

        {/* Correct Answer Section */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <h6 className="font-semibold text-gray-700 mb-3">Correct Answer</h6>
          {question.allowMultiple ? (
            <div className="space-y-2">
              <p className="text-sm text-gray-600 mb-3">Select all correct options:</p>
              {question.options.map((option, oIdx) => (
                <label key={oIdx} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={question.correctAnswers?.includes(oIdx) || false}
                    onChange={e => {
                      const newCorrectAnswers = question.correctAnswers ? [...question.correctAnswers] : [];
                      
                      if (e.target.checked) {
                        if (!newCorrectAnswers.includes(oIdx)) {
                          newCorrectAnswers.push(oIdx);
                        }
                      } else {
                        const index = newCorrectAnswers.indexOf(oIdx);
                        if (index > -1) {
                          newCorrectAnswers.splice(index, 1);
                        }
                      }
                      onUpdate({ ...question, correctAnswers: newCorrectAnswers });
                      if (validationErrors.length > 0) setValidationErrors([]);
                    }}
                    className="w-4 h-4 text-[#4d81d2] bg-gray-100 border-gray-300 rounded focus:ring-[#4d81d2] focus:ring-2"
                  />
                  <span className="text-sm text-gray-700">{option.label || `Option ${oIdx + 1}`}</span>
                </label>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-gray-600 mb-3">Select the correct option:</p>
              {question.options.map((option, oIdx) => (
                <label key={oIdx} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`correct-${qIdx}`}
                    checked={question.correctAnswerIndex === oIdx}
                    onChange={() => {
                      onUpdate({ 
                        ...question, 
                        correctAnswerIndex: oIdx,
                        correctAnswer: option
                      });
                      if (validationErrors.length > 0) setValidationErrors([]);
                    }}
                    className="w-4 h-4 text-[#4d81d2] bg-gray-100 border-gray-300 focus:ring-[#4d81d2] focus:ring-2"
                  />
                  <span className="text-sm text-gray-700">{option.label || `Option ${oIdx + 1}`}</span>
                </label>
              ))}
            </div>
          )}
          <div className="mt-4 flex justify-end">
           <button
                  onClick={() => {
                    setQuestionBank([...questionBank, {
                      question: '',
                      questionImage: '',
                      questionImageFile: null,
                      questionImagePreview: null,
                      allowMultiple: false,
                      options: [{ label: '', image: '', imageFile: null, imagePreview: null }],
                      correctAnswer: { label: '', image: '', imageFile: null, imagePreview: null },
                      correctAnswers: [],
                      correctAnswerIndex: undefined
                    }]);
                    if (validationErrors.length > 0) setValidationErrors([]);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-[#4d81d2] text-white rounded-lg hover:bg-[#3d71c2] transition-all"
                >
                  <Plus size={16} />
                  Add Question
                </button>
                </div>
        </div>
      </div>
    );
  };

  const renderStep = () => {
    switch (activeStep) {
      case 0:
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Course Title <span className="text-red-500">*</span>
                {initialCourseName && course.title === initialCourseName && (
                  <span className="ml-2 text-xs text-blue-600 font-normal">(from previous step --you can edit if you want)</span>
                )}
              </label>
              <input
                type="text"
                placeholder="Enter course title"
                value={course.title}
                onChange={e => {
                  setCourse({ ...course, title: e.target.value });
                  if (validationErrors.length > 0) setValidationErrors([]);
                }}
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-all ${
                  validationErrors.some(error => error.includes('Course title')) 
                    ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                    : 'border-gray-300 focus:ring-[#4d81d2] focus:border-transparent'
                }`}
              />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <FileUpload
              label="Cover Icon"
              required
              accept="image/*"
              file={courseFiles.coverIconFile}
              preview={courseFiles.coverIconPreview}
              hasError={validationErrors.some(error => error.includes('Cover icon'))}
              onFileChange={(file, preview) => {
                setCourseFiles({ ...courseFiles, coverIconFile: file, coverIconPreview: preview });
                if (validationErrors.length > 0) setValidationErrors([]);
              }}
              onUrlChange={(url) => {
                setCourse({ ...course, coverIcon: url });
              }}
              onRemove={() => {
                setCourseFiles({ ...courseFiles, coverIconFile: null, coverIconPreview: null });
                setCourse({ ...course, coverIcon: "" });
              }}
              // FIX: Use parent upload state
              isUploading={isUploading}
              setIsUploading={setIsUploading}
              setUploadingFile={setUploadingFile}
            />
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                placeholder="Provide a detailed course description"
                value={course.description}
                onChange={e => {
                  setCourse({ ...course, description: e.target.value });
                  if (validationErrors.length > 0) setValidationErrors([]);
                }}
                rows={5}
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-all resize-none ${
                  validationErrors.some(error => error.includes('Course description')) 
                    ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                    : 'border-gray-300 focus:ring-[#4d81d2] focus:border-transparent'
                }`}
              />
            </div>
            </div>
          </div>
        );
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Intro Title <span className="text-red-500">*</span>
                {initialCourseName && courseIntro.title === initialCourseName && (
                  <span className="ml-2 text-xs text-blue-600 font-normal">(from course title --you can edit if you want)</span>
                )}
              </label>
              <input
                type="text"
                placeholder="Enter intro title"
                value={courseIntro.title}
                onChange={e => {
                  setCourseIntro({ ...courseIntro, title: e.target.value });
                  if (validationErrors.length > 0) setValidationErrors([]);
                }}
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-all ${
                  validationErrors.some(error => error.includes('Intro title')) 
                    ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                    : 'border-gray-300 focus:ring-[#4d81d2] focus:border-transparent'
                }`}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Summary <span className="text-red-500">*</span>
              </label>
              <textarea
                placeholder="Write a brief summary"
                value={courseIntro.summary}
                onChange={e => {
                  setCourseIntro({ ...courseIntro, summary: e.target.value });
                  if (validationErrors.length > 0) setValidationErrors([]);
                }}
                rows={4}
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-all resize-none ${
                  validationErrors.some(error => error.includes('Summary')) 
                    ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                    : 'border-gray-300 focus:ring-[#4d81d2] focus:border-transparent'
                }`}
              />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <FileUpload
              label="Banner Image"
              accept="image/*"
              required
              file={courseIntroFiles.bannerImageFile}
              preview={courseIntroFiles.bannerImagePreview}
              hasError={validationErrors.some(error => error.includes('Banner image'))}
              onFileChange={(file, preview) => {
                setCourseIntroFiles({ ...courseIntroFiles, bannerImageFile: file, bannerImagePreview: preview });
                if (validationErrors.length > 0) setValidationErrors([]);
              }}
              onUrlChange={(url) => {
                setCourseIntro({ ...courseIntro, bannerImage: url });
              }}
              onRemove={() => {
                setCourseIntroFiles({ ...courseIntroFiles, bannerImageFile: null, bannerImagePreview: null });
                setCourseIntro({ ...courseIntro, bannerImage: "" });
              }}
              // FIX: Use parent upload state
              isUploading={isUploading}
              setIsUploading={setIsUploading}
              setUploadingFile={setUploadingFile}
            />
            
            <FileUpload
              label="Thumbnail"
              accept="image/*"
              required
              file={courseIntroFiles.thumbnailFile}
              preview={courseIntroFiles.thumbnailPreview}
              hasError={validationErrors.some(error => error.includes('Thumbnail'))}
              onFileChange={(file, preview) => {
                setCourseIntroFiles({ ...courseIntroFiles, thumbnailFile: file, thumbnailPreview: preview });
                if (validationErrors.length > 0) setValidationErrors([]);
              }}
              onUrlChange={(url) => {
                setCourseIntro({ ...courseIntro, thumbnail: url });
              }}
              onRemove={() => {
                setCourseIntroFiles({ ...courseIntroFiles, thumbnailFile: null, thumbnailPreview: null });
                setCourseIntro({ ...courseIntro, thumbnail: "" });
              }}
              // FIX: Use parent upload state
              isUploading={isUploading}
              setIsUploading={setIsUploading}
              setUploadingFile={setUploadingFile}
            />
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-6">
            {sections.map((section, idx) => {
              const isCollapsed = collapsedSections.has(idx);
              return (
                <div key={idx} className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                  <div className="flex items-center justify-between p-4 bg-white border-b border-gray-200">
                    <button
                      onClick={() => toggleSection(idx)}
                      className="flex items-center gap-2 flex-1 text-left group"
                    >
                      {isCollapsed ? <ChevronRight size={20} className="text-gray-500" /> : <ChevronDown size={20} className="text-gray-500" />}
                      <h4 className="font-semibold text-gray-800 group-hover:text-[#4d81d2] transition-colors">
                        Section {idx + 1} {section.title && `- ${section.title}`}
                      </h4>
                    </button>
                    <button
                      onClick={() => setSections(sections.filter((_, i) => i !== idx))}
                      className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-lg transition-all"
                      title="Remove section"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                  {!isCollapsed && (
                    <div className="p-6 space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Section Title <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="Enter section title"
                          value={section.title}
                          onChange={e => {
                            const updated = [...sections];
                            updated[idx].title = e.target.value;
                            setSections(updated);
                            if (validationErrors.length > 0) setValidationErrors([]);
                          }}
                          className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-all bg-white ${
                            validationErrors.some(error => error.includes(`Section ${idx + 1} title`)) 
                              ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                              : 'border-gray-300 focus:ring-[#4d81d2] focus:border-transparent'
                          }`}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Section Description
                        </label>
                        <textarea
                          placeholder="Enter section description"
                          value={section.description}
                          onChange={e => {
                            const updated = [...sections];
                            updated[idx].description = e.target.value;
                            setSections(updated);
                          }}
                          rows={3}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4d81d2] focus:border-transparent transition-all resize-none bg-white"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            <button
              onClick={() => setSections([...sections, { 
                title: "", 
                description: "", 
                chapters: [],
              }])}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-white border-2 border-dashed border-gray-300 rounded-lg text-gray-600 font-medium hover:border-[#4d81d2] hover:text-[#4d81d2] hover:bg-blue-50 transition-all"
            >
              <Plus size={20} />
              Add Section
            </button>
          </div>
        );
      case 3:
        return (
          <div className="space-y-8">
            {sections.map((section, sIdx) => {
              const isSectionCollapsed = collapsedSections.has(sIdx);
              return (
                <div key={sIdx} className="space-y-4">
                  <button
                    onClick={() => toggleSection(sIdx)}
                    className="w-full bg-gradient-to-r from-gray-50 to-white px-4 py-3 rounded-lg border-l-4 border-[#4d81d2] flex items-center gap-2 group hover:shadow-sm transition-all"
                  >
                    {isSectionCollapsed ? <ChevronRight size={20} className="text-gray-500" /> : <ChevronDown size={20} className="text-gray-500" />}
                    <h4 className="font-bold text-gray-800 group-hover:text-[#4d81d2] transition-colors">
                      {section.title || `Section ${sIdx + 1}`}
                    </h4>
                  </button>
                  {!isSectionCollapsed && (
                    <div className="space-y-4 pl-4">
                      {(section.chapters || []).map((chapter, cIdx) => {
                        const isChapterCollapsed = collapsedChapters.has(`${sIdx}-${cIdx}`);
                        return (
                          <div key={cIdx} className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                            <div className="flex items-center justify-between p-4 bg-white border-b border-gray-200">
                              <button
                                onClick={() => toggleChapter(sIdx, cIdx)}
                                className="flex items-center gap-2 flex-1 text-left group"
                              >
                                {isChapterCollapsed ? <ChevronRight size={18} className="text-gray-500" /> : <ChevronDown size={18} className="text-gray-500" />}
                                <h5 className="font-semibold text-gray-700 group-hover:text-[#4d81d2] transition-colors">
                                  Chapter {cIdx + 1} {chapter.title && `- ${chapter.title}`}
                                </h5>
                              </button>
                              <button
                                onClick={() => {
                                  const updated = [...sections];
                                  updated[sIdx].chapters = updated[sIdx].chapters.filter((_, i) => i !== cIdx);
                                  setSections(updated);
                                }}
                                className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-lg transition-all"
                                title="Remove chapter"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                            {!isChapterCollapsed && (
                              <div className="p-5 space-y-4">
                                <div>
                                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Chapter Title <span className="text-red-500">*</span>
                                  </label>
                                  <input
                                    type="text"
                                    placeholder="Enter chapter title"
                                    value={chapter.title}
                                    onChange={e => {
                                      const updated = [...sections];
                                      updated[sIdx].chapters[cIdx].title = e.target.value;
                                      setSections(updated);
                                      if (validationErrors.length > 0) setValidationErrors([]);
                                    }}
                                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-all bg-white ${
                                      validationErrors.some(error => error.includes(`Chapter ${cIdx + 1} in Section ${sIdx + 1} title`)) 
                                        ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                                        : 'border-gray-300 focus:ring-[#4d81d2] focus:border-transparent'
                                    }`}
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Chapter Description
                                  </label>
                                  <textarea
                                    placeholder="Enter chapter description"
                                    value={chapter.description}
                                    onChange={e => {
                                      const updated = [...sections];
                                      updated[sIdx].chapters[cIdx].description = e.target.value;
                                      setSections(updated);
                                    }}
                                    rows={3}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4d81d2] focus:border-transparent transition-all resize-none bg-white"
                                  />
                                </div>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                  <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                      Lesson Duration <span className="text-red-500">*</span>
                                      <span className="text-xs text-gray-500 font-normal ml-1">(in minutes)</span>
                                    </label>
                                    <input
                                      type="number"
                                      placeholder="80"
                                      min="1"
                                      value={chapter.lessonDuration || ''}
                                      onChange={e => {
                                        const updated = [...sections];
                                        updated[sIdx].chapters[cIdx].lessonDuration = parseInt(e.target.value) || 0;
                                        setSections(updated);
                                        if (validationErrors.length > 0) setValidationErrors([]);
                                      }}
                                      className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-all bg-white ${
                                        validationErrors.some(error => error.includes(`Chapter ${cIdx + 1} in Section ${sIdx + 1} lesson duration`)) 
                                          ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                                          : 'border-gray-300 focus:ring-[#4d81d2] focus:border-transparent'
                                      }`}
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                      Activity at Slide <span className="text-red-500">*</span>
                                      <span className="text-xs text-gray-500 font-normal ml-1">(slide number)</span>
                                    </label>
                                    <input
                                      type="number"
                                      placeholder="5"
                                      min="1"
                                      value={chapter.activityAt || ''}
                                      onChange={e => {
                                        const updated = [...sections];
                                        const newActivityAt = parseInt(e.target.value) || 0;
                                        updated[sIdx].chapters[cIdx].activityAt = newActivityAt;
                                        
                                        if (updated[sIdx].chapters[cIdx].midTestSlide) {
                                          updated[sIdx].chapters[cIdx].midTestSlide.slideNumber = newActivityAt;
                                        }
                                        
                                        setSections(updated);
                                        if (validationErrors.length > 0) setValidationErrors([]);
                                      }}
                                      className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-all bg-white ${
                                        validationErrors.some(error => error.includes(`Chapter ${cIdx + 1} in Section ${sIdx + 1} activity slide`) || error.includes(`Chapter ${cIdx + 1} in Section ${sIdx + 1}: Activity at slide`)) 
                                          ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                                          : 'border-gray-300 focus:ring-[#4d81d2] focus:border-transparent'
                                      }`}
                                    />
                                    {chapter.activityAt > 0 && (
                                      <div className="mt-1">
                                        <p className="text-xs text-gray-600">
                                          Activity will be placed at position {chapter.activityAt}. 
                                          Chapter needs at least {chapter.activityAt - 1} regular slides + the activity.
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                </div>

                              </div>
                            )}
                          </div>
                        );
                      })}
                      <button
                        onClick={() => {
                          const updated = [...sections];
                          updated[sIdx].chapters = [...(updated[sIdx].chapters || []), {
                            title: "",
                            description: "",
                            type: "",
                            chapterNumber: (updated[sIdx].chapters?.length || 0) + 1,
                            activityAt: 0,
                            lessonDuration: 0,
                            isPublished: false,
                            slides: [],
                            midTestSlide: {
                              note: "Mid Test",
                              description: "Mid-test for chapter assessment",
                              type: "test",
                              slideNumber: 0,
                              file: "",
                              // isPublished: true,
                              slideFile: null,
                              slidePreview: null,
                              isActivitySlide: true,
                              isPreTestSlide: false,
                              isFinalTestSlide: false,
                              activity: {
                                instruction: { questionToBeAnswered: 0, marksToPass: 0, description: '' },
                                questions: []
                              }
                            }
                          }];
                          setSections(updated);
                        }}
                        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-white border-2 border-dashed border-gray-300 rounded-lg text-gray-600 font-medium hover:border-[#4d81d2] hover:text-[#4d81d2] hover:bg-blue-50 transition-all"
                      >
                        <Plus size={18} />
                        Add Chapter
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      case 4:
        return (
          <div className="space-y-8">
            {sections.map((section, sIdx) => {
              const isSectionCollapsed = collapsedSections.has(sIdx);
              return (
                <div key={sIdx} className="space-y-6">
                  <button
                    onClick={() => toggleSection(sIdx)}
                    className="w-full bg-gradient-to-r from-gray-50 to-white px-4 py-3 rounded-lg border-l-4 border-[#4d81d2] flex items-center gap-2 group hover:shadow-sm transition-all"
                  >
                    {isSectionCollapsed ? <ChevronRight size={20} className="text-gray-500" /> : <ChevronDown size={20} className="text-gray-500" />}
                    <h4 className="font-bold text-gray-800 group-hover:text-[#4d81d2] transition-colors">
                      {section.title || `Section ${sIdx + 1}`}
                    </h4>
                  </button>
                  {!isSectionCollapsed && (
                    <div className="space-y-6 pl-4">
                      {(section.chapters || []).map((chapter, cIdx) => {
                        const isChapterCollapsed = collapsedChapters.has(`${sIdx}-${cIdx}`);
                        return (
                          <div key={cIdx} className="space-y-4">
                            <button
                              onClick={() => toggleChapter(sIdx, cIdx)}
                              className="w-full bg-gray-50 px-4 py-2 rounded-lg border-l-2 border-gray-400 flex items-center gap-2 group hover:bg-gray-100 transition-all"
                            >
                              {isChapterCollapsed ? <ChevronRight size={18} className="text-gray-500" /> : <ChevronDown size={18} className="text-gray-500" />}
                              <h5 className="font-semibold text-gray-700 group-hover:text-[#4d81d2] transition-colors">
                                {chapter.title || `Chapter ${cIdx + 1}`}
                              </h5>
                            </button>
                            {!isChapterCollapsed && (
                              <div className="space-y-4 pl-4">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm font-medium text-gray-600">
                                    Slides ({(chapter.slides || []).length})
                                    {chapter.midTestSlide && ' + Mid Test'}
                                  </span>
                                  <button
                                    onClick={() => toggleSlideGroup(sIdx, cIdx)}
                                    className="text-sm text-[#4d81d2] hover:text-[#3d71c2] font-medium flex items-center gap-1"
                                  >
                                    {collapsedSlides.has(`${sIdx}-${cIdx}`) ? (
                                      <>
                                        <ChevronDown size={16} />
                                        Expand All
                                      </>
                                    ) : (
                                      <>
                                        <ChevronUp size={16} />
                                        Collapse All
                                      </>
                                    )}
                                  </button>
                                </div>
                                {/* Render all slides in correct order by slideNumber */}
                                {(() => {
                                  const allSlides: Array<{
                                    type: 'regular' | 'midtest';
                                    slideNumber: number;
                                    slide: CourseSlide;
                                    key: string;
                                    slIdx?: number;
                                  }> = [];
                                  
                                  // Add regular slides
                                  (chapter.slides || []).forEach((slide, slIdx) => {
                                    const activityAt = chapter.activityAt || 0;
                                    let slideNumber = slIdx + 1;
                                    if (activityAt > 0 && slideNumber >= activityAt) {
                                      slideNumber = slideNumber + 1;
                                    }
                                    
                                    allSlides.push({
                                      type: 'regular',
                                      slideNumber: slideNumber,
                                      slide,
                                      slIdx,
                                      key: `slide-${slIdx}`
                                    });
                                  });
                                  
                                  // Add mid test slide
                                  if (chapter.midTestSlide) {
                                    allSlides.push({
                                      type: 'midtest',
                                      slideNumber: chapter.activityAt || 50,
                                      slide: chapter.midTestSlide,
                                      key: 'midtest'
                                    });
                                  }
                                  
                                  // Sort by slideNumber
                                  allSlides.sort((a, b) => a.slideNumber - b.slideNumber);
                                  
                                  return allSlides.map((item) => {
                                    const isGroupCollapsed = collapsedSlides.has(`${sIdx}-${cIdx}`);
                                    const isIndividualCollapsed = collapsedIndividualSlides.has(`${sIdx}-${cIdx}-${item.key}`);
                                    
                                    if (item.type === 'regular' && item.slIdx !== undefined) {
                                      const slide = item.slide;
                                      const slIdx = item.slIdx;
                                      return (
                                        <div key={item.key} className="bg-gray-50 rounded-lg border-2 border-gray-200 overflow-hidden">
                                          <div className="flex items-center justify-between p-4 border-b bg-white border-gray-200">
                                            <div className="flex items-center gap-2">
                                              <button
                                                onClick={() => toggleIndividualSlide(sIdx, cIdx, slIdx)}
                                                className="p-1 hover:bg-gray-200 rounded transition-all"
                                              >
                                                {isIndividualCollapsed ? <ChevronRight size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
                                              </button>
                                              <h6 className="font-semibold text-gray-700 text-sm">
                                                Slide {item.slideNumber} {slide.note && `- ${slide.note}`}
                                              </h6>
                                            </div>
                                            <button
                                              onClick={() => {
                                                const updated = [...sections];
                                                updated[sIdx].chapters[cIdx].slides = updated[sIdx].chapters[cIdx].slides.filter((_, i) => i !== slIdx);
                                                setSections(updated);
                                              }}
                                              className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-lg transition-all"
                                              title="Remove slide"
                                            >
                                              <Trash2 size={16} />
                                            </button>
                                          </div>
                                          {!isGroupCollapsed && !isIndividualCollapsed && (
                                            <div className="p-5 space-y-6">
                                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                                <div>
                                                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                                                    Slide Note
                                                  </label>
                                                  <input
                                                    type="text"
                                                    placeholder="Enter slide note"
                                                    value={slide.note}
                                                    onChange={e => {
                                                      const updated = [...sections];
                                                      updated[sIdx].chapters[cIdx].slides[slIdx].note = e.target.value;
                                                      setSections(updated);
                                                      if (validationErrors.length > 0) setValidationErrors([]);
                                                    }}
                                                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-all bg-white ${
                                                      validationErrors.some(error => error.includes(`Slide ${item.slideNumber} in Chapter ${cIdx + 1}, Section ${sIdx + 1} note`)) 
                                                        ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                                                        : 'border-gray-300 focus:ring-[#4d81d2] focus:border-transparent'
                                                    }`}
                                                  />
                                                </div>
                                                <div>
                                                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                                                    Slide Type
                                                  </label>
                                                  <select
                                                    value={slide.type}
                                                    onChange={e => {
                                                      const updated = [...sections];
                                                      updated[sIdx].chapters[cIdx].slides[slIdx].type = e.target.value;
                                                      setSections(updated);
                                                    }}
                                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4d81d2] focus:border-transparent transition-all bg-white"
                                                  >
                                                    <option value="">Select slide type</option>
                                                    <option value="image">Image</option>
                                                    <option value="video">Video</option>
                                                    <option value="document">Document</option>
                                                  </select>
                                                </div>
                                              </div>
                                              
                                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                                <div>
                                                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                                                    Slide Description
                                                  </label>
                                                  <textarea
                                                    placeholder="Enter slide description"
                                                    value={slide.description}
                                                    onChange={e => {
                                                      const updated = [...sections];
                                                      updated[sIdx].chapters[cIdx].slides[slIdx].description = e.target.value;
                                                      setSections(updated);
                                                    }}
                                                    rows={5}
                                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4d81d2] focus:border-transparent transition-all resize-none bg-white"
                                                  />
                                                </div>
                                                
                                                <FileUpload
                                                  label="Slide Content"
                                                  required
                                                  accept={slide.type === 'video' ? 'video/*' : slide.type === 'document' ? '.pdf' : 'image/*'}
                                                  file={slide.slideFile || null}
                                                  preview={slide.slidePreview || null}
                                                  hasError={validationErrors.some(error => error.includes(`Slide ${item.slideNumber} in Chapter ${cIdx + 1}, Section ${sIdx + 1} content`))}
                                                  // FIX: Use parent upload state for consistency
                                                  isUploading={isUploading}
                                                  setIsUploading={setIsUploading}
                                                  setUploadingFile={setUploadingFile}
                                                  onFileChange={(file, preview) => {
                                                    const updated = [...sections];
                                                    updated[sIdx].chapters[cIdx].slides[slIdx] = {
                                                      ...updated[sIdx].chapters[cIdx].slides[slIdx],
                                                      slideFile: file,
                                                      slidePreview: preview,
                                                    };
                                                    setSections(updated);
                                                    if (validationErrors.length > 0) setValidationErrors([]);
                                                  }}
                                                  onUrlChange={(url) => {
                                                    const updated = [...sections];
                                                    updated[sIdx].chapters[cIdx].slides[slIdx] = {
                                                      ...updated[sIdx].chapters[cIdx].slides[slIdx],
                                                      file: url
                                                    };
                                                    setSections(updated);
                                                  }}
                                                  onRemove={() => {
                                                    const updated = [...sections];
                                                    updated[sIdx].chapters[cIdx].slides[slIdx] = {
                                                      ...updated[sIdx].chapters[cIdx].slides[slIdx],
                                                      slideFile: null,
                                                      slidePreview: null,
                                                      file: ""
                                                    };
                                                    setSections(updated);
                                                  }}
                                                />
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    } else if (item.type === 'midtest') {
                                      return (
                                        <div key={item.key} className="mt-6">
                                          <div className="flex items-center justify-between mb-2">
                                            <h6 className="text-sm font-medium text-gray-600">Mid Test (Activity) - Position {item.slideNumber}</h6>
                                            <button
                                              onClick={() => {
                                                const updated = [...sections];
                                                updated[sIdx].chapters[cIdx].midTestSlide = undefined;
                                                setSections(updated);
                                              }}
                                              className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded transition-all"
                                              title="Remove Mid Test"
                                            >
                                              <Trash2 size={14} />
                                            </button>
                                          </div>
                                          {renderTestSlide(
                                            item.slide,
                                            sIdx,
                                            cIdx,
                                            `mid-test-${sIdx}-${cIdx}`,
                                            'activity',
                                            (updatedSlide) => {
                                              const updated = [...sections];
                                              updatedSlide.slideNumber = chapter.activityAt || 50;
                                              updated[sIdx].chapters[cIdx].midTestSlide = updatedSlide;
                                              setSections(updated);
                                            }
                                          )}
                                        </div>
                                      );
                                    }
                                    return null;
                                  });
                                })()}
                                
                                <button
                                  onClick={() => {
                                    const updated = [...sections];
                                    const activityAt = updated[sIdx].chapters[cIdx].activityAt || 0;
                                    const currentSlides = updated[sIdx].chapters[cIdx].slides || [];
                                    
                                    let newSlideNumber = currentSlides.length + 1;
                                    if (activityAt > 0 && newSlideNumber >= activityAt) {
                                      newSlideNumber = newSlideNumber + 1;
                                    }
                                    
                                    updated[sIdx].chapters[cIdx].slides = [...currentSlides, {
                                      note: "",
                                      description: "",
                                      type: "",
                                      slideNumber: newSlideNumber,
                                      file: "",
                                      isPublished: false,
                                      slideFile: null,
                                      slidePreview: null,
                                      isActivitySlide: false,
                                      isPreTestSlide: false,
                                      isFinalTestSlide: false
                                    }];
                                    setSections(updated);
                                  }}
                                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-white border-2 border-dashed border-gray-300 rounded-lg text-gray-600 font-medium hover:border-[#4d81d2] hover:text-[#4d81d2] hover:bg-blue-50 transition-all"
                                >
                                  <Plus size={18} />
                                  Add Slide
                                </button>

                                {/* Add Mid Test Button */}
                                {!chapter.midTestSlide && (
                                  <div className="mt-6">
                                    <button
                                      onClick={() => {
                                        const updated = [...sections];
                                        const activityAt = updated[sIdx].chapters[cIdx].activityAt || 2;
                                        updated[sIdx].chapters[cIdx].midTestSlide = {
                                          note: "Mid Test",
                                          description: "Mid-test for chapter assessment",
                                          type: "test",
                                          slideNumber: activityAt,
                                          file: "",
                                          // isPublished: true,
                                          slideFile: null,
                                          slidePreview: null,
                                          isActivitySlide: true,
                                          isPreTestSlide: false,
                                          isFinalTestSlide: false,
                                          activity: {
                                            instruction: { questionToBeAnswered: 0, marksToPass: 0, description: '' },
                                            questions: []
                                          }
                                        };
                                        setSections(updated);
                                      }}
                                      className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-all"
                                    >
                                      <Plus size={18} />
                                      Add Mid Test
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      case 5: // Tests step
        return (
          <div className="space-y-8">
            {/* Pre-Test Configuration */}
            <div className="bg-blue-50 rounded-lg border-2 border-blue-200 p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Pre-Test Configuration</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Questions to Answer <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    placeholder="5"
                    min="1"
                    value={preTest.questionToBeAnswered || ''}
                    onChange={e => {
                      setPreTest({ ...preTest, questionToBeAnswered: parseInt(e.target.value) || 0 });
                      if (validationErrors.length > 0) setValidationErrors([]);
                    }}
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-all bg-white ${
                      validationErrors.some(error => error.includes('Pre-test: Questions to Answer')) 
                        ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                        : 'border-gray-300 focus:ring-[#4d81d2] focus:border-transparent'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Marks to Pass <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    placeholder="70"
                    min="1"
                    max="100"
                    value={preTest.marksToPass || ''}
                    onChange={e => {
                      setPreTest({ ...preTest, marksToPass: parseInt(e.target.value) || 0 });
                      if (validationErrors.length > 0) setValidationErrors([]);
                    }}
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-all bg-white ${
                      validationErrors.some(error => error.includes('Pre-test: Marks to Pass')) 
                        ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                        : 'border-gray-300 focus:ring-[#4d81d2] focus:border-transparent'
                    }`}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Test Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  placeholder="Instructions for the pre-test"
                  value={preTest.description || ''}
                  onChange={e => {
                    setPreTest({ ...preTest, description: e.target.value });
                    if (validationErrors.length > 0) setValidationErrors([]);
                  }}
                  rows={3}
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-all resize-none bg-white ${
                    validationErrors.some(error => error.includes('Pre-test: Test Description')) 
                      ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                      : 'border-gray-300 focus:ring-[#4d81d2] focus:border-transparent'
                  }`}
                />
              </div>
            </div>

            {/* Final Test Configuration */}
            <div className="bg-green-50 rounded-lg border-2 border-green-200 p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Final Test Configuration</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Questions to Answer <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    placeholder="10"
                    min="1"
                    value={finalTest.questionToBeAnswered || ''}
                    onChange={e => {
                      setFinalTest({ ...finalTest, questionToBeAnswered: parseInt(e.target.value) || 0 });
                      if (validationErrors.length > 0) setValidationErrors([]);
                    }}
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-all bg-white ${
                      validationErrors.some(error => error.includes('Final test: Questions to Answer')) 
                        ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                        : 'border-gray-300 focus:ring-[#4d81d2] focus:border-transparent'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Marks to Pass <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    placeholder="80"
                    min="1"
                    max="100"
                    value={finalTest.marksToPass || ''}
                    onChange={e => {
                      setFinalTest({ ...finalTest, marksToPass: parseInt(e.target.value) || 0 });
                      if (validationErrors.length > 0) setValidationErrors([]);
                    }}
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-all bg-white ${
                      validationErrors.some(error => error.includes('Final test: Marks to Pass')) 
                        ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                        : 'border-gray-300 focus:ring-[#4d81d2] focus:border-transparent'
                    }`}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Test Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  placeholder="Instructions for the final test"
                  value={finalTest.description || ''}
                  onChange={e => {
                    setFinalTest({ ...finalTest, description: e.target.value });
                    if (validationErrors.length > 0) setValidationErrors([]);
                  }}
                  rows={3}
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-all resize-none bg-white ${
                    validationErrors.some(error => error.includes('Final test: Test Description')) 
                      ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                      : 'border-gray-300 focus:ring-[#4d81d2] focus:border-transparent'
                  }`}
                />
              </div>
            </div>

                 {/* Final Exam Configuration */}
            <div className="bg-yellow-50 rounded-lg border-2 border-yellow-200 p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Final Exam Configuration</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Questions to Answer <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    placeholder="10"
                    min="1"
                    value={finalExam.questionToBeAnswered || ''}
                    onChange={e => {
                      setFinalExam({ ...finalExam, questionToBeAnswered: parseInt(e.target.value) || 0 });
                      if (validationErrors.length > 0) setValidationErrors([]);
                    }}
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-all bg-white ${
                      validationErrors.some(error => error.includes('Final test: Questions to Answer')) 
                        ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                        : 'border-gray-300 focus:ring-[#4d81d2] focus:border-transparent'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Marks to Pass <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    placeholder="80"
                    min="1"
                    max="100"
                    value={finalExam.marksToPass || ''}
                    onChange={e => {
                      setFinalExam({ ...finalExam, marksToPass: parseInt(e.target.value) || 0 });
                      if (validationErrors.length > 0) setValidationErrors([]);
                    }}
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-all bg-white ${
                      validationErrors.some(error => error.includes('Final test: Marks to Pass')) 
                        ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                        : 'border-gray-300 focus:ring-[#4d81d2] focus:border-transparent'
                    }`}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Test Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  placeholder="Instructions for the final test"
                  value={finalExam.description || ''}
                  onChange={e => {
                    setFinalExam({ ...finalExam, description: e.target.value });
                    if (validationErrors.length > 0) setValidationErrors([]);
                  }}
                  rows={3}
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-all resize-none bg-white ${
                    validationErrors.some(error => error.includes('Final test: Test Description')) 
                      ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                      : 'border-gray-300 focus:ring-[#4d81d2] focus:border-transparent'
                  }`}
                />
              </div>
            </div>

            {/* Question Bank */}
            <div className="bg-gray-50 rounded-lg border-2 border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-800">Question Bank</h3>
                <button
                  onClick={() => {
                    setQuestionBank([...questionBank, {
                      question: '',
                      questionImage: '',
                      questionImageFile: null,
                      questionImagePreview: null,
                      allowMultiple: false,
                      options: [{ label: '', image: '', imageFile: null, imagePreview: null }],
                      correctAnswer: { label: '', image: '', imageFile: null, imagePreview: null },
                      correctAnswers: [],
                      correctAnswerIndex: undefined
                    }]);
                    if (validationErrors.length > 0) setValidationErrors([]);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-[#4d81d2] text-white rounded-lg hover:bg-[#3d71c2] transition-all"
                >
                  <Plus size={16} />
                  Add Question
                </button>
              </div>

              <div className="space-y-6">
                {questionBank.map((question, qIdx) => 
                  renderQuestionForm(
                    question,
                    qIdx,
                    (updatedQuestion) => {
                      const newQuestionBank = [...questionBank];
                      newQuestionBank[qIdx] = updatedQuestion;
                      setQuestionBank(newQuestionBank);
                    },
                    () => {
                      setQuestionBank(questionBank.filter((_, i) => i !== qIdx));
                    }
                  )
                )}

                {questionBank.length === 0 && (
                  <div className="text-center py-8 text-gray-500 bg-white rounded-lg border border-dashed border-gray-300">
                    <p>No questions added yet. Click "Add Question" to get started.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      case 6: // Publish step
        return (
          <div className="space-y-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Review & Publish</h2>
              <p className="text-gray-600 mb-8">
                Review your course content and choose to save as draft or publish it.
              </p>
            </div>

            {/* Course Summary */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Course Summary</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Course Title</p>
                  <p className="font-medium text-gray-800">{course.title}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Sections</p>
                  <p className="font-medium text-gray-800">{sections.length}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Chapters</p>
                  <p className="font-medium text-gray-800">
                    {sections.reduce((total, section) => total + section.chapters.length, 0)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Slides</p>
                  <p className="font-medium text-gray-800">
                    {sections.reduce((total, section) => 
                      total + section.chapters.reduce((chapterTotal, chapter) => 
                        chapterTotal + chapter.slides.length, 0), 0)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Pre-Test Questions</p>
                  <p className="font-medium text-gray-800">{preTest.questionToBeAnswered}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Final Test Questions</p>
                  <p className="font-medium text-gray-800">{finalTest.questionToBeAnswered}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Final Exam Questions</p>
                  <p className="font-medium text-gray-800">{finalExam.questionToBeAnswered}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Question Bank Size</p>
                  <p className="font-medium text-gray-800">{questionBank.length} questions</p>
                </div>
              </div>
            </div>

            {/* Validation Errors */}
            {validationErrors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h4 className="text-red-800 font-semibold mb-2">Please fix the following issues:</h4>
                <ul className="text-red-700 text-sm space-y-1">
                  {validationErrors.map((error, idx) => (
                    <li key={idx}>• {error}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Debug Validation Status */}
            {!canPublish() && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="text-yellow-800 font-semibold mb-2">Validation Status (Debug Info):</h4>
                <div className="text-yellow-700 text-sm space-y-2">
                  {steps.slice(0, -1).map((step, idx) => {
                    const validation = validateStep(idx);
                    return (
                      <div key={idx} className={`flex items-center gap-2 ${validation.isValid ? 'text-green-700' : 'text-red-700'}`}>
                        <span>{validation.isValid ? '✅' : '❌'}</span>
                        <span>Step {idx + 1} ({step}): {validation.isValid ? 'Valid' : `${validation.errors.length} errors`}</span>
                      </div>
                    );
                  })}
                  <div className="mt-2 pt-2 border-t border-yellow-300">
                    <strong>Activity Slide Requirements:</strong>
                    {sections.map((section, sIdx) => 
                      section.chapters.map((chapter, cIdx) => {
                        const slideCount = chapter.slides.length;
                        const activityAt = chapter.activityAt;
                        const minRequiredSlides = activityAt > 0 ? activityAt - 1 : 0;
                        const isValid = activityAt === 0 || slideCount >= minRequiredSlides;
                        return (
                          <div key={`${sIdx}-${cIdx}`} className={`flex items-center gap-2 text-xs mt-1 ${isValid ? 'text-green-700' : 'text-red-700'}`}>
                            <span>{isValid ? '✅' : '❌'}</span>
                            <span>
                              Chapter "{chapter.title || `Chapter ${cIdx + 1}`}": 
                              {activityAt > 0 ? ` needs ${minRequiredSlides} slides + activity at ${activityAt}, has ${slideCount}` : ' no activity required'}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col items-center gap-4">
              {showNotifyButton && (
                <div className="w-full max-w-xl rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  You have unpublished changes for learners. Send a push notification when you are ready.
                </div>
              )}
              <div className="flex justify-center gap-4 flex-wrap">
              {showNotifyButton && (
                <button
                  onClick={handleNotifyUsers}
                  disabled={isNotifying || isDraftSaving || isPublishing}
                  className={`px-8 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${
                    isNotifying
                      ? 'bg-amber-300 text-amber-800 cursor-not-allowed'
                      : 'bg-amber-500 hover:bg-amber-600 text-white'
                  }`}
                >
                  <Bell size={18} />
                  {isNotifying ? 'Sending...' : notifyButtonLabel}
                </button>
              )}
              <button
                onClick={() => handleSaveDraft()}
                disabled={isDraftSaving || isPublishing}
                className={`px-8 py-3 rounded-lg font-medium transition-all ${
                  isDraftSaving || isPublishing
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-gray-600 hover:bg-gray-700 text-white'
                }`}
              >
                {isDraftSaving ? 'Saving Draft...' : 'Save as Draft'}
              </button>
              <button
                onClick={() => handlePublish(false)}
                disabled={isDraftSaving || isPublishing || !canPublish()}
                className={`px-8 py-3 rounded-lg font-medium transition-all ${
                  canPublish() && !isDraftSaving && !isPublishing
                    ? 'bg-gradient-to-r from-[#4d81d2] to-[#5c94e8] hover:from-[#4069c2] hover:to-[#4b7dd8] text-white'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
                title={!canPublish() ? 'Please complete all required fields to publish' : ''}
              >
                {isPublishing ? 'Publishing...' : courseToEdit ? 'Update Course' : 'Publish Course'}
              </button>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <>
      {/* Loading overlay */}
      {(isDraftSaving || isPublishing || isUploading) && (
        <CourseLoader
          operation={
            isDraftSaving ? 'saving' : 
            isPublishing ? 'processing' : 
            'uploading'
          }
          fileType={uploadingFile?.type}
          fileName={
            isDraftSaving || isPublishing ? course.title : 
            uploadingFile?.name
          }
          stage={
            isDraftSaving ? 'Saving draft...' : 
            isPublishing ? 'Publishing course...' : 
            `Uploading ${uploadingFile?.type || 'file'}...`
          }
        />
      )}
      
      {/* Draft Restore Modal */}
      <DraftRestoreModal
        isOpen={showDraftModal}
        onClose={() => setShowDraftModal(false)}
        onRestore={handleRestoreDraft}
        onDiscard={handleDiscardDraft}
        timestamp={(savedDataForRestore?.timestamp as number) || 0}
      />
      
      <div className={isModal ? "" : "min-h-screen bg-gradient-to-br from-gray-50 to-gray-100"}>
        <div className={isModal ? "" : "space-y-2 py-2 px-4"}>
        {!isModal && (
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-800 mb-2">
                {courseToEdit ? `Edit Course: ${courseToEdit.title}` : "Create New Course"}
              </h1>
              <p className="text-gray-600">
                {courseToEdit ? "Modify your course content and settings" : "Build your course step by step"}
              </p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm p-6 mb-6 border border-gray-200">
          <div className="flex items-center justify-between gap-2 overflow-x-auto pb-2">
            {steps.map((step, idx) => {
              const canAccess = idx <= activeStep || (() => {
                for (let i = activeStep; i < idx; i++) {
                  const validation = validateStep(i);
                  if (!validation.isValid) return false;
                }
                return true;
              })();
              
              return (
                <div key={step} className="flex items-center flex-shrink-0 mr-4">
                  <button
                    onClick={() => goToStep(idx)}
                    disabled={!canAccess && idx > activeStep}
                    className={`relative px-5 py-2.5 rounded-lg font-semibold transition-all ${
                      idx === activeStep
                        ? "bg-[#4d81d2] text-white shadow-md scale-105"
                        : idx < activeStep
                        ? "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        : canAccess
                        ? "bg-white text-gray-500 border border-gray-300 hover:border-gray-400"
                        : "bg-gray-50 text-gray-400 border border-gray-200 cursor-not-allowed opacity-60"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${
                        idx === activeStep
                          ? "bg-white/20"
                          : idx < activeStep
                          ? "bg-[#4d81d2] text-white"
                          : canAccess
                          ? "bg-gray-200 text-gray-500"
                          : "bg-gray-100 text-gray-400"
                      }`}>
                        {idx < activeStep ? "✓" : idx + 1}
                      </span>
                      {step}
                    </span>
                  </button>
                  {idx < steps.length - 1 && (
                    <ChevronRight className="mx-1 text-gray-400" size={20} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b border-gray-200 pb-4">
              {steps[activeStep]}
            </h2>
            <div className="min-h-[400px]">
              {validationErrors.length > 0 && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <X className="h-5 w-5 text-red-400" />
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800">
                        Please fix the following errors to continue:
                      </h3>
                      <div className="mt-2 text-sm text-red-700">
                        <ul className="list-disc space-y-1 pl-5">
                          {validationErrors.map((error, idx) => (
                            <li key={idx}>{error}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    <div className="ml-auto pl-3">
                      <button
                        onClick={() => setValidationErrors([])}
                        className="inline-flex rounded-md bg-red-50 p-1.5 text-red-500 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 focus:ring-offset-red-50"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {renderStep()}
            </div>
          </div>

          <div className="bg-gray-50 px-8 py-6 border-t border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={prevStep}
                disabled={activeStep === 0}
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-700 font-medium hover:bg-gray-50 hover:border-gray-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white"
              >
                <ChevronLeft size={18} />
                Back
              </button>
              <div className="text-sm text-gray-600 font-medium">
                Step {activeStep + 1} of {steps.length}
              </div>
              {activeStep === steps.length - 1 ? (
                <div className="text-sm text-gray-500 font-medium px-6 py-2.5">
                  Final Step
                </div>
              ) : (
                <button
                  onClick={nextStep}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#4d81d2] text-white font-medium hover:bg-[#3d71c2] transition-all"
                >
                  Next
                  <ChevronRight size={18} />
                </button>
              )}
            </div>
          </div>
        </div>
        </div>
      </div>
    </>
  );
};

export default NewCoursePage;