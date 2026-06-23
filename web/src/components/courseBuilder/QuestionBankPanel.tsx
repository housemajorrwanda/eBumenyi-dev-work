import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Pencil, X, CheckCircle, Loader2, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import toast from "react-hot-toast";
import { getCourseById } from "@/services/course.service";
import {
  createQuestionnaire,
  createOption,
  createAnswer,
  deleteQuestionnaire,
  updateQuestionnaire,
  updateOption,
  deleteOption,
  deleteAnswer,
} from "@/services/questionnaire.service";
import { IQuestionnaire, ICourse } from "@/types";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface OptionDraft {
  id: string;
  serverId?: string; // set for existing options when editing
  label: string;
  isCorrect: boolean;
}

interface QuestionDraft {
  question: string;
  feedbackStatement: string;
  allowMultiple: boolean;
  options: OptionDraft[];
}

const emptyDraft = (): QuestionDraft => ({
  question: "",
  feedbackStatement: "",
  allowMultiple: false,
  options: [
    { id: crypto.randomUUID(), label: "", isCorrect: false },
    { id: crypto.randomUUID(), label: "", isCorrect: false },
  ],
});

// ─── Props ──────────────────────────────────────────────────────────────────────

interface QuestionBankPanelProps {
  /** Pass courseId for course-level Question Bank (pre-test, final-test, exam) */
  courseId?: string;
  /** Pass midTestId for chapter mid-test questions */
  midTestId?: string;
  /** Trigger a refresh from outside (e.g. when switching chapters) */
  refreshKey?: string | number;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function QuestionBankPanel({
  courseId,
  midTestId,
  refreshKey,
}: QuestionBankPanelProps) {
  const [questions, setQuestions] = useState<IQuestionnaire[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string>("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [draft, setDraft] = useState<QuestionDraft>(emptyDraft());
  const [editingQuestion, setEditingQuestion] = useState<IQuestionnaire | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string>("");

  const QUESTIONS_PER_PAGE = 10;

  const effectiveCourseId = courseId ?? "";

  // ── Fetch questions ───────────────────────────────────────────────────────────
  const fetchQuestions = useCallback(async () => {
    if (!effectiveCourseId) return;
    setLoading(true);
    try {
      const res = await getCourseById(effectiveCourseId);
      const course = res.data as ICourse;

      if (midTestId) {
        let found: IQuestionnaire[] = [];
        for (const section of course.sections ?? []) {
          for (const chapter of section.chapters ?? []) {
            if (chapter.midTest?.id === midTestId) {
              found = chapter.midTest.questionnaires ?? [];
              break;
            }
          }
          if (found.length > 0) break;
        }
        setQuestions(found);
      } else {
        setQuestions(course.questionnaires ?? []);
      }
    } catch {
      toast.error("Failed to load questions");
    } finally {
      setLoading(false);
    }
  }, [effectiveCourseId, midTestId]);

  useEffect(() => {
    fetchQuestions();
    setDraft(emptyDraft());
    setShowAddForm(false);
    setCurrentPage(1);
  }, [fetchQuestions, refreshKey]);

  // ── Edit ──────────────────────────────────────────────────────────────────────
  const handleEditClick = (q: IQuestionnaire) => {
    setEditingQuestion(q);
    setDraft({
      question: q.question,
      feedbackStatement: q.feedbackStatement ?? "",
      allowMultiple: q.allowMultiple,
      options: (q.options ?? []).map((opt) => ({
        id: opt.id,
        serverId: opt.id,
        label: opt.label,
        isCorrect: (q.answers ?? []).some(
          (a) => a.label.trim().toLowerCase() === opt.label.trim().toLowerCase()
        ),
      })),
    });
    setShowAddForm(true);
  };

  // ── Delete ────────────────────────────────────────────────────────────────────
  const handleDelete = (id: string) => {
    setConfirmDeleteId(id);
  };

  const confirmDelete = async () => {
    const id = confirmDeleteId;
    setConfirmDeleteId("");
    setDeletingId(id);
    try {
      await deleteQuestionnaire(id);
      toast.success("Question deleted");
      setQuestions((prev) => {
        const updated = prev.filter((q) => q.id !== id);
        // Clamp page if current page no longer exists after deletion
        const maxPage = Math.max(1, Math.ceil(updated.length / QUESTIONS_PER_PAGE));
        setCurrentPage((p) => Math.min(p, maxPage));
        return updated;
      });
    } catch {
      toast.error("Failed to delete question");
    } finally {
      setDeletingId("");
    }
  };

  // ── Draft helpers ─────────────────────────────────────────────────────────────
  const updateDraftOption = (optId: string, label: string) => {
    setDraft((d) => ({
      ...d,
      options: d.options.map((o) => (o.id === optId ? { ...o, label } : o)),
    }));
  };

  const toggleOptionCorrect = (optId: string) => {
    setDraft((d) => ({
      ...d,
      options: d.options.map((o) => {
        if (d.allowMultiple) {
          return o.id === optId ? { ...o, isCorrect: !o.isCorrect } : o;
        }
        return { ...o, isCorrect: o.id === optId ? !o.isCorrect : false };
      }),
    }));
  };

  const addOption = () => {
    setDraft((d) => ({
      ...d,
      options: [...d.options, { id: crypto.randomUUID(), label: "", isCorrect: false }],
    }));
  };

  const removeOption = (optId: string) => {
    setDraft((d) => {
      if (d.options.length <= 2) {
        toast.error("At least 2 options are required");
        return d;
      }
      return { ...d, options: d.options.filter((o) => o.id !== optId) };
    });
  };

  // ── Save (create or update) ───────────────────────────────────────────────────
  const handleSave = async () => {
    if (!draft.question.trim()) {
      toast.error("Question text is required");
      return;
    }
    const filledOptions = draft.options.filter((o) => o.label.trim());
    if (filledOptions.length < 2) {
      toast.error("At least 2 options with text are required");
      return;
    }
    const correctOptions = filledOptions.filter((o) => o.isCorrect);
    if (correctOptions.length === 0) {
      toast.error("Mark at least one option as correct");
      return;
    }

    setSaving(true);
    try {
      if (editingQuestion) {
        // UPDATE flow
        await updateQuestionnaire(editingQuestion.id, {
          question: draft.question.trim(),
          feedbackStatement: draft.feedbackStatement.trim() || undefined,
          allowMultiple: draft.allowMultiple,
        });

        const draftServerIds = new Set(
          filledOptions.filter((o) => o.serverId).map((o) => o.serverId!)
        );
        // Delete options removed from the draft
        await Promise.all(
          (editingQuestion.options ?? [])
            .filter((o) => !draftServerIds.has(o.id))
            .map((o) => deleteOption(o.id))
        );
        // Update existing options / create new ones
        await Promise.all(
          filledOptions.map((opt) =>
            opt.serverId
              ? updateOption(opt.serverId, { label: opt.label.trim(), questionnaireId: editingQuestion.id })
              : createOption({ label: opt.label.trim(), questionnaireId: editingQuestion.id })
          )
        );
        // Delete all old answers and recreate from correct options
        await Promise.all((editingQuestion.answers ?? []).map((a) => deleteAnswer(a.id)));
        await Promise.all(
          correctOptions.map((opt) =>
            createAnswer({ label: opt.label.trim(), questionnaireId: editingQuestion.id })
          )
        );

        toast.success("Question updated");
      } else {
        // CREATE flow
        const questionnaire = await createQuestionnaire({
          question: draft.question.trim(),
          feedbackStatement: draft.feedbackStatement.trim() || undefined,
          allowMultiple: draft.allowMultiple,
          courseId: midTestId ? null : effectiveCourseId,
          midTestId: midTestId ?? null,
        });

        if (!questionnaire?.id) throw new Error("No questionnaire ID returned");

        await Promise.all(
          filledOptions.map((opt) =>
            createOption({ label: opt.label.trim(), questionnaireId: questionnaire.id })
          )
        );
        await Promise.all(
          correctOptions.map((opt) =>
            createAnswer({ label: opt.label.trim(), questionnaireId: questionnaire.id })
          )
        );

        toast.success("Question added");
        const newLastPage = Math.ceil((questions.length + 1) / QUESTIONS_PER_PAGE);
        setCurrentPage(newLastPage);
      }

      setDraft(emptyDraft());
      setShowAddForm(false);
      setEditingQuestion(null);
      fetchQuestions();
    } catch {
      toast.error(editingQuestion ? "Failed to update question" : "Failed to save question");
    } finally {
      setSaving(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(questions.length / QUESTIONS_PER_PAGE));
  const paginatedQuestions = questions.slice(
    (currentPage - 1) * QUESTIONS_PER_PAGE,
    currentPage * QUESTIONS_PER_PAGE
  );

  return (
    <div className="space-y-4">
      {/* Summary bar — sticky so Add Question button stays visible while scrolling */}
      <div className="sticky top-0 bg-white z-10 flex items-center justify-between py-3 border-b border-gray-200">
        <span className="text-sm text-secondary">
          {loading
            ? "Loading…"
            : `${questions.length} question${questions.length !== 1 ? "s" : ""} in bank`}
        </span>
        <button
          onClick={() => setShowAddForm(true)}
          className="px-3 py-1.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 transition flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          Add Question
        </button>
      </div>

      {/* Add Question Modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
              <h4 className="font-semibold text-base text-dark">
                {editingQuestion ? "Edit Question" : "New Question"}
              </h4>
              <button
                onClick={() => { setShowAddForm(false); setDraft(emptyDraft()); setEditingQuestion(null); }}
                className="text-gray-400 hover:text-dark transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal body — scrollable */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <div>
                <label className="block text-xs text-secondary mb-1">
                  Question <span className="text-destructive">*</span>
                </label>
                <textarea
                  rows={3}
                  value={draft.question}
                  onChange={(e) => setDraft((d) => ({ ...d, question: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none bg-white"
                  placeholder="Enter your question..."
                  autoFocus
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.allowMultiple}
                  onChange={(e) => setDraft((d) => ({ ...d, allowMultiple: e.target.checked }))}
                  className="rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-xs text-secondary">Allow multiple correct answers</span>
              </label>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-secondary font-medium">
                    Options <span className="text-destructive">*</span>
                  </label>
                  <span className="text-xs text-gray-400">
                    {draft.allowMultiple ? "Check all correct answers" : "Select one correct answer"}
                  </span>
                </div>

                {draft.options.map((opt, i) => (
                  <div key={opt.id} className="flex items-center gap-2">
                    <input
                      type={draft.allowMultiple ? "checkbox" : "radio"}
                      name="correctAnswer"
                      checked={opt.isCorrect}
                      onChange={() => toggleOptionCorrect(opt.id)}
                      className="flex-shrink-0 text-primary focus:ring-primary"
                      title="Mark as correct"
                    />
                    <input
                      type="text"
                      value={opt.label}
                      onChange={(e) => updateDraftOption(opt.id, e.target.value)}
                      placeholder={`Option ${i + 1}`}
                      className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary/40 bg-white"
                    />
                    <button
                      onClick={() => removeOption(opt.id)}
                      className="text-gray-400 hover:text-destructive transition flex-shrink-0"
                      title="Remove option"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                <button
                  onClick={addOption}
                  className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition font-medium"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add option
                </button>
              </div>

              <div>
                <label className="block text-xs text-secondary mb-1">
                  Feedback Statement <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={draft.feedbackStatement}
                  onChange={(e) => setDraft((d) => ({ ...d, feedbackStatement: e.target.value }))}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary/40 bg-white"
                  placeholder="Shown after CHW answers..."
                />
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex gap-3 px-6 py-4 border-t border-gray-200 flex-shrink-0">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 transition flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {editingQuestion ? "Updating..." : "Saving..."}
                  </>
                ) : (
                  editingQuestion ? "Update Question" : "Save Question"
                )}
              </button>
              <button
                onClick={() => { setShowAddForm(false); setDraft(emptyDraft()); setEditingQuestion(null); }}
                disabled={saving}
                className="px-4 py-2 bg-white text-secondary text-sm font-semibold rounded-lg border border-gray-300 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-10 text-secondary gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading questions…</span>
        </div>
      )}

      {/* Empty state */}
      {!loading && questions.length === 0 && !showAddForm && (
        <div className="text-center py-10 text-secondary border-2 border-dashed border-gray-200 rounded-lg">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">No questions yet. Add your first question above.</p>
        </div>
      )}

      {/* Question list (paginated) */}
      {!loading &&
        paginatedQuestions.map((q, idx) => {
          const globalIdx = (currentPage - 1) * QUESTIONS_PER_PAGE + idx;
          return (
            <div
              key={q.id}
              className="border border-gray-200 rounded-lg p-4 space-y-2 bg-page-bg"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-dark">
                  {globalIdx + 1}. {q.question}
                </p>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleEditClick(q)}
                    className="text-secondary/60 hover:text-primary transition p-0.5"
                    title="Edit question"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(q.id)}
                    disabled={deletingId === q.id}
                    className="text-destructive/60 hover:text-destructive transition p-0.5 disabled:opacity-50"
                  >
                    {deletingId === q.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-1 pl-2">
                {(q.options ?? []).map((opt) => {
                  const isCorrect = (q.answers ?? []).some(
                    (a) => a.label.trim().toLowerCase() === opt.label.trim().toLowerCase()
                  );
                  return (
                    <div key={opt.id} className="flex items-center gap-2">
                      {isCorrect ? (
                        <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                      ) : (
                        <span className="w-3.5 h-3.5 rounded-full border border-gray-300 flex-shrink-0 inline-block" />
                      )}
                      <span
                        className={`text-xs ${
                          isCorrect ? "text-green-700 font-medium" : "text-secondary"
                        }`}
                      >
                        {opt.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {q.feedbackStatement && (
                <p className="text-xs text-primary italic pl-2">
                  Feedback: {q.feedbackStatement}
                </p>
              )}

              {q.allowMultiple && (
                <span className="inline-block text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                  Multiple answers
                </span>
              )}
            </div>
          );
        })}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 border-t border-gray-200">
          <span className="text-xs text-secondary">
            Page {currentPage} of {totalPages} &nbsp;·&nbsp;{" "}
            {(currentPage - 1) * QUESTIONS_PER_PAGE + 1}–
            {Math.min(currentPage * QUESTIONS_PER_PAGE, questions.length)} of {questions.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded border border-gray-300 text-secondary hover:bg-primary/5 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`min-w-[2rem] h-8 text-xs font-semibold rounded border transition ${
                  page === currentPage
                    ? "bg-primary text-white border-primary"
                    : "bg-white text-secondary border-gray-300 hover:bg-primary/5"
                }`}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded border border-gray-300 text-secondary hover:bg-primary/5 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      {/* Delete Confirm Modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-destructive/10 rounded-lg">
                <Trash2 className="w-5 h-5 text-destructive" />
              </div>
              <h3 className="text-base font-bold text-dark">Delete question?</h3>
            </div>
            <p className="text-sm text-secondary">
              This question will be permanently removed. This cannot be undone.
            </p>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setConfirmDeleteId("")}
                className="flex-1 px-4 py-2 text-sm font-semibold rounded-lg border border-gray-300 text-secondary hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-2 text-sm font-semibold rounded-lg bg-destructive text-white hover:bg-destructive/90 transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
