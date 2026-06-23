import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Canvas as FabricCanvas,
  IText,
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
} from "lucide-react";
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
  type CertificateTemplateSummary,
  type LinkedCourse,
} from "@/services/certificateTemplate.service";
import { getAllCoursesNoPagination } from "@/services/course.service";
import type { ICourse } from "@/types";

// ── Constants ─────────────────────────────────────────────────────────────────

const CANVAS_WIDTH  = 1056; // 11in @ 96 dpi — landscape
const CANVAS_HEIGHT = 816;  // 8.5in @ 96 dpi

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

const MOCK_TOKENS: Record<string, string> = {
  "{{studentName}}":     "John Doe",
  "{{certificateCode}}": "CHW-2026-001234",
  "{{currentDate}}":     "17 Kamena 2026",
  "{{courseName}}":      "Community Health Worker Training",
  "{{courseDetails}}":   "Advanced Community Health Worker Program",
  "{{progress}}":        "100%",
  "{{courseDuration}}":  "12 Weeks",
  "{{startDate}}":       "01 Mutarama 2026",
  "{{endDate}}":         "17 Kamena 2026",
  "{{studentCode}}":     "STU-2026-001",
  "{{instructorName}}":  "Dr. Jane Smith",
};

const BG_COLORS = [
  "#ffffff", "#f8fafc", "#eff6ff", "#f0fdf4",
  "#fefce8", "#fdf2f8", "#0f172a", "#1e3a5f",
  "#166534", "#7f1d1d",
];

// ── Component ─────────────────────────────────────────────────────────────────

const CertificateDesignEditor: React.FC = () => {
  const navigate      = useNavigate();
  const { id: routeId } = useParams<{ id: string }>();
  const canvasElRef    = useRef<HTMLCanvasElement>(null);
  const fabricRef      = useRef<FabricCanvas | null>(null);
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const bgFileInputRef = useRef<HTMLInputElement>(null);

  // Refs for history — avoids stale-closure issues in fabric event handlers
  const historyRef    = useRef<string[]>([]);
  const historyIdxRef = useRef(-1);
  const historyLock   = useRef(false);

  // Zoom ref mirrors zoom state so async callbacks always see current value
  const zoomRef = useRef(75);

  // ── UI state ─────────────────────────────────────────────────────────────────

  const [activeTab,      setActiveTab]      = useState<"certificates" | "link-certificates">("certificates");
  const [rightTab,       setRightTab]       = useState<"elements" | "backgrounds">("elements");
  const [searchQuery,    setSearchQuery]    = useState("");
  const [zoom,           setZoom]           = useState(75);

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

  // Mock certificate generation
  const [isGeneratingMock, setIsGeneratingMock] = useState(false);

  // Link Certificates tab
  const [allCourses,      setAllCourses]      = useState<ICourse[]>([]);
  const [linkedCourseIds, setLinkedCourseIds] = useState<Set<string>>(new Set());
  const [isLinkLoading,   setIsLinkLoading]   = useState(false);
  const [togglingId,      setTogglingId]      = useState<string | null>(null);

  // Canvas-driven re-render trigger
  const [, setTick]          = useState(0);
  const bumpTick             = useCallback(() => setTick(n => n + 1), []);
  const [dirtyCount, setDirtyCount] = useState(0);

  // Selected fabric object
  const [selectedObj, setSelectedObj] = useState<FabricObject | null>(null);

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
      setSelectedObj(canvas.getActiveObject() ?? null);
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
      bumpTick();
    } catch {
      // error shown by api interceptor
    } finally {
      setIsLoadingCanvas(false);
    }
  }, [bumpTick, reapplyCustomProps]);

  useEffect(() => {
    if (!canvasReady || !routeId) return;
    loadTemplate(routeId);
  }, [canvasReady, routeId, loadTemplate]);

  // ── Link-Certificates tab: load courses + current links ──────────────────────

  useEffect(() => {
    if (activeTab !== "link-certificates" || !templateId) return;
    let cancelled = false;
    setIsLinkLoading(true);
    Promise.all([
      getAllCoursesNoPagination(),
      getLinkedCourses(templateId),
    ]).then(([coursesRes, linked]) => {
      if (cancelled) return;
      setAllCourses((coursesRes.data as ICourse[]) ?? []);
      setLinkedCourseIds(new Set(linked.map((c: LinkedCourse) => c.id)));
    }).catch(() => {}).finally(() => {
      if (!cancelled) setIsLinkLoading(false);
    });
    return () => { cancelled = true; };
  }, [activeTab, templateId]);

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

  // ── Add elements ──────────────────────────────────────────────────────────────

  const addElement = useCallback((key: string) => {
    const canvas = fabricRef.current;
    if (!canvas) return;

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

    const t = new IText(content, {
      left:       300,
      top:        300,
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
  }, []);

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
    const obj    = canvas?.getActiveObject();
    if (!canvas || !obj) return;
    (obj as Record<string, unknown> & { set: (p: Record<string, unknown>) => void }).set(props);
    canvas.renderAll();
    bumpTick();
  }, [bumpTick]);

  const setBackground = useCallback((color: string) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.backgroundImage = undefined;
    canvas.backgroundColor = color;
    canvas.renderAll();
    saveSnapshot();
  }, [saveSnapshot]);

  const handleBackgroundImageUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const canvas = fabricRef.current;
      if (!canvas) return;

      // Use data URL so the src survives canvas.toJSON() / loadFromJSON() across page loads
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload  = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Load via HTMLImageElement to get reliable naturalWidth/naturalHeight
      const htmlImg = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload  = () => resolve(el);
        el.onerror = reject;
        el.src = dataUrl;
      });

      const natW = htmlImg.naturalWidth  || CANVAS_WIDTH;
      const natH = htmlImg.naturalHeight || CANVAS_HEIGHT;

      // left/top = canvas center + originX/Y='center' so the image fills the full canvas
      const img = new FabricImage(htmlImg, {
        left:    CANVAS_WIDTH  / 2,
        top:     CANVAS_HEIGHT / 2,
        originX: 'center' as const,
        originY: 'center' as const,
        scaleX:  CANVAS_WIDTH  / natW,
        scaleY:  CANVAS_HEIGHT / natH,
        selectable: false,
        evented:    false,
      });

      canvas.backgroundImage = img;
      canvas.backgroundColor = "";
      canvas.renderAll();
      e.target.value = "";
      saveSnapshot();
    },
    [saveSnapshot],
  );

  // ── Generate Mock Certificate ─────────────────────────────────────────────────

  const generateMockCertificate = useCallback(async () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    setIsGeneratingMock(true);
    try {
      // Display-label → mock value table (fallback for templates saved before
      // the toObject fix, where token/tokenKey were never persisted to JSON).
      const labelToMock: Record<string, string> = {};
      Object.entries(DISPLAY_LABEL).forEach(([key, label]) => {
        const tkn = TOKEN_VALUE[key];
        if (tkn && MOCK_TOKENS[tkn]) labelToMock[label] = MOCK_TOKENS[tkn];
      });

      // canvas.toObject (NOT toJSON) correctly forwards the extra-properties
      // array to each object's serialiser so token/tokenKey appear in the JSON.
      const json = JSON.parse(JSON.stringify(canvas.toObject(["tokenKey", "token"])));

      (json.objects as Record<string, unknown>[]).forEach((obj) => {
        const token    = obj.token    as string | undefined;
        const tokenKey = obj.tokenKey as string | undefined;
        const text     = obj.text     as string | undefined;

        // Priority: explicit token string → tokenKey lookup → display-label text
        const mock =
          (token    ? MOCK_TOKENS[token]                        : undefined) ??
          (tokenKey ? MOCK_TOKENS[TOKEN_VALUE[tokenKey] ?? ""]  : undefined) ??
          (text     ? labelToMock[text]                          : undefined);

        if (mock) {
          obj.text      = mock;
          obj.fontStyle = "normal";
        }
      });

      // Render at full 1 : 1 resolution in a hidden off-screen canvas
      const tempEl = document.createElement("canvas");
      tempEl.style.cssText = "position:absolute;left:-9999px;top:-9999px;visibility:hidden;";
      document.body.appendChild(tempEl);

      const tempCanvas = new FabricCanvas(tempEl, {
        width:           CANVAS_WIDTH,
        height:          CANVAS_HEIGHT,
        backgroundColor: "#ffffff",
        preserveObjectStacking: true,
      });
      await tempCanvas.loadFromJSON(json);
      tempCanvas.renderAll();

      const dataUrl = tempCanvas.toDataURL({ format: "png", quality: 1 });
      tempCanvas.dispose();
      document.body.removeChild(tempEl);

      // Wrap in a letter-landscape PDF (11 × 8.5 in = 792 × 612 pt)
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });
      pdf.addImage(dataUrl, "PNG", 0, 0, 792, 612);
      pdf.save(`${templateName || "certificate"}-preview.pdf`);
    } catch {
      toast.error("Failed to generate preview PDF");
    } finally {
      setIsGeneratingMock(false);
    }
  }, [templateName]);

  // ── Link/unlink toggle ───────────────────────────────────────────────────────

  const toggleCourseLink = useCallback(async (courseId: string) => {
    if (!templateId || togglingId) return;
    setTogglingId(courseId);
    try {
      if (linkedCourseIds.has(courseId)) {
        await unlinkTemplateFromCourse(templateId, courseId);
        setLinkedCourseIds(prev => { const s = new Set(prev); s.delete(courseId); return s; });
      } else {
        await linkTemplateToCourse(templateId, courseId);
        setLinkedCourseIds(prev => new Set(prev).add(courseId));
      }
    } catch {
      // interceptor shows toast
    } finally {
      setTogglingId(null);
    }
  }, [templateId, linkedCourseIds, togglingId]);

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
  const selIsText  = selectedObj instanceof IText;
  const selFontSz  = selIsText ? (sel.fontSize  ?? 20)        : 20;
  const selColor   = selIsText ? (sel.fill       ?? "#334155") : "#334155";
  const selBold    = selIsText && sel.fontWeight === "bold";
  const selAlign   = selIsText ? (sel.textAlign  ?? "center")  : "center";
  const selOpacity = sel ? (sel.opacity ?? 1) : 1;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden select-none">

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <header className="h-12 border-b border-gray-200 flex items-center px-4 gap-3 shrink-0 bg-white z-10">

        <button
          onClick={() => navigate("/certificates")}
          className="p-1.5 hover:bg-gray-100 rounded-md text-gray-500 transition-colors"
          title="Back to Certificates"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        {templateId ? (
          <input
            value={templateName}
            onChange={e => setTemplateName(e.target.value)}
            onBlur={handleRenameTemplate}
            onKeyDown={e => { if (e.key === "Enter") { e.currentTarget.blur(); } }}
            className="text-sm font-semibold text-gray-800 border-none outline-none bg-transparent pr-4 border-r border-gray-200 w-44 truncate focus:ring-0"
            placeholder="Template name"
          />
        ) : (
          <span className="text-sm font-semibold text-gray-800 pr-4 border-r border-gray-200 whitespace-nowrap">
            Certificate Builder
          </span>
        )}

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
            Generate Mock Certificate
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
              onClick={() => setShowNewModal(true)}
              className="p-1 hover:bg-gray-100 rounded-md text-gray-500 transition-colors"
              title="New template"
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
            {isLoadingTpls ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="text-center py-8 space-y-2">
                <p className="text-xs text-gray-400">No templates yet</p>
                <button
                  onClick={() => setShowNewModal(true)}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Create one
                </button>
              </div>
            ) : (
              filteredTemplates.map(tmpl => (
                <div
                  key={tmpl.id}
                  className="group relative"
                >
                  <button
                    onClick={() => navigate(`/certificates/design/${tmpl.id}`)}
                    className={`w-full text-left rounded-lg overflow-hidden border-2 transition-all ${
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
                    <div className="px-1.5 py-1.5">
                      <p className="text-xs font-medium text-gray-700 truncate">{tmpl.name}</p>
                    </div>
                  </button>

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
        <main
          className="flex-1 bg-[#e8e8e8] overflow-auto flex flex-col"
          onClick={e => {
            if (e.target === e.currentTarget) {
              fabricRef.current?.discardActiveObject();
              fabricRef.current?.renderAll();
              setSelectedObj(null);
            }
          }}
        >
          {/*
            Keep canvas element always in DOM (display:none to hide, not unmount)
            so Fabric keeps its state when switching between tabs.
            flex-1 gives this div a definite height (= main's height) so
            items-center / justify-center reliably center the canvas.
          */}
          <div
            className="flex-1 flex items-center justify-center p-12"
            style={{ display: activeTab === "certificates" ? "flex" : "none" }}
          >
            <div
              style={{
                position: "relative",
                boxShadow: "0 4px 32px rgba(0,0,0,0.18)",
                lineHeight: 0,
                flexShrink: 0,
              }}
            >
              <canvas ref={canvasElRef} />
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

          {activeTab === "link-certificates" && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="p-4 border-b border-gray-200 shrink-0">
                <h2 className="text-sm font-semibold text-gray-800">Link to Courses</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {templateId
                    ? `Assign "${templateName}" as the completion certificate for courses`
                    : "Select a template first"}
                </p>
              </div>

              {!templateId ? (
                <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
                  Open a template to link it to courses
                </div>
              ) : isLinkLoading ? (
                <div className="flex-1 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                </div>
              ) : allCourses.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
                  No courses found
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
                  {allCourses.map(course => {
                    const linked  = linkedCourseIds.has(course.id);
                    const loading = togglingId === course.id;
                    return (
                      <div
                        key={course.id}
                        className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${linked ? "bg-blue-50/50" : ""}`}
                      >
                        <img
                          src={course.coverIcon}
                          alt={course.title}
                          className="w-9 h-9 rounded object-cover shrink-0 bg-gray-100"
                          onError={e => { (e.target as HTMLImageElement).src = ""; }}
                        />
                        <span className="flex-1 text-sm text-gray-800 line-clamp-2 leading-snug">
                          {course.title}
                        </span>
                        <button
                          onClick={() => toggleCourseLink(course.id)}
                          disabled={!!togglingId}
                          className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors disabled:opacity-50 ${
                            linked
                              ? "bg-blue-600 text-white hover:bg-blue-700"
                              : "border border-gray-300 text-gray-400 hover:border-blue-400 hover:text-blue-500"
                          }`}
                        >
                          {loading
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : linked
                              ? <Check className="w-3.5 h-3.5" />
                              : <Plus className="w-3.5 h-3.5" />
                          }
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {templateId && !isLinkLoading && linkedCourseIds.size > 0 && (
                <div className="px-4 py-2.5 border-t border-gray-200 bg-gray-50 shrink-0">
                  <p className="text-xs text-gray-500">
                    Linked to <span className="font-semibold text-blue-600">{linkedCourseIds.size}</span>{" "}
                    {linkedCourseIds.size === 1 ? "course" : "courses"}
                  </p>
                </div>
              )}
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
                <div className="grid grid-cols-5 gap-2">
                  {BG_COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => setBackground(color)}
                      title={color}
                      className="w-9 h-9 rounded-md border border-gray-200 hover:scale-110 transition-transform shadow-sm"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
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
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
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
    </div>
  );
};

export default CertificateDesignEditor;
