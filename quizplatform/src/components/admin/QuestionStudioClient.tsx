"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createQuestionAction,
  updateQuestionAction,
  deleteQuestionAction,
  reorderQuestionsAction,
  updateQuizAction,
} from "@/app/actions/admin-quiz";
import { QuestionInput } from "@/lib/quiz-service";

interface QuestionItem {
  id: string;
  quizId: string;
  createdBy: string;
  questionType: "MULTIPLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER";
  questionText: string;
  codeSnippet?: string | null;
  mediaUrl?: string | null;
  options: Array<{ id: string; text: string }>;
  correctOptionIds: string[];
  explanation?: string | null;
  points: number;
  timeLimitSeconds: number;
  orderIndex: number;
}

interface QuizItem {
  id: string;
  title: string;
  description?: string | null;
  roomCode?: string | null;
  sessionStatus: "DRAFT" | "SCHEDULED" | "LIVE" | "ENDED";
  resultsReleased: boolean;
  defaultTimePerQuestionSec: number;
  totalQuestions: number;
  totalPoints: number;
}

interface QuestionStudioClientProps {
  quiz: QuizItem;
  initialQuestions: QuestionItem[];
  currentUserId: string;
  currentUserRole?: string;
}

export default function QuestionStudioClient({
  quiz: initialQuiz,
  initialQuestions,
}: QuestionStudioClientProps) {
  const router = useRouter();
  const [quiz, setQuiz] = useState<QuizItem>(initialQuiz);
  const [questions, setQuestions] = useState<QuestionItem[]>(initialQuestions);
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Editing quiz settings modal
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [editTitle, setEditTitle] = useState(quiz.title);
  const [editDesc, setEditDesc] = useState(quiz.description || "");
  const [editRoomCode, setEditRoomCode] = useState(quiz.roomCode || "");
  const [editTimer, setEditTimer] = useState(quiz.defaultTimePerQuestionSec);

  // Question Form State (for adding or editing)
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [formPrompt, setFormPrompt] = useState("");
  const [formType, setFormType] = useState<"MULTIPLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER">(
    "MULTIPLE_CHOICE"
  );
  const [formCodeSnippet, setFormCodeSnippet] = useState("");
  const [formExplanation, setFormExplanation] = useState("");
  const [formPoints, setFormPoints] = useState(100);
  const [formTimeLimit, setFormTimeLimit] = useState(quiz.defaultTimePerQuestionSec || 30);
  const [formOptions, setFormOptions] = useState<Array<{ id: string; text: string }>>([
    { id: "opt-1", text: "" },
    { id: "opt-2", text: "" },
    { id: "opt-3", text: "" },
    { id: "opt-4", text: "" },
  ]);
  const [formCorrectOptionIds, setFormCorrectOptionIds] = useState<string[]>(["opt-1"]);

  const resetQuestionForm = () => {
    setEditingQuestionId(null);
    setFormPrompt("");
    setFormType("MULTIPLE_CHOICE");
    setFormCodeSnippet("");
    setFormExplanation("");
    setFormPoints(100);
    setFormTimeLimit(quiz.defaultTimePerQuestionSec || 30);
    setFormOptions([
      { id: "opt-1", text: "" },
      { id: "opt-2", text: "" },
      { id: "opt-3", text: "" },
      { id: "opt-4", text: "" },
    ]);
    setFormCorrectOptionIds(["opt-1"]);
    setErrorMsg(null);
  };

  const handleOpenAdd = () => {
    resetQuestionForm();
    setIsEditorOpen(true);
  };

  const handleOpenEdit = (q: QuestionItem) => {
    setEditingQuestionId(q.id);
    setFormPrompt(q.questionText);
    setFormType(q.questionType);
    setFormCodeSnippet(q.codeSnippet || "");
    setFormExplanation(q.explanation || "");
    setFormPoints(q.points);
    setFormTimeLimit(q.timeLimitSeconds);
    setFormOptions(q.options && q.options.length > 0 ? q.options : [{ id: "opt-1", text: "" }]);
    setFormCorrectOptionIds(q.correctOptionIds || []);
    setIsEditorOpen(true);
  };

  // Option handlers
  const handleOptionChange = (idx: number, text: string) => {
    setFormOptions((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], text };
      return copy;
    });
  };

  const handleAddOption = () => {
    const newId = `opt-${Date.now()}-${Math.floor(Math.random() * 100)}`;
    setFormOptions((prev) => [...prev, { id: newId, text: "" }]);
  };

  const handleRemoveOption = (idx: number) => {
    if (formOptions.length <= 2) {
      alert("At least 2 options are required.");
      return;
    }
    const removedId = formOptions[idx].id;
    setFormOptions((prev) => prev.filter((_, i) => i !== idx));
    setFormCorrectOptionIds((prev) => prev.filter((id) => id !== removedId));
  };

  const toggleCorrectOption = (optId: string) => {
    if (formType === "MULTIPLE_CHOICE" || formType === "TRUE_FALSE") {
      // Single choice default for simplicity or multi-select
      setFormCorrectOptionIds([optId]);
    } else {
      setFormCorrectOptionIds((prev) =>
        prev.includes(optId) ? prev.filter((id) => id !== optId) : [...prev, optId]
      );
    }
  };

  // Change Question Type
  const handleTypeChange = (newType: "MULTIPLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER") => {
    setFormType(newType);
    if (newType === "TRUE_FALSE") {
      setFormOptions([
        { id: "opt-tf-1", text: "True" },
        { id: "opt-tf-2", text: "False" },
      ]);
      setFormCorrectOptionIds(["opt-tf-1"]);
    } else if (newType === "SHORT_ANSWER") {
      setFormOptions([{ id: "opt-sa-1", text: "Accepted Answer" }]);
      setFormCorrectOptionIds(["opt-sa-1"]);
    } else {
      if (formOptions.length < 2) {
        setFormOptions([
          { id: "opt-1", text: "" },
          { id: "opt-2", text: "" },
          { id: "opt-3", text: "" },
          { id: "opt-4", text: "" },
        ]);
        setFormCorrectOptionIds(["opt-1"]);
      }
    }
  };

  // Submit Question Form
  const handleSubmitQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formPrompt.trim()) {
      setErrorMsg("Please enter question prompt.");
      return;
    }

    if (formOptions.some((o) => !o.text.trim())) {
      setErrorMsg("All options must contain text.");
      return;
    }

    if (formCorrectOptionIds.length === 0) {
      setErrorMsg("Please mark at least one correct option.");
      return;
    }

    setErrorMsg(null);
    const payload: QuestionInput = {
      questionText: formPrompt.trim(),
      questionType: formType,
      codeSnippet: formCodeSnippet.trim() || undefined,
      explanation: formExplanation.trim() || undefined,
      options: formOptions.map((o) => ({ id: o.id, text: o.text.trim() })),
      correctOptionIds: formCorrectOptionIds,
      points: Number(formPoints) || 100,
      timeLimitSeconds: Number(formTimeLimit) || 30,
    };

    startTransition(async () => {
      if (editingQuestionId) {
        const res = await updateQuestionAction(editingQuestionId, quiz.id, payload);
        if (res.success && res.data) {
          setQuestions((prev) =>
            prev.map((q) => (q.id === editingQuestionId ? (res.data as QuestionItem) : q))
          );
          setIsEditorOpen(false);
          setSuccessMsg("Question updated successfully.");
          setTimeout(() => setSuccessMsg(null), 3000);
          router.refresh();
        } else {
          setErrorMsg(res.error || "Failed to update question.");
        }
      } else {
        const res = await createQuestionAction(quiz.id, payload);
        if (res.success && res.data) {
          setQuestions((prev) => [...prev, res.data as QuestionItem]);
          setQuiz((prev) => ({
            ...prev,
            totalQuestions: prev.totalQuestions + 1,
            totalPoints: prev.totalPoints + (Number(formPoints) || 100),
          }));
          setIsEditorOpen(false);
          setSuccessMsg("Question added successfully.");
          setTimeout(() => setSuccessMsg(null), 3000);
          router.refresh();
        } else {
          setErrorMsg(res.error || "Failed to add question.");
        }
      }
    });
  };

  // Delete Question
  const handleDeleteQuestion = (questionId: string) => {
    if (!window.confirm("Are you sure you want to delete this question?")) return;

    startTransition(async () => {
      const res = await deleteQuestionAction(questionId, quiz.id);
      if (res.success) {
        setQuestions((prev) => prev.filter((q) => q.id !== questionId));
        setQuiz((prev) => ({
          ...prev,
          totalQuestions: Math.max(0, prev.totalQuestions - 1),
        }));
        router.refresh();
      } else {
        alert(res.error || "Could not delete question.");
      }
    });
  };

  // Move Question Order
  const handleMove = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= questions.length) return;

    const newOrder = [...questions];
    const [moved] = newOrder.splice(index, 1);
    newOrder.splice(targetIndex, 0, moved);

    const orderedIds = newOrder.map((q) => q.id);
    setQuestions(newOrder);

    startTransition(async () => {
      const res = await reorderQuestionsAction(quiz.id, orderedIds);
      if (!res.success) {
        alert(res.error || "Failed to reorder questions.");
        setQuestions(questions); // revert
      } else {
        router.refresh();
      }
    });
  };

  // Update Quiz Settings
  const handleSaveQuizSettings = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateQuizAction(quiz.id, {
        title: editTitle.trim(),
        description: editDesc.trim(),
        roomCode: editRoomCode.trim().toUpperCase(),
        defaultTimePerQuestionSec: Number(editTimer) || 30,
      });

      if (res.success && res.data) {
        setQuiz((prev) => ({
          ...prev,
          title: editTitle.trim(),
          description: editDesc.trim(),
          roomCode: editRoomCode.trim().toUpperCase(),
          defaultTimePerQuestionSec: Number(editTimer) || 30,
        }));
        setShowSettingsModal(false);
        router.refresh();
      } else {
        alert(res.error || "Failed to save quiz settings.");
      }
    });
  };

  return (
    <div className="flex flex-col flex-1 bg-white">
      {/* Studio Header Bar */}
      <div className="border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/quizzes"
            className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors"
            title="Back to Quizzes"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                {quiz.title}
              </h1>
              <button
                onClick={() => setShowSettingsModal(true)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                title="Edit Quiz Settings"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
              {quiz.description || "No description provided."}
            </p>
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-2.5 self-start md:self-auto">
          <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200/90 rounded-md px-2.5 py-1 text-xs font-mono font-bold text-slate-700">
            <span>ROOM:</span>
            <span className="text-sky-700">{quiz.roomCode}</span>
          </div>

          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-sky-500 hover:bg-sky-600 text-white font-semibold text-xs rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Add Question
          </button>

          <Link
            href={`/admin/quizzes/${quiz.id}/live`}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg shadow-xs transition-colors"
          >
            <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Launch Live Stage
          </Link>
        </div>
      </div>

      {/* Studio Subheader / Metrics */}
      <div className="bg-slate-50 border-b border-slate-200 px-6 py-2.5 flex items-center justify-between text-xs text-slate-600">
        <div className="flex items-center gap-4">
          <span className="font-bold text-slate-800">
            {questions.length} {questions.length === 1 ? "Question" : "Questions"}
          </span>
          <span>&bull;</span>
          <span>
            Total Points: <strong className="text-slate-800">{quiz.totalPoints}</strong>
          </span>
          <span>&bull;</span>
          <span>
            Default Timer: <strong className="text-slate-800">{quiz.defaultTimePerQuestionSec}s</strong>
          </span>
        </div>
        {successMsg && (
          <span className="text-emerald-700 font-semibold flex items-center gap-1">
            ✓ {successMsg}
          </span>
        )}
      </div>

      {/* Main Studio Area */}
      <div className="flex-1 p-6 overflow-y-auto">
        {questions.length === 0 ? (
          <div className="border border-dashed border-slate-300 rounded-xl p-12 text-center max-w-lg mx-auto my-8">
            <div className="w-12 h-12 rounded-full bg-sky-50 text-sky-500 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-slate-800 mb-1">No questions yet</h3>
            <p className="text-xs text-slate-500 mb-4">
              Add your first question to this quiz with custom timer, options, and points.
            </p>
            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              + Add First Question
            </button>
          </div>
        ) : (
          <div className="space-y-4 max-w-4xl mx-auto">
            {questions.map((q, idx) => (
              <div
                key={q.id}
                className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs hover:border-slate-300 transition-colors"
              >
                {/* Question Card Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-slate-900 text-white text-xs font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200">
                      {q.questionType.replace("_", " ")}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      {q.timeLimitSeconds}s &bull; {q.points} pts
                    </span>
                  </div>

                  {/* Ordering & Action Controls */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleMove(idx, "up")}
                      disabled={idx === 0}
                      title="Move Up"
                      className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20 cursor-pointer"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => handleMove(idx, "down")}
                      disabled={idx === questions.length - 1}
                      title="Move Down"
                      className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20 cursor-pointer"
                    >
                      ▼
                    </button>
                    <div className="h-3 w-px bg-slate-200 mx-1" />
                    <button
                      onClick={() => handleOpenEdit(q)}
                      className="p-1 text-slate-400 hover:text-sky-600 rounded cursor-pointer"
                      title="Edit Question"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteQuestion(q.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                      title="Delete Question"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Prompt */}
                <div className="pt-3">
                  <p className="text-sm font-semibold text-slate-900 leading-snug">
                    {q.questionText}
                  </p>

                  {/* Code snippet if present */}
                  {q.codeSnippet && (
                    <pre className="mt-2.5 p-3 rounded-lg bg-slate-900 text-sky-300 font-mono text-xs overflow-x-auto">
                      <code>{q.codeSnippet}</code>
                    </pre>
                  )}

                  {/* Options List */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                    {q.options?.map((opt, optIdx) => {
                      const isCorrect = q.correctOptionIds?.includes(opt.id);
                      const optLabel = String.fromCharCode(65 + optIdx);

                      return (
                        <div
                          key={opt.id}
                          className={`flex items-center gap-2 p-2 rounded-lg text-xs border ${
                            isCorrect
                              ? "bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold"
                              : "bg-slate-50 border-slate-200 text-slate-700"
                          }`}
                        >
                          <span
                            className={`w-5 h-5 rounded-md flex items-center justify-center font-bold text-[11px] ${
                              isCorrect
                                ? "bg-emerald-600 text-white"
                                : "bg-slate-200 text-slate-600"
                            }`}
                          >
                            {optLabel}
                          </span>
                          <span className="flex-1 truncate">{opt.text}</span>
                          {isCorrect && (
                            <span className="text-emerald-700 font-bold text-xs">
                              ✓ Correct
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {q.explanation && (
                    <div className="mt-2.5 text-[11px] text-slate-500 bg-slate-50 p-2 rounded border border-slate-100">
                      <strong>Explanation:</strong> {q.explanation}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit Question Modal / Drawer */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <h2 className="text-base font-bold text-slate-900">
                {editingQuestionId ? "Edit Question" : "Add New Question"}
              </h2>
              <button
                onClick={() => setIsEditorOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 mb-4 rounded-lg bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmitQuestion} className="space-y-4">
              {/* Question Type & Settings */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Question Type
                  </label>
                  <select
                    value={formType}
                    onChange={(e) =>
                      handleTypeChange(
                        e.target.value as "MULTIPLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER"
                      )
                    }
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium"
                  >
                    <option value="MULTIPLE_CHOICE">Multiple Choice</option>
                    <option value="TRUE_FALSE">True / False</option>
                    <option value="SHORT_ANSWER">Short Answer</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Time Limit (Sec)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={300}
                    value={formTimeLimit}
                    onChange={(e) => setFormTimeLimit(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Points
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={1000}
                    step={10}
                    value={formPoints}
                    onChange={(e) => setFormPoints(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              {/* Prompt Text */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Question Prompt *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Enter the question text..."
                  value={formPrompt}
                  onChange={(e) => setFormPrompt(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none font-medium"
                />
              </div>

              {/* Code Snippet (Optional) */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Code Snippet (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Optional code block to display with the question..."
                  value={formCodeSnippet}
                  onChange={(e) => setFormCodeSnippet(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-900 text-sky-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
                />
              </div>

              {/* Options & Correct Answer Selection */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Answer Options &amp; Correct Answer Selection
                  </label>
                  {formType === "MULTIPLE_CHOICE" && (
                    <button
                      type="button"
                      onClick={handleAddOption}
                      className="text-xs font-bold text-sky-600 hover:text-sky-800 cursor-pointer"
                    >
                      + Add Option
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {formOptions.map((opt, idx) => {
                    const isCorrect = formCorrectOptionIds.includes(opt.id);
                    const optLabel = String.fromCharCode(65 + idx);

                    return (
                      <div
                        key={opt.id}
                        className={`flex items-center gap-2 p-2 rounded-lg border ${
                          isCorrect
                            ? "bg-emerald-50/50 border-emerald-300"
                            : "bg-slate-50 border-slate-200"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => toggleCorrectOption(opt.id)}
                          title="Click to toggle as correct answer"
                          className={`w-6 h-6 rounded flex items-center justify-center font-bold text-xs shrink-0 cursor-pointer transition-colors ${
                            isCorrect
                              ? "bg-emerald-600 text-white shadow-xs"
                              : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                          }`}
                        >
                          {isCorrect ? "✓" : optLabel}
                        </button>

                        <input
                          type="text"
                          required
                          placeholder={`Option ${optLabel} text...`}
                          value={opt.text}
                          onChange={(e) => handleOptionChange(idx, e.target.value)}
                          className="flex-1 px-2.5 py-1 text-xs bg-white border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-900"
                        />

                        {formType === "MULTIPLE_CHOICE" && formOptions.length > 2 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveOption(idx)}
                            className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer text-xs"
                            title="Remove this option"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Explanation (Optional) */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Explanation (Shown on result release)
                </label>
                <textarea
                  rows={2}
                  placeholder="Explain why the marked answer is correct..."
                  value={formExplanation}
                  onChange={(e) => setFormExplanation(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  {isPending
                    ? "Saving..."
                    : editingQuestionId
                    ? "Update Question"
                    : "Add Question"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quiz Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <h2 className="text-base font-bold text-slate-900">Quiz Settings</h2>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveQuizSettings} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Quiz Title *
                </label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-900 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Room Code
                  </label>
                  <input
                    type="text"
                    required
                    value={editRoomCode}
                    onChange={(e) => setEditRoomCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 text-sm font-mono font-bold bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Default Timer (Sec)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={300}
                    value={editTimer}
                    onChange={(e) => setEditTimer(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-900"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  {isPending ? "Saving..." : "Save Settings"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
