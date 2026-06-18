import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Pencil, X, CheckCircle, Loader2, AlertCircle } from "lucide-react";
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

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Props ────────────────────────────────────────────────────────────────────

interface QuestionBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  label: string;
  courseId: string;
  /** Pass midTestId only for chapter mid-tests. Course-level tests use courseId. */
  midTestId?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function QuestionBuilderModal({
  isOpen,
  onClose,
  label,
  courseId,
  midTestId,
}: QuestionBuilderModalProps) {
  const [questions, setQuestions] = useState<IQuestionnaire[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string>("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [draft, setDraft] = useState<QuestionDraft>(emptyDraft());
  const [editingQuestion, setEditingQuestion] = useState<IQuestionnaire | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string>("");

  // ── Fetch questions ─────────────────────────────────────────────────────────
  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getCourseById(courseId);
      const course = res.data as ICourse;

      if (midTestId) {
        // Find the midTest questionnaires inside sections → chapters
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
        // Course-level questionnaires (preTest / finalTest share same pool)
        setQuestions(course.questionnaires ?? []);
      }
    } catch {
      toast.error("Failed to load questions");
    } finally {
      setLoading(false);
    }
  }, [courseId, midTestId]);

  useEffect(() => {
    if (isOpen) {
      fetchQuestions();
      setDraft(emptyDraft());
      setShowAddForm(false);
    }
  }, [isOpen, fetchQuestions]);

  // ── Edit question ────────────────────────────────────────────────────────────
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

  // ── Delete question ─────────────────────────────────────────────────────────
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
      setQuestions((prev) => prev.filter((q) => q.id !== id));
    } catch {
      toast.error("Failed to delete question");
    } finally {
      setDeletingId("");
    }
  };

  // ── Draft helpers ───────────────────────────────────────────────────────────
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
        // Single-answer: only one can be correct
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

  // ── Save question (create or update) ────────────────────────────────────────
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
        await Promise.all(
          (editingQuestion.options ?? [])
            .filter((o) => !draftServerIds.has(o.id))
            .map((o) => deleteOption(o.id))
        );
        await Promise.all(
          filledOptions.map((opt) =>
            opt.serverId
              ? updateOption(opt.serverId, { label: opt.label.trim(), questionnaireId: editingQuestion.id })
              : createOption({ label: opt.label.trim(), questionnaireId: editingQuestion.id })
          )
        );
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
          courseId: midTestId ? null : courseId,
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{label}</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {midTestId
                ? "Questions linked to this chapter's mid-test"
                : "Questions shared across pre-test and final test"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 transition p-1 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-10 text-gray-400 gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Loading questions...</span>
            </div>
          )}

          {/* Empty state */}
          {!loading && questions.length === 0 && !showAddForm && (
            <div className="text-center py-10 text-gray-400">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">No questions yet. Add your first question below.</p>
            </div>
          )}

          {/* Question list */}
          {!loading && questions.map((q, idx) => (
            <div
              key={q.id}
              className="border border-gray-200 rounded-lg p-4 space-y-2 bg-gray-50"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-gray-800">
                  {idx + 1}. {q.question}
                </p>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleEditClick(q)}
                    className="text-gray-400 hover:text-blue-600 transition p-0.5"
                    title="Edit question"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(q.id)}
                    disabled={deletingId === q.id}
                    className="text-red-400 hover:text-red-600 transition p-0.5 disabled:opacity-50"
                  >
                    {deletingId === q.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Options */}
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
                          isCorrect ? "text-green-700 font-medium" : "text-gray-600"
                        }`}
                      >
                        {opt.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {q.feedbackStatement && (
                <p className="text-xs text-blue-600 italic pl-2">
                  Feedback: {q.feedbackStatement}
                </p>
              )}

              {q.allowMultiple && (
                <span className="inline-block text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                  Multiple answers
                </span>
              )}
            </div>
          ))}

          {/* Add / Edit Question Form */}
          {showAddForm && (
            <div className="border-2 border-blue-200 rounded-lg p-4 space-y-3 bg-blue-50">
              <h4 className="font-semibold text-sm text-blue-800">
                {editingQuestion ? "Edit Question" : "New Question"}
              </h4>

              {/* Question text */}
              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  Question <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={2}
                  value={draft.question}
                  onChange={(e) => setDraft((d) => ({ ...d, question: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none bg-white"
                  placeholder="Enter your question..."
                />
              </div>

              {/* Allow multiple */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.allowMultiple}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, allowMultiple: e.target.checked }))
                  }
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-700">Allow multiple correct answers</span>
              </label>

              {/* Options */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-gray-600 font-medium">
                    Options <span className="text-red-500">*</span>
                  </label>
                  <span className="text-xs text-gray-400">
                    {draft.allowMultiple ? "Check all correct answers" : "Select one correct answer"}
                  </span>
                </div>

                {draft.options.map((opt, i) => (
                  <div key={opt.id} className="flex items-center gap-2">
                    {/* Correct toggle */}
                    <input
                      type={draft.allowMultiple ? "checkbox" : "radio"}
                      name="correctAnswer"
                      checked={opt.isCorrect}
                      onChange={() => toggleOptionCorrect(opt.id)}
                      className="flex-shrink-0 text-green-600 focus:ring-green-500"
                      title="Mark as correct"
                    />
                    <input
                      type="text"
                      value={opt.label}
                      onChange={(e) => updateDraftOption(opt.id, e.target.value)}
                      placeholder={`Option ${i + 1}`}
                      className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                    />
                    <button
                      onClick={() => removeOption(opt.id)}
                      className="text-gray-400 hover:text-red-500 transition flex-shrink-0"
                      title="Remove option"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                <button
                  onClick={addOption}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition font-medium"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add option
                </button>
              </div>

              {/* Feedback statement */}
              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  Feedback Statement <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={draft.feedbackStatement}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, feedbackStatement: e.target.value }))
                  }
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                  placeholder="Shown after CHW answers..."
                />
              </div>

              {/* Form actions */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition flex items-center gap-2 disabled:opacity-60"
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
                  onClick={() => {
                    setShowAddForm(false);
                    setDraft(emptyDraft());
                    setEditingQuestion(null);
                  }}
                  disabled={saving}
                  className="px-4 py-2 bg-white text-gray-700 text-sm font-semibold rounded-lg border border-gray-300 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between flex-shrink-0 bg-gray-50 rounded-b-xl">
          <span className="text-xs text-gray-500">
            {questions.length} question{questions.length !== 1 ? "s" : ""}
          </span>
          {!showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Question
            </button>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-50 rounded-lg">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <h3 className="text-base font-bold text-gray-900">Delete question?</h3>
            </div>
            <p className="text-sm text-gray-500">
              This question will be permanently removed. This cannot be undone.
            </p>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setConfirmDeleteId("")}
                className="flex-1 px-4 py-2 text-sm font-semibold rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-2 text-sm font-semibold rounded-lg bg-red-500 text-white hover:bg-red-600 transition"
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
