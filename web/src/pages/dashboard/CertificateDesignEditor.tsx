import React, { useState, useRef, useEffect, useCallback } from "react";
import ReactDOM from "react-dom";
import {
  Canvas as FabricCanvas,
  IText,
  Textbox,
  FabricImage,
  type FabricObject,
} from "fabric";
import {
  Plus,
  Search,
  ZoomIn,
  ZoomOut,
  Type,
  Image as ImageIcon,
  Calendar,
  Hash,
  BookOpen,
  BarChart2,
  Clock,
  User,
  GraduationCap,
  ArrowLeft,
  Undo2,
  Redo2,
  Trash2,
  Copy,
  FileText,
  QrCode,
  Loader2,
  Check,
  X,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from "lucide-react";
import { HexColorPicker } from "react-colorful";
import { Ruler, RULER_THICKNESS } from "@/components/certificate/Ruler";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  listCertificateTemplates,
  getCertificateTemplate,
  createCertificateTemplate,
  updateCertificateTemplate,
  deleteCertificateTemplate,
  getLinkedCourses,
  linkTemplateToCourse,
  unlinkTemplateFromCourse,
  previewCertificateTemplate,
  listBgImages,
  uploadBgImage,
  deleteBgImage,
  getMockTokenValues,
  type CertificateTemplateSummary,
  type LinkedCourse,
} from "@/services/certificateTemplate.service";
import { renderCertificateFromCanvas } from "@/utils/renderCertificate";
import { getAllCoursesNoPagination } from "@/services/course.service";
import type { ICourse } from "@/types";

// ── Constants ─────────────────────────────────────────────────────────────────

const CANVAS_WIDTH  = 1056; // 11in @ 96 dpi — landscape
const CANVAS_HEIGHT = 816;  // 8.5in @ 96 dpi

const FONT_FAMILIES = [
  "Arial", "Helvetica", "Georgia", "Times New Roman",
  "Courier New", "Verdana", "Trebuchet MS", "Impact",
  "Comic Sans MS", "Palatino Linotype", "Garamond",
];

// ── Toolbar helpers ───────────────────────────────────────────────────────────

const TbDivider = () => (
  <div style={{ width: 1, height: 20, background: "#e5e7eb", margin: "0 2px", flexShrink: 0 }} />
);

const TbBtn = ({
  children, active, title, onMouseDown,
}: {
  children: React.ReactNode;
  active?: boolean;
  title?: string;
  onMouseDown: () => void;
}) => (
  <button
    onMouseDown={e => { e.preventDefault(); onMouseDown(); }}
    title={title}
    style={{
      width: 28, height: 28,
      display: "flex", alignItems: "center", justifyContent: "center",
      borderRadius: 4, border: "none",
      background: active ? "#e0e7ff" : "transparent",
      color: active ? "#4338ca" : "#374151",
      cursor: "pointer", flexShrink: 0,
    }}
  >
    {children}
  </button>
);

function makeQrPlaceholderSvg(): string {
  const c = 10; // px per module; 21 modules → 210px square
  const finder = (x: number, y: number) =>
    `<rect x="${x}" y="${y}" width="${7*c}" height="${7*c}" fill="#111"/>` +
    `<rect x="${x+c}" y="${y+c}" width="${5*c}" height="${5*c}" fill="white"/>` +
    `<rect x="${x+2*c}" y="${y+2*c}" width="${3*c}" height="${3*c}" fill="#111"/>`;
  // scattered data modules to make it look like a real QR code
  const data: [number, number][] = [
    [8,0],[10,0],[12,0],[9,1],[13,1],[8,2],[11,2],[9,3],[12,3],[10,4],[13,4],[8,5],[11,5],
    [8,6],[10,6],[12,6], // timing row
    [6,8],[6,10],[6,12], // timing col
    // alignment pattern (bottom-right)
    [14,14],[15,14],[16,14],[17,14],[18,14],
    [14,15],[18,15],[14,16],[16,16],[18,16],[14,17],[18,17],
    [14,18],[15,18],[16,18],[17,18],[18,18],
    // data scatter
    [8,8],[10,8],[14,8],[17,8],[20,8],
    [9,9],[12,9],[16,9],[19,9],
    [8,10],[11,10],[15,10],[18,10],[20,10],
    [10,11],[13,11],[17,11],
    [9,12],[12,12],[16,12],[20,12],
    [8,13],[11,13],[14,13],[19,13],[20,13],
    [8,15],[12,15],[20,15],[9,16],[13,16],[20,16],
    [8,17],[10,17],[15,17],[17,17],[20,17],
    [9,18],[12,18],[19,18],[8,19],[11,19],[13,19],[18,19],[20,19],
    [9,20],[10,20],[12,20],[15,20],[17,20],[19,20],
  ];
  const rects = data
    .map(([col, row]) => `<rect x="${col*c}" y="${row*c}" width="${c}" height="${c}" fill="#111"/>`)
    .join("");
  const size = 21 * c;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="white"/>${finder(0, 0)}${finder(14*c, 0)}${finder(0, 14*c)}${rects}</svg>`;
}

const ELEMENT_SECTIONS = [
  {
    label: "CERTIFICATE",
    items: [
      { key: "text",      label: "Text",             icon: Type       },
      { key: "image",     label: "Image",            icon: ImageIcon  },
      { key: "cert-code", label: "Certificate code", icon: Hash       },
      { key: "qr",        label: "QR code",          icon: QrCode     },
      { key: "date",      label: "Current Date",     icon: Calendar   },
    ],
  },
  {
    label: "COURSE",
    items: [
      { key: "course-name", label: "Course name",     icon: BookOpen  },
      { key: "details",     label: "Details",         icon: FileText  },
      { key: "progress",    label: "Progress",        icon: BarChart2 },
      { key: "duration",    label: "Course Duration", icon: Clock     },
      { key: "start-date",  label: "Start Date",      icon: Calendar  },
      { key: "end-date",    label: "End Date",        icon: Calendar  },
    ],
  },
  {
    label: "STUDENT",
    items: [
      { key: "student-name", label: "Student name", icon: User },
      { key: "student-code", label: "Student code", icon: Hash },
    ],
  },
  {
    label: "INSTRUCTOR",
    items: [
      { key: "instructor-name", label: "Instructor name", icon: GraduationCap },
    ],
  },
];

const DISPLAY_LABEL: Record<string, string> = {
  "cert-code":       "Certificate Code",
  "date":            "Current Date",
  "course-name":     "-Course name-",
  "details":         "-Details-",
  "progress":        "-Progress-",
  "duration":        "-Duration-",
  "start-date":      "-Start Date-",
  "end-date":        "-End Date-",
  "student-name":    "-Student name-",
  "student-code":    "-Student code-",
  "instructor-name": "-Instructor name-",
};

const TOKEN_VALUE: Record<string, string> = {
  "cert-code":       "{{certificateCode}}",
  "date":            "{{currentDate}}",
  "course-name":     "{{courseName}}",
  "details":         "{{courseDetails}}",
  "progress":        "{{progress}}",
  "duration":        "{{courseDuration}}",
  "start-date":      "{{startDate}}",
  "end-date":        "{{endDate}}",
  "student-name":    "{{studentName}}",
  "student-code":    "{{studentCode}}",
  "instructor-name": "{{instructorName}}",
};


function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : null;
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("")}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

const CertificateDesignEditor: React.FC = () => {
  const navigate      = useNavigate();
  const { id: routeId } = useParams<{ id: string }>();
  const canvasElRef      = useRef<HTMLCanvasElement>(null);
  const fabricRef        = useRef<FabricCanvas | null>(null);
  const fileInputRef     = useRef<HTMLInputElement>(null);
  const bgFileInputRef   = useRef<HTMLInputElement>(null);
  const scrollRef        = useRef<HTMLDivElement>(null);
  const canvasWrapperRef = useRef<HTMLDivElement>(null);

  // Refs for history — avoids stale-closure issues in fabric event handlers
  const historyRef    = useRef<string[]>([]);
  const historyIdxRef = useRef(-1);
  const historyLock   = useRef(false);

  // Zoom ref mirrors zoom state so async callbacks always see current value
  const zoomRef = useRef(75);

  // When we auto-create a template and navigate to its URL, skip the loadTemplate
  // effect for that ID so the canvas isn't wiped before the element is added.
  const justCreatedIdRef = useRef<string | null>(null);

  // ── UI state ─────────────────────────────────────────────────────────────────

  const [activeTab,      setActiveTab]      = useState<"certificates" | "link-certificates">("certificates");
  const [rightTab,       setRightTab]       = useState<"elements" | "backgrounds">("elements");
  const [searchQuery,    setSearchQuery]    = useState("");
  const [zoom,           setZoom]           = useState(75);

  // Ruler state
  const [canvasStartX, setCanvasStartX] = useState(0);
  const [canvasStartY, setCanvasStartY] = useState(0);
  const [scrollX,      setScrollX]      = useState(0);
  const [scrollY,      setScrollY]      = useState(0);
  const [mouseX,       setMouseX]       = useState<number | undefined>(undefined);
  const [mouseY,       setMouseY]       = useState<number | undefined>(undefined);

  // Guide lines
  type Guide = { id: string; orientation: "h" | "v"; position: number };
  const [guides,     setGuides]     = useState<Guide[]>([]);
  const [dragGuide,  setDragGuide]  = useState<{ orientation: "h" | "v"; position: number; existingId?: string } | null>(null);

  // Template management
  const [templates,       setTemplates]       = useState<CertificateTemplateSummary[]>([]);
  const [templateId,      setTemplateId]      = useState<string | null>(null);
  const [templateName,    setTemplateName]    = useState("");
  const [isLoadingTpls,   setIsLoadingTpls]   = useState(true);
  const [isLoadingCanvas, setIsLoadingCanvas] = useState(false);
  const [isSaving,        setIsSaving]        = useState(false);
  const [savedTick,       setSavedTick]       = useState(0);
  const [canvasReady,     setCanvasReady]     = useState(false);

  // New template modal
  const [showNewModal,    setShowNewModal]    = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [isCreating,      setIsCreating]      = useState(false);

  // Delete confirmation
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDeleting,      setIsDeleting]      = useState(false);

  // Inline rename in sidebar
  const [editingId,   setEditingId]   = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  // Mock certificate generation
  const [isGeneratingMock, setIsGeneratingMock] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);

  const [recentBgImages, setRecentBgImages] = useState<{ id: string; url: string }[]>([]);

  // Background color picker
  const [pickerColor, setPickerColor] = useState("#ffffff");
  const [hexDraft,    setHexDraft]    = useState("ffffff");
  const hexFocused = useRef(false);

  // Link Certificates tab
  const [allCourses,       setAllCourses]       = useState<ICourse[]>([]);
  const [courseTemplateMap, setCourseTemplateMap] = useState<Record<string, { id: string; name: string } | null>>({});
  const [isLinkLoading,    setIsLinkLoading]    = useState(false);
  const [linkModalCourse,  setLinkModalCourse]  = useState<ICourse | null>(null);
  const [isLinkingSaving,  setIsLinkingSaving]  = useState(false);

  // Canvas-driven re-render trigger
  const [, setTick]          = useState(0);
  const bumpTick             = useCallback(() => setTick(n => n + 1), []);
  const [dirtyCount, setDirtyCount] = useState(0);

  // Selected fabric object
  const [selectedObj, setSelectedObj] = useState<FabricObject | null>(null);
  // Keeps the last non-null selection so toolbar onChange handlers (select/input)
  // can still reach the object even after focus-steal clears canvas selection.
  const lastSelectedRef = useRef<FabricObject | null>(null);

  // ── Zoom ──────────────────────────────────────────────────────────────────────

  const changeZoom = useCallback((next: number) => {
    const clamped = Math.max(25, Math.min(200, next));
    zoomRef.current = clamped;
    setZoom(clamped);
  }, []);

  // ── Custom-prop restore ───────────────────────────────────────────────────────
  // Fabric v7's loadFromJSON only restores known class properties; it drops
  // arbitrary custom props (token, tokenKey) that we set on IText objects.
  // Call this after every loadFromJSON to re-stamp them from the raw JSON.
  const reapplyCustomProps = useCallback((rawJson: unknown) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const objs = (rawJson as { objects?: Record<string, unknown>[] }).objects ?? [];
    canvas.getObjects().forEach((obj, i) => {
      const raw = objs[i];
      if (!raw) return;
      if (raw.token)    (obj as Record<string, unknown>).token    = raw.token;
      if (raw.tokenKey) (obj as Record<string, unknown>).tokenKey = raw.tokenKey;
    });
  }, []);

  // ── History ───────────────────────────────────────────────────────────────────

  const saveSnapshot = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas || historyLock.current) return;
    const json = JSON.stringify(canvas.toObject(["tokenKey", "token"]));
    const h = historyRef.current.slice(0, historyIdxRef.current + 1);
    h.push(json);
    historyRef.current    = h;
    historyIdxRef.current = h.length - 1;
    bumpTick();
    setDirtyCount(n => n + 1);
  }, [bumpTick]);

  const applySnapshot = useCallback(async (idx: number) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    historyLock.current = true;
    const parsed = JSON.parse(historyRef.current[idx]);
    await canvas.loadFromJSON(parsed);
    reapplyCustomProps(parsed);
    const scale = zoomRef.current / 100;
    canvas.setZoom(scale);
    canvas.setDimensions({ width: CANVAS_WIDTH * scale, height: CANVAS_HEIGHT * scale });
    canvas.renderAll();
    historyLock.current   = false;
    historyIdxRef.current = idx;
    setSelectedObj(null);
    bumpTick();
  }, [bumpTick, reapplyCustomProps]);

  const undo = useCallback(() => {
    if (historyIdxRef.current > 0) applySnapshot(historyIdxRef.current - 1);
  }, [applySnapshot]);

  const redo = useCallback(() => {
    if (historyIdxRef.current < historyRef.current.length - 1)
      applySnapshot(historyIdxRef.current + 1);
  }, [applySnapshot]);

  // ── Fabric init ───────────────────────────────────────────────────────────────

  useEffect(() => {
    const el = canvasElRef.current;
    if (!el || fabricRef.current) return;

    const scale  = zoomRef.current / 100;
    const canvas = new FabricCanvas(el, {
      width:                  CANVAS_WIDTH  * scale,
      height:                 CANVAS_HEIGHT * scale,
      backgroundColor:        "#ffffff",
      preserveObjectStacking: true,
    });
    canvas.setZoom(scale);
    fabricRef.current = canvas;

    const onSelectChange = () => {
      const active = canvas.getActiveObject() ?? null;
      if (active) lastSelectedRef.current = active;
      setSelectedObj(active);
      bumpTick();
    };
    canvas.on("selection:created", onSelectChange);
    canvas.on("selection:updated", onSelectChange);
    canvas.on("selection:cleared", () => { setSelectedObj(null); bumpTick(); });
    canvas.on("object:modified",   saveSnapshot);
    canvas.on("object:added",      saveSnapshot);
    canvas.on("object:removed",    saveSnapshot);

    historyRef.current    = [JSON.stringify(canvas.toObject())];
    historyIdxRef.current = 0;
    setCanvasReady(true);
    bumpTick();
    // Measure canvas position for rulers after first render
    requestAnimationFrame(() => updateCanvasStart());

    return () => {
      canvas.dispose();
      fabricRef.current = null;
      setCanvasReady(false);
    };
  }, [saveSnapshot, bumpTick]);

  // ── Sync zoom to canvas ───────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const scale = zoom / 100;
    canvas.setZoom(scale);
    canvas.setDimensions({ width: CANVAS_WIDTH * scale, height: CANVAS_HEIGHT * scale });
  }, [zoom]);

  // ── Fetch template list ───────────────────────────────────────────────────────

  useEffect(() => {
    setIsLoadingTpls(true);
    listCertificateTemplates()
      .then(setTemplates)
      .catch(() => { /* toast already shown by api interceptor */ })
      .finally(() => setIsLoadingTpls(false));
  }, []);

  // ── Fetch persisted background images ────────────────────────────────────────

  useEffect(() => {
    listBgImages()
      .then(imgs => setRecentBgImages(imgs.map(i => ({ id: i.id, url: i.url }))))
      .catch(() => {});
  }, []);

  // ── Load template from URL param ──────────────────────────────────────────────

  const loadTemplate = useCallback(async (id: string) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    setIsLoadingCanvas(true);
    try {
      const tpl = await getCertificateTemplate(id);
      historyLock.current = true;
      await canvas.loadFromJSON(tpl.canvasJson);
      reapplyCustomProps(tpl.canvasJson);
      const scale = zoomRef.current / 100;
      canvas.setZoom(scale);
      canvas.setDimensions({ width: CANVAS_WIDTH * scale, height: CANVAS_HEIGHT * scale });
      canvas.renderAll();
      historyLock.current = false;
      // Reset history so undo/redo starts fresh after load
      historyRef.current    = [JSON.stringify(canvas.toObject(["tokenKey", "token"]))];
      historyIdxRef.current = 0;
      setTemplateId(tpl.id);
      setTemplateName(tpl.name);
      setSelectedObj(null);
      setDirtyCount(0);
      // Sync bg color picker with loaded template background
      const loadedBg = (canvas.backgroundColor as string) || "#ffffff";
      const validBg = /^#[0-9a-fA-F]{6}$/.test(loadedBg) ? loadedBg : "#ffffff";
      setPickerColor(validBg);
      setHexDraft(validBg.replace("#", ""));
      bumpTick();
    } catch {
      // error shown by api interceptor
    } finally {
      setIsLoadingCanvas(false);
    }
  }, [bumpTick, reapplyCustomProps]);

  useEffect(() => {
    if (!canvasReady || !routeId) return;
    if (justCreatedIdRef.current === routeId) {
      justCreatedIdRef.current = null; // canvas already has the right content, skip reload
      return;
    }
    loadTemplate(routeId);
  }, [canvasReady, routeId, loadTemplate]);

  // ── Link-Certificates tab: load courses + current links ──────────────────────

  useEffect(() => {
    if (activeTab !== "link-certificates") return;
    let cancelled = false;
    setIsLinkLoading(true);
    (async () => {
      try {
        const [coursesRes, tpls] = await Promise.all([
          getAllCoursesNoPagination(),
          listCertificateTemplates(),
        ]);
        if (cancelled) return;
        setAllCourses((coursesRes.data as ICourse[]) ?? []);
        const linkedResults = await Promise.all(
          tpls.map(t => getLinkedCourses(t.id).then(courses => ({ tpl: t, courses })).catch(() => ({ tpl: t, courses: [] as LinkedCourse[] })))
        );
        if (cancelled) return;
        const map: Record<string, { id: string; name: string } | null> = {};
        linkedResults.forEach(({ tpl, courses }) => {
          courses.forEach(c => { map[c.id] = { id: tpl.id, name: tpl.name }; });
        });
        setCourseTemplateMap(map);
      } catch {
        // interceptor shows toast
      } finally {
        if (!cancelled) setIsLinkLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [activeTab]);

  // ── Auto-save (debounced 1.5 s after any canvas mutation) ────────────────────

  useEffect(() => {
    if (!templateId || dirtyCount === 0) return;
    const timer = setTimeout(async () => {
      const canvas = fabricRef.current;
      if (!canvas) return;
      const canvasJson = canvas.toObject(["tokenKey", "token"]);
      // Capture a small JPEG thumbnail at the current viewport size
      const thumbnail = canvas.toDataURL({ format: "jpeg", quality: 0.6 });
      setIsSaving(true);
      try {
        await updateCertificateTemplate(templateId, { canvasJson, thumbnail });
        setSavedTick(n => n + 1);
        // Refresh the sidebar card immediately without a round-trip
        setTemplates(prev =>
          prev.map(t => t.id === templateId ? { ...t, thumbnail } : t)
        );
      } catch {
        // interceptor shows toast
      } finally {
        setIsSaving(false);
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [dirtyCount, templateId]);

  // ── Rename template (on blur / Enter) ────────────────────────────────────────

  const handleRenameTemplate = useCallback(async () => {
    if (!templateId || !templateName.trim()) return;
    const trimmed = templateName.trim();
    try {
      await updateCertificateTemplate(templateId, { name: trimmed });
      setTemplates(prev => prev.map(t => t.id === templateId ? { ...t, name: trimmed } : t));
    } catch {
      // interceptor shows toast
    }
  }, [templateId, templateName]);

  // ── Create new template ───────────────────────────────────────────────────────

  const handleCreateTemplate = useCallback(async () => {
    if (!newTemplateName.trim()) return;
    setIsCreating(true);
    try {
      const tpl = await createCertificateTemplate(newTemplateName.trim());
      setTemplates(prev => [tpl, ...prev]);
      setShowNewModal(false);
      setNewTemplateName("");
      navigate(`/certificates/design/${tpl.id}`);
    } catch {
      // interceptor shows toast
    } finally {
      setIsCreating(false);
    }
  }, [newTemplateName, navigate]);

  // ── Delete template ───────────────────────────────────────────────────────────

  const handleDeleteTemplate = useCallback(async (id: string) => {
    setIsDeleting(true);
    try {
      await deleteCertificateTemplate(id);
      setTemplates(prev => prev.filter(t => t.id !== id));
      setConfirmDeleteId(null);
      if (id === templateId) {
        // Clear canvas and navigate away
        const canvas = fabricRef.current;
        if (canvas) {
          historyLock.current = true;
          canvas.clear();
          canvas.backgroundColor = "#ffffff";
          canvas.renderAll();
          historyLock.current = false;
          historyRef.current    = [JSON.stringify(canvas.toObject())];
          historyIdxRef.current = 0;
        }
        setTemplateId(null);
        setTemplateName("");
        setSelectedObj(null);
        navigate("/certificates/design");
      }
    } catch {
      // interceptor shows toast
    } finally {
      setIsDeleting(false);
    }
  }, [templateId, navigate]);

  // ── Create blank template (from the "Create blank" card in the sidebar) ─────

  const handleCreateBlankTemplate = useCallback(async () => {
    setIsCreating(true);
    try {
      const tpl = await createCertificateTemplate("Untitled");
      setTemplates(prev => [tpl, ...prev]);
      navigate(`/certificates/design/${tpl.id}`);
    } catch {
      // interceptor shows toast
    } finally {
      setIsCreating(false);
    }
  }, [navigate]);

  // ── Rename template from sidebar (inline double-click) ───────────────────────

  const handleSidebarRename = useCallback(async (id: string, name: string) => {
    const trimmed = name.trim();
    setEditingId(null);
    if (!trimmed) return;
    try {
      await updateCertificateTemplate(id, { name: trimmed });
      setTemplates(prev => prev.map(t => t.id === id ? { ...t, name: trimmed } : t));
      if (id === templateId) setTemplateName(trimmed);
    } catch {
      // interceptor shows toast
    }
  }, [templateId]);

  // ── Add elements ──────────────────────────────────────────────────────────────

  const addElement = useCallback(async (key: string) => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    // Auto-create "Untitled" template if none is active yet
    if (!templateId) {
      try {
        const tpl = await createCertificateTemplate("Untitled");
        justCreatedIdRef.current = tpl.id; // prevent loadTemplate from wiping canvas
        setTemplates(prev => [tpl, ...prev]);
        setTemplateId(tpl.id);
        setTemplateName(tpl.name);
        navigate(`/certificates/design/${tpl.id}`, { replace: true });
      } catch {
        toast.error("Could not create template");
        return;
      }
    }

    if (key === "image") { fileInputRef.current?.click(); return; }

    if (key === "qr") {
      const svg = makeQrPlaceholderSvg();
      const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      FabricImage.fromURL(dataUrl).then((img) => {
        img.scaleToWidth(100);
        img.set({ left: 300, top: 300 });
        (img as Record<string, unknown>).tokenKey = "qr";
        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.renderAll();
      });
      return;
    }

    const content = key === "text" ? "New text" : (DISPLAY_LABEL[key] ?? "New text");
    const token   = TOKEN_VALUE[key];
    const isToken = !!token;

    const t = new Textbox(content, {
      left:       300,
      top:        300,
      width:      400,
      fontSize:   key === "text" ? 20 : 22,
      fill:       "#334155",
      fontFamily: "Arial",
      textAlign:  "center",
      fontStyle:  isToken ? "italic" : "normal",
    });
    if (token)   (t as Record<string, unknown>).token    = token;
    if (isToken) (t as Record<string, unknown>).tokenKey = key;

    canvas.add(t);
    canvas.setActiveObject(t);
    canvas.renderAll();
  }, [templateId, navigate]);

  // ── Image upload ──────────────────────────────────────────────────────────────

  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const canvas = fabricRef.current;
    if (!canvas) return;
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    // Normalize to PNG so pdf-lib can always embed it (it only supports PNG & JPEG).
    // Browsers can decode any format they support (WebP, AVIF, GIF…), so we draw
    // the image to an off-screen canvas and export as PNG once at upload time.
    const normalizedUrl = await new Promise<string>((resolve) => {
      if (dataUrl.startsWith("data:image/png") || dataUrl.startsWith("data:image/jpeg")) {
        resolve(dataUrl);
        return;
      }
      const htmlImg = new Image();
      htmlImg.onload = () => {
        const off = document.createElement("canvas");
        off.width  = htmlImg.naturalWidth;
        off.height = htmlImg.naturalHeight;
        const ctx = off.getContext("2d");
        if (!ctx) { resolve(dataUrl); return; }
        ctx.drawImage(htmlImg, 0, 0);
        resolve(off.toDataURL("image/png"));
      };
      htmlImg.onerror = () => resolve(dataUrl);
      htmlImg.src = dataUrl;
    });
    const img = await FabricImage.fromURL(normalizedUrl);
    img.scaleToWidth(Math.min(300, CANVAS_WIDTH * 0.35));
    img.set({ left: 100, top: 100 });
    canvas.add(img);
    canvas.setActiveObject(img);
    canvas.renderAll();
    e.target.value = "";
  }, []);

  // ── Canvas operations ─────────────────────────────────────────────────────────

  const deleteSelected = useCallback(() => {
    const canvas = fabricRef.current;
    const obj    = canvas?.getActiveObject();
    if (!canvas || !obj) return;
    canvas.remove(obj);
    canvas.discardActiveObject();
    setSelectedObj(null);
    canvas.renderAll();
  }, []);

  const duplicateSelected = useCallback(async () => {
    const canvas = fabricRef.current;
    const obj    = canvas?.getActiveObject();
    if (!canvas || !obj) return;
    const cloned = await obj.clone();
    cloned.set({ left: (cloned.left ?? 0) + 20, top: (cloned.top ?? 0) + 20 });
    canvas.add(cloned);
    canvas.setActiveObject(cloned);
    canvas.renderAll();
  }, []);

  const updateSelected = useCallback((props: Record<string, unknown>) => {
    const canvas = fabricRef.current;
    const obj    = canvas?.getActiveObject() ?? lastSelectedRef.current;
    if (!canvas || !obj) return;
    (obj as Record<string, unknown> & { set: (p: Record<string, unknown>) => void }).set(props);
    // Recalculate text layout when font-related properties change
    if (obj instanceof IText) {
      (obj as unknown as { initDimensions: () => void }).initDimensions();
      obj.setCoords();
    }
    // Re-establish selection in case a toolbar input stole focus and cleared it
    canvas.setActiveObject(obj);
    canvas.renderAll();
    bumpTick();
    saveSnapshot();
  }, [bumpTick, saveSnapshot]);

  const applyBgColor = useCallback((color: string) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.backgroundImage = undefined;
    canvas.backgroundColor = color;
    canvas.renderAll();
  }, []);

  const setBackground = useCallback((color: string) => {
    applyBgColor(color);
    setPickerColor(color);
    if (!hexFocused.current) setHexDraft(color.replace("#", ""));
    saveSnapshot();
  }, [applyBgColor, saveSnapshot]);

  const applyBackgroundSrc = useCallback(async (src: string) => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const htmlImg = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      // Required to prevent canvas taint when loading from external URLs (Cloudinary)
      if (!src.startsWith("data:")) el.crossOrigin = "anonymous";
      el.onload  = () => resolve(el);
      el.onerror = reject;
      el.src = src;
    });

    const natW = htmlImg.naturalWidth  || CANVAS_WIDTH;
    const natH = htmlImg.naturalHeight || CANVAS_HEIGHT;

    const img = new FabricImage(htmlImg, {
      left:    CANVAS_WIDTH  / 2,
      top:     CANVAS_HEIGHT / 2,
      originX: "center" as const,
      originY: "center" as const,
      scaleX:  CANVAS_WIDTH  / natW,
      scaleY:  CANVAS_HEIGHT / natH,
      selectable: false,
      evented:    false,
    });

    canvas.backgroundImage = img;
    canvas.backgroundColor = "";
    canvas.renderAll();
    saveSnapshot();
  }, [saveSnapshot]);

  const handleBackgroundImageUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const canvas = fabricRef.current;
      if (!canvas) return;

      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload  = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Apply locally as data URL for instant feedback
      await applyBackgroundSrc(dataUrl);
      e.target.value = "";

      // Compress to JPEG ≤ 1280px before uploading to avoid large payloads
      const compressed = await new Promise<string>((resolve) => {
        const tmp = new Image();
        tmp.onload = () => {
          const MAX = 1280;
          const ratio = Math.min(1, MAX / Math.max(tmp.naturalWidth || 1, tmp.naturalHeight || 1));
          const off = document.createElement("canvas");
          off.width  = Math.round(tmp.naturalWidth  * ratio);
          off.height = Math.round(tmp.naturalHeight * ratio);
          const ctx = off.getContext("2d");
          if (!ctx) { resolve(dataUrl); return; }
          ctx.drawImage(tmp, 0, 0, off.width, off.height);
          resolve(off.toDataURL("image/jpeg", 0.85));
        };
        tmp.onerror = () => resolve(dataUrl);
        tmp.src = dataUrl;
      });

      // Upload to backend (Cloudinary) and prepend to persisted recent list
      try {
        const saved = await uploadBgImage(compressed);
        setRecentBgImages(prev => {
          const filtered = prev.filter(u => u.url !== saved.url);
          return [{ id: saved.id, url: saved.url }, ...filtered];
        });
      } catch {
        // upload failed — image is still visible on canvas, just not in recent list
      }
    },
    [applyBackgroundSrc],
  );

  // ── Generate Mock Certificate ─────────────────────────────────────────────────

  const generateMockCertificate = useCallback(async () => {
    const canvas = fabricRef.current;
    if (!canvas) { toast.error("Canvas not ready"); return; }
    setIsGeneratingMock(true);
    try {
      const { certId, tokenValues } = await getMockTokenValues();
      const canvasJson = canvas.toObject(["tokenKey", "token"]);
      const blobUrl = await renderCertificateFromCanvas(canvasJson, tokenValues, certId);
      setPreviewPdfUrl(blobUrl);
    } catch (err) {
      console.error("Mock certificate error:", err);
      toast.error("Failed to generate preview");
    } finally {
      setIsGeneratingMock(false);
    }
  }, []);

  // ── Link/change/unlink certificate for a course ──────────────────────────────

  const handleLinkCertificate = useCallback(async (course: ICourse, newTemplateId: string | null) => {
    if (isLinkingSaving) return;
    setIsLinkingSaving(true);
    try {
      const existing = courseTemplateMap[course.id];
      if (existing && existing.id !== newTemplateId) {
        await unlinkTemplateFromCourse(existing.id, course.id);
      }
      if (newTemplateId && newTemplateId !== existing?.id) {
        await linkTemplateToCourse(newTemplateId, course.id);
      }
      const tpl = newTemplateId ? templates.find(t => t.id === newTemplateId) : null;
      setCourseTemplateMap(prev => ({
        ...prev,
        [course.id]: tpl ? { id: tpl.id, name: tpl.name } : null,
      }));
      setLinkModalCourse(null);
      toast.success(newTemplateId ? "Certificate linked" : "Certificate unlinked");
    } catch {
      // interceptor shows toast
    } finally {
      setIsLinkingSaving(false);
    }
  }, [isLinkingSaving, courseTemplateMap, templates]);

  // ── Derived ───────────────────────────────────────────────────────────────────

  const filteredTemplates = templates.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const canUndo = historyIdxRef.current > 0;
  const canRedo = historyIdxRef.current < historyRef.current.length - 1;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sel        = selectedObj as any;
  const selLeft    = sel ? Math.round(sel.left  ?? 0) : 0;
  const selTop     = sel ? Math.round(sel.top   ?? 0) : 0;
  const selW       = sel ? Math.round((sel.width  ?? 0) * (sel.scaleX ?? 1)) : 0;
  const selH       = sel ? Math.round((sel.height ?? 0) * (sel.scaleY ?? 1)) : 0;
  const selIsText    = selectedObj instanceof IText;
  const selFontSz    = selIsText ? (sel.fontSize   ?? 20)        : 20;
  const selColor     = selIsText ? (sel.fill        ?? "#334155") : "#334155";
  const selBold      = selIsText && sel.fontWeight === "bold";
  const selItalic    = selIsText && sel.fontStyle  === "italic";
  const selAlign     = selIsText ? (sel.textAlign   ?? "center")  : "center";
  const selFontFamily = selIsText ? (sel.fontFamily ?? "Arial")   : "Arial";
  const selOpacity   = sel ? (sel.opacity ?? 1) : 1;

  // ── Guide drag ────────────────────────────────────────────────────────────────

  const isDraggingGuide   = dragGuide !== null;
  const dragOrientation   = dragGuide?.orientation;
  const dragExistingId    = dragGuide?.existingId;

  useEffect(() => {
    if (!isDraggingGuide) return;

    const toCanvasCoords = (clientX: number, clientY: number) => {
      const wr = canvasWrapperRef.current?.getBoundingClientRect();
      if (!wr) return { x: 0, y: 0 };
      const scale = zoomRef.current / 100;
      return { x: (clientX - wr.left) / scale, y: (clientY - wr.top) / scale };
    };

    const onMove = (e: MouseEvent) => {
      const { x, y } = toCanvasCoords(e.clientX, e.clientY);
      const pos = dragOrientation === "v" ? x : y;
      setDragGuide(prev => prev ? { ...prev, position: pos } : null);
    };

    const onUp = (e: MouseEvent) => {
      const { x, y } = toCanvasCoords(e.clientX, e.clientY);
      const inCanvas = x >= 0 && x <= CANVAS_WIDTH && y >= 0 && y <= CANVAS_HEIGHT;
      const pos      = dragOrientation === "v" ? x : y;

      if (inCanvas) {
        if (dragExistingId) {
          setGuides(gs => gs.map(g => g.id === dragExistingId ? { ...g, position: pos } : g));
        } else {
          setGuides(gs => [...gs, { id: crypto.randomUUID(), orientation: dragOrientation!, position: pos }]);
        }
      } else if (dragExistingId) {
        setGuides(gs => gs.filter(g => g.id !== dragExistingId));
      }
      setDragGuide(null);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",   onUp);
    };
  }, [isDraggingGuide, dragOrientation, dragExistingId]);

  // Override body cursor while dragging a guide
  useEffect(() => {
    if (!dragGuide) { document.body.style.cursor = ""; return; }
    document.body.style.cursor = dragGuide.orientation === "h" ? "ns-resize" : "ew-resize";
    return () => { document.body.style.cursor = ""; };
  }, [dragGuide?.orientation, dragGuide !== null]);

  // Keyboard shortcuts for selected canvas objects
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const canvas = fabricRef.current;
      if (!canvas) return;
      const active = canvas.getActiveObject();
      if (!active) return;
      // Don't intercept when typing in inputs or when fabric IText is in edit mode
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
      if (active instanceof IText && (active as unknown as { isEditing: boolean }).isEditing) return;
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key.toLowerCase() === "b") {
        e.preventDefault();
        const isBold = (active as Record<string, unknown>).fontWeight === "bold";
        updateSelected({ fontWeight: isBold ? "normal" : "bold" });
      } else if (ctrl && e.key.toLowerCase() === "i") {
        e.preventDefault();
        const isItalic = (active as Record<string, unknown>).fontStyle === "italic";
        updateSelected({ fontStyle: isItalic ? "normal" : "italic" });
      } else if (e.key === "Delete") {
        e.preventDefault();
        deleteSelected();
      } else if (e.key === "Escape") {
        canvas.discardActiveObject();
        canvas.renderAll();
        setSelectedObj(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [updateSelected, deleteSelected]);

  const startGuideFromRuler = useCallback((orientation: "h" | "v") => (e: React.MouseEvent) => {
    e.preventDefault();
    const wr = canvasWrapperRef.current?.getBoundingClientRect();
    if (!wr) return;
    const scale = zoomRef.current / 100;
    const pos   = orientation === "v"
      ? (e.clientX - wr.left) / scale
      : (e.clientY - wr.top)  / scale;
    setDragGuide({ orientation, position: pos });
  }, []);

  const startDragExistingGuide = useCallback((e: React.MouseEvent, guide: Guide) => {
    e.preventDefault();
    e.stopPropagation();
    setDragGuide({ orientation: guide.orientation, position: guide.position, existingId: guide.id });
  }, []);

  const deleteGuide = useCallback((id: string) => {
    setGuides(gs => gs.filter(g => g.id !== id));
  }, []);

  // ── Ruler helpers ─────────────────────────────────────────────────────────────

  const updateCanvasStart = useCallback(() => {
    const scroll  = scrollRef.current;
    const wrapper = canvasWrapperRef.current;
    if (!scroll || !wrapper) return;
    const sr = scroll.getBoundingClientRect();
    const wr = wrapper.getBoundingClientRect();
    setCanvasStartX(wr.left - sr.left + scroll.scrollLeft);
    setCanvasStartY(wr.top  - sr.top  + scroll.scrollTop);
  }, []);

  // Recompute canvas origin when zoom changes (canvas size changes → centering shifts)
  useEffect(() => {
    updateCanvasStart();
  }, [zoom, updateCanvasStart]);

  // Recompute on window resize
  useEffect(() => {
    window.addEventListener("resize", updateCanvasStart);
    return () => window.removeEventListener("resize", updateCanvasStart);
  }, [updateCanvasStart]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setScrollX(el.scrollLeft);
    setScrollY(el.scrollTop);
    updateCanvasStart();
  }, [updateCanvasStart]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setMouseX(e.clientX - rect.left);
    setMouseY(e.clientY - rect.top);
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden select-none">

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <header className="h-12 border-b border-gray-200 flex items-center px-4 gap-3 shrink-0 bg-white z-10">

        <button
          onClick={() => navigate("/certificates")}
          className="flex items-center gap-1.5 px-1.5 py-1 hover:bg-gray-100 rounded-md text-gray-600 transition-colors shrink-0"
          title="Back to Certificates"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-semibold whitespace-nowrap">Certificate Builder</span>
        </button>

        <div className="h-5 w-px bg-gray-200 shrink-0" />

        {/* Center tabs */}
        <div className="flex-1 flex items-center justify-center">
          {(["certificates", "link-certificates"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 h-12 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab === "certificates" ? "Certificates" : "Link Certificates"}
            </button>
          ))}
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={undo}
            disabled={!canUndo}
            className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-30 transition-colors"
            title="Undo"
          >
            <Undo2 className="w-4 h-4 text-gray-600" />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-30 transition-colors"
            title="Redo"
          >
            <Redo2 className="w-4 h-4 text-gray-600" />
          </button>

          {/* Auto-save indicator */}
          <div className="w-5 h-5 flex items-center justify-center">
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />
            ) : savedTick > 0 && templateId ? (
              <Check className="w-3.5 h-3.5 text-green-500" />
            ) : null}
          </div>

          <div className="h-5 w-px bg-gray-200 mx-1" />

          <button
            onClick={generateMockCertificate}
            disabled={isGeneratingMock}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 font-medium text-gray-700 transition-colors whitespace-nowrap disabled:opacity-50 flex items-center gap-1.5"
          >
            {isGeneratingMock && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Preview Certificate
          </button>

          {/* Zoom controls */}
          <div className="flex items-center border border-gray-200 rounded-md overflow-hidden ml-1">
            <button
              onClick={() => changeZoom(zoom - 10)}
              className="px-2 py-1.5 hover:bg-gray-100 transition-colors border-r border-gray-200"
            >
              <ZoomOut className="w-3.5 h-3.5 text-gray-600" />
            </button>
            <span className="px-3 text-xs font-medium text-gray-700 w-14 text-center">
              {zoom}%
            </span>
            <button
              onClick={() => changeZoom(zoom + 10)}
              className="px-2 py-1.5 hover:bg-gray-100 transition-colors border-l border-gray-200"
            >
              <ZoomIn className="w-3.5 h-3.5 text-gray-600" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">

        {/* Left — Template list */}
        <aside className="w-64 border-r border-gray-200 flex flex-col shrink-0 bg-white">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-700">
              Certificates{" "}
              {!isLoadingTpls && (
                <span className="text-gray-400 font-normal text-xs">
                  {templates.length}
                </span>
              )}
            </span>
            <button
              onClick={() => { setShowNewModal(true); setNewTemplateName(""); }}
              disabled={isCreating}
              className="p-1 hover:bg-gray-100 rounded-md text-gray-500 transition-colors disabled:opacity-40"
              title="New blank template"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="px-3 py-2 border-b border-gray-100">
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-md px-2 py-1.5">
              <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <input
                type="text"
                placeholder="Search certificates"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent text-xs text-gray-600 outline-none placeholder:text-gray-400"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {/* Create blank — always first */}
            <div className="group">
              <button
                onClick={() => { setShowNewModal(true); setNewTemplateName(""); }}
                disabled={isCreating}
                className="w-full text-left rounded-lg overflow-hidden border-2 border-dashed border-gray-200 hover:border-blue-400 transition-all disabled:opacity-50"
              >
                <div className="w-full aspect-[4/3] flex items-center justify-center bg-gray-50 group-hover:bg-blue-50/40 transition-colors rounded-t-md">
                  {isCreating ? (
                    <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
                  ) : (
                    <div className="flex flex-col items-center gap-1.5 text-gray-400 group-hover:text-blue-500 transition-colors">
                      <div className="w-9 h-9 rounded-full border-2 border-dashed border-current flex items-center justify-center">
                        <Plus className="w-4 h-4" />
                      </div>
                    </div>
                  )}
                </div>
                <div className="px-1.5 py-1.5">
                  <p className="text-xs font-medium text-gray-500 group-hover:text-blue-600 transition-colors">
                    Create blank
                  </p>
                </div>
              </button>
            </div>

            {isLoadingTpls ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
              </div>
            ) : filteredTemplates.length === 0 && !searchQuery ? null : filteredTemplates.length === 0 ? (
              <p className="text-center text-xs text-gray-400 py-4">No results</p>
            ) : (
              filteredTemplates.map(tmpl => (
                <div
                  key={tmpl.id}
                  className="group relative"
                >
                  {/* Thumbnail — click to navigate */}
                  <button
                    onClick={() => navigate(`/certificates/design/${tmpl.id}`)}
                    className={`w-full rounded-t-lg overflow-hidden border-2 transition-all ${
                      templateId === tmpl.id
                        ? "border-blue-500 shadow-sm"
                        : "border-transparent hover:border-gray-200"
                    }`}
                  >
                    <div className="w-full aspect-[4/3] bg-gray-50 border border-gray-100 rounded-t-md flex items-center justify-center p-3">
                      {tmpl.thumbnail ? (
                        <img
                          src={tmpl.thumbnail}
                          alt={tmpl.name}
                          className="w-full h-full object-contain rounded"
                        />
                      ) : (
                        <div className="w-full h-full bg-white border border-gray-200 rounded shadow-sm flex flex-col items-center justify-center gap-1">
                          <div className="h-1 w-8 bg-gray-200 rounded" />
                          <div className="h-1 w-12 bg-gray-300 rounded" />
                          <div className="h-1 w-10 bg-gray-200 rounded" />
                        </div>
                      )}
                    </div>
                  </button>

                  {/* Name row — double-click to rename */}
                  <div className="px-1.5 py-1.5">
                    {editingId === tmpl.id ? (
                      <input
                        autoFocus
                        value={editingName}
                        onChange={e => setEditingName(e.target.value)}
                        onBlur={() => handleSidebarRename(tmpl.id, editingName)}
                        onKeyDown={e => {
                          if (e.key === "Enter") e.currentTarget.blur();
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        className="w-full text-xs font-medium border border-blue-400 rounded px-1.5 py-0.5 focus:outline-none bg-white"
                      />
                    ) : (
                      <p
                        className="text-xs font-medium text-gray-700 truncate cursor-text select-none"
                        onDoubleClick={() => { setEditingId(tmpl.id); setEditingName(tmpl.name); }}
                        title="Double-click to rename"
                      >
                        {tmpl.name}
                      </p>
                    )}
                  </div>

                  {/* Delete button — visible on hover */}
                  <button
                    onClick={e => { e.stopPropagation(); setConfirmDeleteId(tmpl.id); }}
                    className="absolute top-1.5 right-1.5 p-1 bg-white rounded shadow-sm text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    title="Delete template"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Center — Canvas area */}
        <main className="flex-1 bg-[#e8e8e8] overflow-hidden flex flex-col">

          {/* Canvas tab — rulers + scrollable canvas (always mounted so Fabric keeps state) */}
          <div
            className="flex-1 flex flex-col overflow-hidden"
            style={{ display: activeTab === "certificates" ? "flex" : "none" }}
          >
            {/* Ruler row: corner + horizontal ruler */}
            <div className="flex shrink-0" style={{ height: RULER_THICKNESS }}>
              <div style={{
                width: RULER_THICKNESS, height: RULER_THICKNESS, flexShrink: 0,
                background: "#e8e8e8", borderRight: "1px solid #ddd", borderBottom: "1px solid #ddd",
              }} />
              <Ruler
                orientation="horizontal"
                canvasSize={CANVAS_WIDTH}
                zoom={zoom}
                canvasStart={canvasStartX}
                scrollOffset={scrollX}
                mousePos={mouseX}
                onMouseDown={startGuideFromRuler("h")}
              />
            </div>

            {/* Content row: vertical ruler + scrollable canvas */}
            <div className="flex flex-1 overflow-hidden">
              <Ruler
                orientation="vertical"
                canvasSize={CANVAS_HEIGHT}
                zoom={zoom}
                canvasStart={canvasStartY}
                scrollOffset={scrollY}
                mousePos={mouseY}
                onMouseDown={startGuideFromRuler("v")}
              />

              {/* Scrollable canvas viewport */}
              <div
                ref={scrollRef}
                className="flex-1 overflow-auto"
                onScroll={handleScroll}
                onMouseMove={handleMouseMove}
                onMouseLeave={() => { setMouseX(undefined); setMouseY(undefined); }}
                onClick={e => {
                  if (e.target === e.currentTarget) {
                    fabricRef.current?.discardActiveObject();
                    fabricRef.current?.renderAll();
                    setSelectedObj(null);
                  }
                }}
              >
                <div className="flex items-center justify-center p-12 min-h-full min-w-full">
                  <div
                    ref={canvasWrapperRef}
                    style={{
                      position: "relative",
                      boxShadow: "0 4px 32px rgba(0,0,0,0.18)",
                      lineHeight: 0,
                      flexShrink: 0,
                      overflow: "hidden",
                    }}
                  >
                    <canvas ref={canvasElRef} />

                    {/* ── Guide lines overlay ──────────────────────────────── */}
                    {(() => {
                      const scale = zoom / 100;
                      return (
                        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>

                          {/* Ghost line while dragging from ruler */}
                          {dragGuide && (
                            <div style={{
                              position: "absolute",
                              ...(dragGuide.orientation === "h"
                                ? { top: dragGuide.position * scale - 0.5, left: 0, right: 0, height: 1 }
                                : { left: dragGuide.position * scale - 0.5, top: 0, bottom: 0, width: 1 }),
                              background: "rgba(79,142,247,0.85)",
                              pointerEvents: "none",
                            }}>
                              {/* Position tooltip */}
                              <div style={{
                                position: "absolute",
                                ...(dragGuide.orientation === "h"
                                  ? { left: 4, top: 2 }
                                  : { top: 4, left: 2 }),
                                background: "#4f8ef7",
                                color: "#fff",
                                fontSize: 10,
                                padding: "1px 4px",
                                borderRadius: 3,
                                whiteSpace: "nowrap",
                                pointerEvents: "none",
                              }}>
                                {dragGuide.orientation === "h"
                                  ? `Y: ${Math.round(dragGuide.position)}px`
                                  : `X: ${Math.round(dragGuide.position)}px`}
                              </div>
                            </div>
                          )}

                          {/* Placed guides */}
                          {guides
                            .filter(g => g.id !== dragGuide?.existingId)
                            .map(guide => {
                              const pos = guide.position * scale;
                              const isH = guide.orientation === "h";
                              return (
                                <div
                                  key={guide.id}
                                  style={{
                                    position: "absolute",
                                    ...(isH
                                      ? { top: pos - 4, left: 0, right: 0, height: 8 }
                                      : { left: pos - 4, top: 0, bottom: 0, width: 8 }),
                                    cursor: isH ? "ns-resize" : "ew-resize",
                                    pointerEvents: "auto",
                                  }}
                                  onMouseDown={e => startDragExistingGuide(e, guide)}
                                  onDoubleClick={() => deleteGuide(guide.id)}
                                  title="Drag to move · Double-click to delete"
                                >
                                  {/* Visible line */}
                                  <div style={{
                                    position: "absolute",
                                    ...(isH
                                      ? { top: 3.5, left: 0, right: 0, height: 1 }
                                      : { left: 3.5, top: 0, bottom: 0, width: 1 }),
                                    background: "#4f8ef7",
                                  }} />
                                  {/* Position label at left/top edge */}
                                  <div style={{
                                    position: "absolute",
                                    ...(isH ? { left: 4, top: -14 } : { top: 4, left: 2 }),
                                    background: "#4f8ef7",
                                    color: "#fff",
                                    fontSize: 9,
                                    padding: "1px 3px",
                                    borderRadius: 2,
                                    whiteSpace: "nowrap",
                                    opacity: 0.85,
                                    pointerEvents: "none",
                                  }}>
                                    {isH ? `${Math.round(guide.position)}` : `${Math.round(guide.position)}`}
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      );
                    })()}

                    {isLoadingCanvas && (
                      <div
                        className="absolute inset-0 flex items-center justify-center bg-white/70"
                        style={{ pointerEvents: "none" }}
                      >
                        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {activeTab === "link-certificates" && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="p-4 border-b border-gray-200 shrink-0">
                <h2 className="text-sm font-semibold text-gray-800">Link Courses to Certificates</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Click a course to assign or change its certificate
                </p>
              </div>

              {isLinkLoading ? (
                <div className="flex-1 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                </div>
              ) : allCourses.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
                  No courses found
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto p-5">
                  <div className="grid grid-cols-3 gap-5">
                    {allCourses.map(course => {
                      const linked = courseTemplateMap[course.id];
                      const isThisTemplate = linked?.id === templateId;
                      return (
                        <button
                          key={course.id}
                          onClick={() => setLinkModalCourse(course)}
                          className={`text-left rounded-xl border overflow-hidden hover:shadow-md transition-all ${
                            isThisTemplate
                              ? "border-blue-400 bg-blue-50/30"
                              : linked
                                ? "border-green-300 bg-green-50/20"
                                : "border-gray-200 bg-white"
                          }`}
                        >
                          <div className="w-full h-52 bg-gray-100 overflow-hidden">
                            {course.coverIcon ? (
                              <img
                                src={course.coverIcon}
                                alt={course.title}
                                className="w-full h-full object-cover"
                                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
                                <BookOpen className="w-10 h-10 text-gray-300" />
                              </div>
                            )}
                          </div>
                          <div className="px-3 py-2.5">
                            <p className="text-sm font-semibold text-gray-800 line-clamp-1 leading-snug mb-2">
                              {course.title}
                            </p>
                            {linked ? (
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium max-w-full ${
                                isThisTemplate
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-green-100 text-green-700"
                              }`}>
                                <Check className="w-3 h-3 shrink-0" />
                                <span className="truncate">{linked.name}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs text-gray-400 bg-gray-100">
                                <Plus className="w-3 h-3" />
                                No certificate
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {!isLinkLoading && templateId && (() => {
                const count = Object.values(courseTemplateMap).filter(t => t?.id === templateId).length;
                return count > 0 ? (
                  <div className="px-4 py-2.5 border-t border-gray-200 bg-gray-50 shrink-0">
                    <p className="text-xs text-gray-500">
                      <span className="font-semibold text-blue-600">"{templateName}"</span>{" "}
                      linked to{" "}
                      <span className="font-semibold text-blue-600">{count}</span>{" "}
                      {count === 1 ? "course" : "courses"}
                    </p>
                  </div>
                ) : null;
              })()}
            </div>
          )}
        </main>

        {/* Right — Elements / Backgrounds + Properties */}
        <aside className="w-64 border-l border-gray-200 flex flex-col shrink-0 bg-white">

          {/* Tab header */}
          <div className="flex border-b border-gray-200 shrink-0">
            {(["elements", "backgrounds"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setRightTab(tab)}
                className={`flex-1 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize ${
                  rightTab === tab
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {/* Elements tab */}
          {rightTab === "elements" && (
            <div className="flex-1 overflow-y-auto">
              {ELEMENT_SECTIONS.map(section => (
                <div key={section.label}>
                  <p className="px-4 pt-4 pb-1 text-[10px] font-semibold text-gray-400 tracking-widest uppercase">
                    {section.label}
                  </p>
                  {section.items.map(item => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.key}
                        onClick={() => addElement(item.key)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left"
                      >
                        <Icon className="w-4 h-4 text-gray-500 shrink-0" />
                        <span className="text-sm text-gray-700">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}

          {/* Backgrounds tab */}
          {rightTab === "backgrounds" && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <p className="text-[10px] font-semibold text-gray-400 tracking-widest uppercase mb-3">
                  Background Color
                </p>
                {/* Gradient + hue picker */}
                <div
                  onPointerUp={() => saveSnapshot()}
                  className="[&_.react-colorful]:w-full [&_.react-colorful__saturation]:rounded-md [&_.react-colorful__hue]:rounded-md [&_.react-colorful__hue]:mt-2"
                >
                  <HexColorPicker
                    color={pickerColor}
                    onChange={c => {
                      setPickerColor(c);
                      if (!hexFocused.current) setHexDraft(c.replace("#", ""));
                      applyBgColor(c);
                    }}
                  />
                </div>
                {/* Hex input */}
                <div className="mt-3 flex items-center gap-1.5">
                  <span className="text-xs text-gray-400 font-mono">#</span>
                  <input
                    type="text"
                    maxLength={6}
                    value={hexDraft}
                    onFocus={() => { hexFocused.current = true; }}
                    onChange={e => {
                      const v = e.target.value.replace(/[^0-9a-fA-F]/g, "");
                      setHexDraft(v);
                      if (v.length === 6) {
                        const c = `#${v}`;
                        setPickerColor(c);
                        applyBgColor(c);
                      }
                    }}
                    onBlur={() => {
                      hexFocused.current = false;
                      if (hexDraft.length === 6) saveSnapshot();
                      else { setHexDraft(pickerColor.replace("#", "")); }
                    }}
                    onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }}
                    className="flex-1 px-2 py-1 text-xs font-mono border border-gray-200 rounded focus:outline-none focus:border-blue-400 uppercase"
                    placeholder="ffffff"
                  />
                </div>
                {/* RGB inputs */}
                {(() => {
                  const rgb = hexToRgb(pickerColor) ?? { r: 255, g: 255, b: 255 };
                  const setChannel = (channel: "r" | "g" | "b", val: number) => {
                    const next = { ...rgb, [channel]: Math.max(0, Math.min(255, val)) };
                    const c = rgbToHex(next.r, next.g, next.b);
                    setPickerColor(c);
                    setHexDraft(c.replace("#", ""));
                    applyBgColor(c);
                  };
                  return (
                    <div className="mt-2 grid grid-cols-3 gap-1.5">
                      {(["r", "g", "b"] as const).map(ch => (
                        <div key={ch} className="flex flex-col items-center gap-0.5">
                          <span className="text-[9px] font-semibold text-gray-400 uppercase">{ch}</span>
                          <input
                            type="number"
                            min={0}
                            max={255}
                            value={rgb[ch]}
                            onChange={e => setChannel(ch, Number(e.target.value))}
                            onBlur={() => saveSnapshot()}
                            className="w-full px-1.5 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:border-blue-400 text-center"
                          />
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
              <div>
                <p className="text-[10px] font-semibold text-gray-400 tracking-widest uppercase mb-2">
                  Background Image
                </p>
                <button
                  onClick={() => bgFileInputRef.current?.click()}
                  className="w-full py-3 border border-dashed border-gray-300 rounded-md text-sm text-gray-500 hover:bg-gray-50 transition-colors"
                >
                  + Upload image
                </button>
              </div>
              {recentBgImages.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 tracking-widest uppercase mb-2">
                    Recent Backgrounds
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {recentBgImages.map((item) => (
                      <div key={item.id} className="relative aspect-[4/3] group">
                        <button
                          onClick={() => applyBackgroundSrc(item.url)}
                          className="w-full h-full rounded-md overflow-hidden border border-gray-200 hover:border-blue-400 hover:shadow-sm transition-all"
                          title="Re-apply this background"
                        >
                          <img src={item.url} alt="" className="w-full h-full object-cover" />
                        </button>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            await deleteBgImage(item.id);
                            setRecentBgImages(prev => prev.filter(b => b.id !== item.id));
                          }}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                          title="Remove from recent"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Properties panel — shown when a canvas object is selected */}
          {selectedObj && (
            <div className="border-t border-gray-200 p-4 space-y-3 shrink-0 bg-white">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                  Properties
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={duplicateSelected}
                    className="p-1 hover:bg-gray-100 rounded text-gray-500 transition-colors"
                    title="Duplicate"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={deleteSelected}
                    className="p-1 hover:bg-red-50 rounded text-red-500 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Position */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] font-semibold text-gray-400 uppercase">X</label>
                  <input
                    type="number"
                    value={selLeft}
                    onChange={e => updateSelected({ left: Number(e.target.value) })}
                    className="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-semibold text-gray-400 uppercase">Y</label>
                  <input
                    type="number"
                    value={selTop}
                    onChange={e => updateSelected({ top: Number(e.target.value) })}
                    className="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-semibold text-gray-400 uppercase">W</label>
                  <input
                    type="number"
                    value={selW}
                    onChange={e => {
                      const w = (sel?.width ?? 1);
                      if (w > 0) updateSelected({ scaleX: Number(e.target.value) / w });
                    }}
                    className="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-semibold text-gray-400 uppercase">H</label>
                  <input
                    type="number"
                    value={selH}
                    onChange={e => {
                      const h = (sel?.height ?? 1);
                      if (h > 0) updateSelected({ scaleY: Number(e.target.value) / h });
                    }}
                    className="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:border-blue-400"
                  />
                </div>
              </div>

              {/* Text controls */}
              {selIsText && (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={8}
                    max={120}
                    value={selFontSz}
                    onChange={e => updateSelected({ fontSize: Number(e.target.value) })}
                    className="w-16 px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:border-blue-400"
                    title="Font size"
                  />
                  <input
                    type="color"
                    value={typeof selColor === "string" ? selColor : "#334155"}
                    onChange={e => updateSelected({ fill: e.target.value })}
                    className="w-8 h-7 rounded border border-gray-200 cursor-pointer"
                    title="Text color"
                  />
                  <button
                    onClick={() => updateSelected({ fontWeight: selBold ? "normal" : "bold" })}
                    className={`px-2 py-1 text-xs border rounded font-bold transition-colors ${
                      selBold
                        ? "bg-gray-800 text-white border-gray-800"
                        : "border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    B
                  </button>
                  <button
                    onClick={() =>
                      updateSelected({
                        textAlign:
                          selAlign === "center" ? "left"
                          : selAlign === "left"   ? "right"
                          : "center",
                      })
                    }
                    className="px-2 py-1 text-xs border border-gray-200 rounded text-gray-600 hover:bg-gray-50 transition-colors"
                    title="Toggle text align"
                  >
                    {selAlign === "left" ? "L" : selAlign === "right" ? "R" : "C"}
                  </button>
                </div>
              )}

              {/* Opacity */}
              <div>
                <label className="text-[9px] font-semibold text-gray-400 uppercase">
                  Opacity — {Math.round(selOpacity * 100)}%
                </label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={selOpacity}
                  onChange={e => updateSelected({ opacity: Number(e.target.value) })}
                  className="w-full accent-blue-600"
                />
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        className="hidden"
      />
      <input
        ref={bgFileInputRef}
        type="file"
        accept="image/*"
        onChange={handleBackgroundImageUpload}
        className="hidden"
      />

      {/* ── New Template Modal ───────────────────────────────────────────────── */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-80 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">New Certificate Template</h3>
              <button
                onClick={() => { setShowNewModal(false); setNewTemplateName(""); }}
                className="p-1 hover:bg-gray-100 rounded text-gray-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              autoFocus
              type="text"
              placeholder="Template name"
              value={newTemplateName}
              onChange={e => setNewTemplateName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleCreateTemplate(); }}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setShowNewModal(false); setNewTemplateName(""); }}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTemplate}
                disabled={!newTemplateName.trim() || isCreating}
                className="px-4 py-2 text-sm bg-primary text-white rounded-lg  transition-colors flex items-center gap-2"
              >
                {isCreating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ────────────────────────────────────────── */}
      {confirmDeleteId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-72 space-y-4 shadow-2xl">
            <h3 className="text-sm font-semibold text-gray-900">Delete Template?</h3>
            <p className="text-xs text-gray-500">
              {templates.find(t => t.id === confirmDeleteId)?.name
                ? `"${templates.find(t => t.id === confirmDeleteId)?.name}" will be permanently deleted.`
                : "This cannot be undone."
              }
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 transition-colors"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteTemplate(confirmDeleteId)}
                disabled={isDeleting}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Link Certificate Modal ───────────────────────────────────────────── */}
      {linkModalCourse && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-6" onClick={() => !isLinkingSaving && setLinkModalCourse(null)}>
          <div className="bg-white rounded-xl w-[720px] max-w-full shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-gray-900 truncate">Link Certificate</h3>
                <p className="text-xs text-gray-500 mt-0.5 truncate">{linkModalCourse.title}</p>
              </div>
              <button
                onClick={() => !isLinkingSaving && setLinkModalCourse(null)}
                className="ml-3 p-1 shrink-0 hover:bg-gray-100 rounded text-gray-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 max-h-[72vh] overflow-y-auto">
              {/* Remove link option */}
              {courseTemplateMap[linkModalCourse.id] && (
                <button
                  onClick={() => handleLinkCertificate(linkModalCourse, null)}
                  disabled={isLinkingSaving}
                  className="w-full mb-4 flex items-center gap-2 px-3 py-2 text-xs text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition disabled:opacity-50"
                >
                  <X className="w-3.5 h-3.5 shrink-0" />
                  Remove current certificate link
                </button>
              )}

              {/* Certificate template cards */}
              <div className="grid grid-cols-3 gap-3">
                {templates.map(tpl => {
                  const isLinked = courseTemplateMap[linkModalCourse.id]?.id === tpl.id;
                  return (
                    <button
                      key={tpl.id}
                      onClick={() => !isLinked && handleLinkCertificate(linkModalCourse, tpl.id)}
                      disabled={isLinkingSaving || isLinked}
                      className={`text-left rounded-xl border overflow-hidden transition-all disabled:cursor-default ${
                        isLinked
                          ? "border-blue-500 ring-2 ring-blue-400/40"
                          : "border-gray-200 hover:border-blue-300 hover:shadow-md"
                      }`}
                    >
                      <div className="w-full h-44 bg-gradient-to-br from-blue-50 to-indigo-100 overflow-hidden">
                        {tpl.thumbnail ? (
                          <img src={tpl.thumbnail} alt={tpl.name} className="w-full h-full object-cover object-top" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <FileText className="w-8 h-8 text-blue-200" />
                          </div>
                        )}
                      </div>
                      <div className="px-3 py-2.5 flex items-start gap-1.5">
                        {isLinked && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />}
                        <p className="text-sm font-medium text-gray-700 line-clamp-2 leading-snug">{tpl.name}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {templates.length === 0 && (
                <p className="text-sm text-center text-gray-400 py-6">No certificate templates yet</p>
              )}
            </div>

            {isLinkingSaving && (
              <div className="px-5 py-3 border-t border-gray-100 flex items-center gap-2 text-xs text-gray-500">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Saving…
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Mock Certificate Preview Modal ───────────────────────────────────── */}
      {previewPdfUrl && (
        <PreviewModal
          url={previewPdfUrl}
          fileName={`${templateName || "certificate"}-preview.pdf`}
          onClose={() => { URL.revokeObjectURL(previewPdfUrl); setPreviewPdfUrl(null); }}
        />
      )}

      {/* ── Floating text toolbar ──────────────────────────────────────────── */}
      {selIsText && selectedObj && activeTab === "certificates" && (() => {
        const scale = zoom / 100;
        const wr = canvasWrapperRef.current?.getBoundingClientRect();
        if (!wr) return null;

        const objLeft = (sel?.left   ?? 0) * scale;
        const objTop  = (sel?.top    ?? 0) * scale;
        const objH    = (sel?.height ?? 20) * (sel?.scaleY ?? 1) * scale;

        const TOOLBAR_H = 86;
        const GAP = 5;

        let fixedTop  = wr.top + objTop - TOOLBAR_H - GAP;
        let fixedLeft = wr.left + objLeft;
        if (fixedTop < 56) fixedTop = wr.top + objTop + objH + GAP;
        fixedLeft = Math.max(8, Math.min(fixedLeft, window.innerWidth - 520));

        return ReactDOM.createPortal(
          <div
            style={{ position: "fixed", left: fixedLeft, top: fixedTop, zIndex: 9999 }}
            onMouseDown={e => e.preventDefault()}
          >
            <div style={{
              display: "flex", flexDirection: "column", gap: 2,
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              padding: "5px 8px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.13)",
            }}>
              {/* Row 1: color · font family · font size */}
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <label style={{ position: "relative", width: 22, height: 22, cursor: "pointer", flexShrink: 0 }}>
                  <span style={{
                    display: "block", width: 22, height: 22, borderRadius: "50%",
                    background: typeof selColor === "string" ? selColor : "#334155",
                    border: "2px solid rgba(0,0,0,0.15)",
                  }} />
                  <input
                    type="color"
                    value={typeof selColor === "string" && /^#[0-9a-fA-F]{6}$/.test(selColor) ? selColor : "#334155"}
                    onChange={e => updateSelected({ fill: e.target.value })}
                    style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%" }}
                  />
                </label>
                <TbDivider />
                <select
                  value={selFontFamily}
                  onChange={e => updateSelected({ fontFamily: e.target.value })}
                  onMouseDown={e => e.stopPropagation()}
                  style={{
                    fontSize: 12, border: "1px solid #e5e7eb", borderRadius: 4,
                    padding: "2px 4px", outline: "none", background: "#fff",
                    cursor: "pointer", width: 120, height: 26,
                  }}
                >
                  {FONT_FAMILIES.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <TbDivider />
                <input
                  type="number"
                  min={8} max={200}
                  value={selFontSz}
                  onChange={e => updateSelected({ fontSize: Math.max(8, Number(e.target.value)) })}
                  onMouseDown={e => e.stopPropagation()}
                  style={{
                    width: 42, height: 26, fontSize: 12, textAlign: "center",
                    border: "1px solid #e5e7eb", borderRadius: 4,
                    padding: "2px 4px", outline: "none", background: "#fff",
                  }}
                />
                <span style={{ fontSize: 11, color: "#9ca3af" }}>px</span>
              </div>

              {/* Row 2: alignment · bold · italic · delete */}
              <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                <TbBtn active={selAlign === "left"} title="Align left" onMouseDown={() => updateSelected({ textAlign: "left" })}>
                  <AlignLeft size={13} />
                </TbBtn>
                <TbBtn active={selAlign === "center"} title="Align center" onMouseDown={() => updateSelected({ textAlign: "center" })}>
                  <AlignCenter size={13} />
                </TbBtn>
                <TbBtn active={selAlign === "right"} title="Align right" onMouseDown={() => updateSelected({ textAlign: "right" })}>
                  <AlignRight size={13} />
                </TbBtn>
                <TbDivider />
                <TbBtn active={selBold} title="Bold (Ctrl+B)" onMouseDown={() => updateSelected({ fontWeight: selBold ? "normal" : "bold" })}>
                  <span style={{ fontWeight: 700, fontSize: 13, lineHeight: 1 }}>B</span>
                </TbBtn>
                <TbBtn active={selItalic} title="Italic (Ctrl+I)" onMouseDown={() => updateSelected({ fontStyle: selItalic ? "normal" : "italic" })}>
                  <em style={{ fontStyle: "italic", fontSize: 13, fontWeight: 600, lineHeight: 1 }}>I</em>
                </TbBtn>
                <TbDivider />
                <TbBtn title="Duplicate" onMouseDown={() => { duplicateSelected(); }}>
                  <Copy size={13} />
                </TbBtn>
                <button
                  onMouseDown={e => { e.preventDefault(); deleteSelected(); }}
                  title="Delete"
                  style={{
                    width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center",
                    borderRadius: 4, border: "none", background: "transparent",
                    color: "#ef4444", cursor: "pointer", flexShrink: 0,
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          </div>,
          document.body
        );
      })()}
    </div>
  );
};

export default CertificateDesignEditor;

function PreviewModal({ url, fileName, onClose }: { url: string; fileName: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl flex flex-col w-full max-w-5xl"
        style={{ height: "90vh" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900">Certificate Preview</h3>
          <div className="flex items-center gap-2">
            <a
              href={url}
              download={fileName}
              className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
            >
              Download
            </a>
            <button
              onClick={onClose}
              className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <iframe src={url} className="flex-1 w-full rounded-b-xl" title="Certificate Preview" />
      </div>
    </div>
  );
}
