import React, { useEffect, useRef, useState } from "react";
import { ImagePlus, ArrowRight, Upload, X } from "lucide-react";
import toast from "react-hot-toast";
import { CourseCreationForm } from "@/types/courseBuilder.d";

interface CreateCourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CourseCreationForm) => void;
  mode?: "create" | "edit";
  initialValues?: CourseCreationForm;
}

const INITIAL_FORM_STATE: CourseCreationForm = {
  title: "",
  description: "",
  coverIcon: "",
};

export default function CreateCourseModal({
  isOpen,
  onClose,
  onSubmit,
  mode = "create",
  initialValues,
}: CreateCourseModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState<CourseCreationForm>(INITIAL_FORM_STATE);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormData(mode === "edit" && initialValues ? initialValues : INITIAL_FORM_STATE);
      setIsDragging(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, [isOpen, mode, initialValues]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleIconFile = (file: File | null) => {
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file for the course icon");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setFormData((current) => ({
        ...current,
        coverIcon: reader.result as string,
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleFileInputChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const selectedFile = event.target.files?.[0] ?? null;
    handleIconFile(selectedFile);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    handleIconFile(event.dataTransfer.files?.[0] ?? null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      toast.error("Course title is required");
      return;
    }

    if (!formData.description.trim()) {
      toast.error("Course description is required");
      return;
    }

    if (!formData.coverIcon) {
      toast.error("Course icon is required");
      return;
    }


    onSubmit(formData);
    setFormData(INITIAL_FORM_STATE);
    setIsDragging(false);
  };

  const previewAvailable = Boolean(formData.coverIcon);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl overflow-hidden rounded-[28px] bg-white shadow-2xl ring-1 ring-black/5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-blue-100 bg-gradient-to-r from-primary via-primary to-sky-500 px-6 py-5 text-white sm:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/80">
              Course Builder
            </p>
            <h2 className="mt-1 text-2xl font-semibold sm:text-3xl">
              {mode === "edit" ? "Edit course details" : "Create a new course draft"}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-white/85 sm:text-base">
              {mode === "edit"
                ? "Update the course title, description, and icon below."
                : "Add the course title, write a clear description, and upload a real icon image to make the card feel more polished."}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full bg-white/15 p-2 text-white transition hover:bg-white/25"
            aria-label="Close course builder modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6 px-6 py-6 sm:px-8 sm:py-8">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-800">
                Course Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder="e.g. Community Health Fundamentals"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-800">
                Description <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Explain what this course teaches and who it is for."
                rows={6}
                className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <label className="block text-sm font-semibold text-slate-800">
                  Course Icon <span className="text-rose-500">*</span>
                </label>
                <span className="text-xs text-slate-500">
                  PNG, JPG, or WebP
                </span>
              </div>

              <div
                onClick={() => fileInputRef.current?.click()}
                onDragEnter={() => setIsDragging(true)}
                onDragLeave={() => setIsDragging(false)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleDrop}
                className={`group flex cursor-pointer flex-col items-center justify-center rounded-[24px] border-2 border-dashed px-5 py-8 text-center transition ${
                  isDragging
                    ? "border-primary bg-blue-50"
                    : previewAvailable
                      ? "border-blue-200 bg-blue-50/60"
                      : "border-slate-200 bg-slate-50 hover:border-primary hover:bg-blue-50/60"
                }`}
              >
                {previewAvailable ? (
                  <div className="flex w-full flex-col items-center gap-4">
                    <img
                      src={formData.coverIcon}
                      alt="Course icon preview"
                      className="h-28 w-28 rounded-3xl border border-white object-cover shadow-lg"
                    />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Icon uploaded successfully
                      </p>
                      <p className="text-sm text-slate-500">
                        Click or drag another image to replace it.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className="rounded-2xl bg-white p-4 text-primary shadow-sm ring-1 ring-slate-100">
                      <ImagePlus className="h-8 w-8" />
                    </div>
                    <div>
                      <p className="text-base font-semibold text-slate-900">
                        Upload a course icon
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Drag and drop an image here or browse from your device.
                      </p>
                    </div>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onClick={(event) => {
                    event.currentTarget.value = "";
                  }}
                  onChange={handleFileInputChange}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#4d81d2]"
                >
                  <Upload className="h-4 w-4" />
                  {previewAvailable ? "Replace icon" : "Choose file"}
                </button>
              </div>
            </div>
          </div>

          <aside className="border-t border-slate-100 bg-slate-50/80 px-6 py-6 lg:border-l lg:border-t-0 lg:px-8 lg:py-8">
            <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
                Live Preview
              </p>
              <div className="mt-4 overflow-hidden rounded-[22px] border border-slate-100 bg-gradient-to-br from-slate-900 via-primary to-sky-700 p-4 text-white shadow-xl">
                <div className="flex items-start gap-4">
                  <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-white/10 ring-1 ring-white/15">
                    {previewAvailable ? (
                      <img
                        src={formData.coverIcon}
                        alt="Course icon preview"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-2xl">📘</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-semibold leading-snug line-clamp-2">
                      {formData.title || "Your course title will appear here"}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-white/75 line-clamp-4">
                      {formData.description || "A short course description helps the card feel complete."}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-3 text-sm text-slate-600">
                <div className="rounded-2xl bg-blue-50 px-4 py-3 text-slate-700">
                  Keep the icon square for the cleanest result.
                </div>
                {mode === "create" && (
                  <div className="rounded-2xl bg-blue-50 px-4 py-3 text-slate-700">
                    We will connect this form to the next step.
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-2xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-[#4d81d2]"
              >
                <ArrowRight className="h-4 w-4" />
                {mode === "edit" ? "Save changes" : "Create course"}
              </button>
            </div>
          </aside>
        </form>
      </div>
    </div>
  );
}
