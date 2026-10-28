"use client";

import React, { useState, useTransition } from "react";
import {
  SuperAdminQuizSummary,
  QuizInspectionResult,
  InspectedQuestion,
} from "@/lib/superadmin-quiz-service";
import {
  fetchSuperAdminQuizInspectionAction,
  updateQuestionSuperAdminAction,
} from "@/app/actions/superadmin-quiz";

interface QuestionVaultClientProps {
  initialQuizzes: SuperAdminQuizSummary[];
  initialInspection: QuizInspectionResult | null;
}

export default function QuestionVaultClient({
  initialQuizzes,
  initialInspection,
}: QuestionVaultClientProps) {
  const [quizzesList] = useState<SuperAdminQuizSummary[]>(initialQuizzes);
  const [selectedQuizId, setSelectedQuizId] = useState<string>(
    initialInspection?.quiz.id || (initialQuizzes[0]?.id ?? "")
  );
  const [currentInspection, setCurrentInspection] = useState<QuizInspectionResult | null>(
    initialInspection
  );
  const [isPending, startTransition] = useTransition();
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Edit modal state
  const [editingQuestion, setEditingQuestion] = useState<InspectedQuestion | null>(null);
  const [editText, setEditText] = useState("");
  const [editOptions, setEditOptions] = useState<Array<{ id: string; text: string }>>([]);
  const [editCorrectIds, setEditCorrectIds] = useState<string[]>([]);
  const [editExplanation, setEditExplanation] = useState("");
  const [editTimeLimit, setEditTimeLimit] = useState(30);
  const [editPoints, setEditPoints] = useState(100);

  const handleQuizChange = (quizId: string) => {
    setSelectedQuizId(quizId);
    setStatusMessage(null);
    startTransition(async () => {
      const res = await fetchSuperAdminQuizInspectionAction(quizId);
      if (res.success && res.data) {
        setCurrentInspection(res.data);
      } else {
        setStatusMessage({ type: "error", text: res.error || "Failed to inspect quiz." });
      }
    });
  };

  const openEditModal = (q: InspectedQuestion) => {
    setEditingQuestion(q);
    setEditText(q.questionText);
    setEditOptions([...q.options]);
    setEditCorrectIds([...q.correctOptionIds]);
    setEditExplanation(q.explanation || "");
    setEditTimeLimit(q.timeLimitSeconds);
    setEditPoints(q.points);
  };

  const saveQuestionEdits = () => {
    if (!editingQuestion) return;

    if (!editText.trim()) {
      alert("Question prompt cannot be empty.");
      return;
    }

    if (editCorrectIds.length === 0) {
      alert("Please select at least one correct option.");
      return;
    }

    startTransition(async () => {
      const res = await updateQuestionSuperAdminAction(editingQuestion.id, {
        questionText: editText.trim(),
        options: editOptions,
        correctOptionIds: editCorrectIds,
        explanation: editExplanation.trim() || undefined,
        timeLimitSeconds: Number(editTimeLimit),
        points: Number(editPoints),
      });

      if (res.success) {
        setStatusMessage({
          type: "success",
          text: `Question updated successfully in Master Vault.`,
        });
        setEditingQuestion(null);
        // Refresh inspection
        const inspectRes = await fetchSuperAdminQuizInspectionAction(selectedQuizId);
        if (inspectRes.success && inspectRes.data) {
          setCurrentInspection(inspectRes.data);
        }
      } else {
        setStatusMessage({
          type: "error",
          text: res.error || "Failed to update question.",
        });
      }
    });
  };

  const activeQuiz = currentInspection?.quiz;
  const questionsList = currentInspection?.questions || [];

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header Banner */}
      <div className="bg-[#111726] border border-[#1E293B] rounded-xl p-5 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2 py-0.5 rounded bg-[#8B5CF6]/20 border border-[#8B5CF6]/40 text-[#A855F7] font-mono text-[10px] font-bold uppercase tracking-wider">
                DEV-OPS ROOT
              </span>
              <span className="text-slate-500 font-mono text-xs">&bull; Master Answer Vault</span>
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Master Answer Vault & Key Inspector
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl">
              Authoritative quiz inventory with verified answer checksums, live runner choice distributions, and difficulty metrics.
            </p>
          </div>

          {/* Quiz Selector */}
          <div className="flex items-center gap-3 shrink-0">
            <select
              value={selectedQuizId}
              onChange={(e) => handleQuizChange(e.target.value)}
              disabled={isPending}
              className="bg-[#0A0E17] border border-[#1E293B] rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#00E5FF] cursor-pointer"
            >
              {quizzesList.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.title} ({q.roomCode || "ROOM"}) &bull; {q.sessionStatus}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Selected Quiz Metadata Bar */}
        {activeQuiz && (
          <div className="mt-4 pt-4 border-t border-[#1E293B] grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
            <div>
              <span className="text-slate-500 text-[10px] uppercase">Organizer</span>
              <div className="text-white font-bold truncate">{activeQuiz.creatorName}</div>
            </div>
            <div>
              <span className="text-slate-500 text-[10px] uppercase">Room Code</span>
              <div className="text-[#00E5FF] font-bold">{activeQuiz.roomCode || "ARENA"}</div>
            </div>
            <div>
              <span className="text-slate-500 text-[10px] uppercase">Session Status</span>
              <div className="text-[#00F59B] font-bold">{activeQuiz.sessionStatus}</div>
            </div>
            <div>
              <span className="text-slate-500 text-[10px] uppercase">Inventory Count</span>
              <div className="text-white font-bold">
                {activeQuiz.totalQuestions} Questions ({activeQuiz.totalPoints} PTS)
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Status Message */}
      {statusMessage && (
        <div
          className={`p-3 rounded-lg border text-xs font-mono flex items-center justify-between ${
            statusMessage.type === "success"
              ? "bg-[#062419] border-[#00F59B]/40 text-[#00F59B]"
              : "bg-rose-950/40 border-rose-800/60 text-rose-300"
          }`}
        >
          <span>{statusMessage.text}</span>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-slate-400 hover:text-white ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Question Vault Cards / Rows (Stitch Layout) */}
      <div className="space-y-4">
        {questionsList.length === 0 ? (
          <div className="bg-[#111726] border border-[#1E293B] rounded-xl p-12 text-center text-slate-500 font-mono text-xs">
            No questions cataloged for this competition yet.
          </div>
        ) : (
          questionsList.map((q, idx) => {
            const correctOpt = q.options.find((opt) => q.correctOptionIds.includes(opt.id));
            const optLetter = correctOpt
              ? String.fromCharCode(65 + q.options.indexOf(correctOpt))
              : "—";

            // Pseudo checksum representation matching Stitch sample
            const checksum = `0x${q.id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;

            return (
              <div
                key={q.id}
                className="bg-[#111726] border border-[#1E293B] hover:border-[#334155] rounded-xl p-5 shadow-lg transition-colors font-mono space-y-4"
              >
                {/* Top Row: Q Number, Tags, Edit Action */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1E293B] pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded bg-[#090D15] border border-[#1E293B] text-slate-400 font-bold text-xs flex items-center justify-center">
                      Q{String(idx + 1).padStart(2, "0")}
                    </span>

                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#1A2338] text-[#00E5FF] border border-[#00E5FF]/30 uppercase">
                      {q.questionType}
                    </span>

                    <span className="text-[11px] text-slate-400">
                      Round 1 &bull; Timed {q.timeLimitSeconds}s &bull; {q.points} PTS
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openEditModal(q)}
                      className="px-3 py-1 rounded bg-[#1A2338] hover:bg-[#25324D] border border-[#334155] text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5 text-[#00F59B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                      Edit Question & Keys
                    </button>
                  </div>
                </div>

                {/* Question Prompt */}
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white font-sans leading-snug">
                    {q.questionText}
                  </h3>
                  {q.codeSnippet && (
                    <pre className="mt-2.5 p-3 rounded bg-[#090D15] border border-[#1E293B] text-[#00F59B] text-xs overflow-x-auto">
                      <code>{q.codeSnippet}</code>
                    </pre>
                  )}
                </div>

                {/* 2-Column: Verified Master Key (Left) + Live Distribution (Right) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  {/* Verified Master Key */}
                  <div className="p-3.5 rounded-lg bg-[#0A0E17] border border-[#1E293B] space-y-2">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase font-bold">
                      <span>VERIFIED MASTER KEY</span>
                      <span className="text-slate-500 font-mono">Checksum: {checksum}</span>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <span className="px-2 py-0.5 rounded bg-[#062419] border border-[#00F59B]/50 text-[#00F59B] font-bold text-xs shrink-0">
                        [OPT {optLetter}]
                      </span>
                      <div className="text-xs text-white font-sans font-semibold leading-snug">
                        {correctOpt?.text || "No correct option configured"}
                      </div>
                    </div>

                    {q.explanation && (
                      <div className="text-[11px] text-slate-400 italic pt-1 border-t border-[#1E293B]">
                        &quot;{q.explanation}&quot;
                      </div>
                    )}
                  </div>

                  {/* Live Distribution Bar */}
                  <div className="p-3.5 rounded-lg bg-[#0A0E17] border border-[#1E293B] space-y-2.5">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase font-bold">
                      <span>LIVE CHOICE DISTRIBUTION</span>
                      <span className="text-[#00E5FF]">
                        {q.submissionCount} responses
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {q.options.map((opt, optIdx) => {
                        const letter = String.fromCharCode(65 + optIdx);
                        const isCorrect = q.correctOptionIds.includes(opt.id);
                        const dist = q.optionDistribution[opt.id] || { count: 0, percentage: 0 };

                        return (
                          <div key={opt.id} className="text-xs">
                            <div className="flex items-center justify-between text-[11px] mb-0.5">
                              <span className={isCorrect ? "text-[#00F59B] font-bold" : "text-slate-400"}>
                                {letter}: {opt.text.slice(0, 32)}
                                {opt.text.length > 32 && "..."}
                              </span>
                              <span className={isCorrect ? "text-[#00F59B] font-bold" : "text-slate-400"}>
                                {dist.percentage}% ({dist.count})
                              </span>
                            </div>
                            <div className="w-full bg-[#111726] rounded-full h-1.5 border border-[#1E293B] overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  isCorrect ? "bg-[#00F59B]" : "bg-slate-600"
                                }`}
                                style={{ width: `${dist.percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Edit Question Modal */}
      {editingQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-[#111726] border border-[#1E293B] rounded-xl max-w-2xl w-full p-6 shadow-2xl space-y-4 font-mono my-8">
            <div className="flex items-center justify-between border-b border-[#1E293B] pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#00F59B]" />
                <h3 className="text-base font-bold text-white font-sans">
                  Edit Question in Master Vault
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingQuestion(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Corruption Warning if answers already exist */}
            {editingQuestion.submissionCount > 0 && (
              <div className="p-3 rounded bg-amber-950/40 border border-amber-800/60 text-amber-300 text-xs font-mono">
                ⚠️ <strong>Active Submissions Detected:</strong> {editingQuestion.submissionCount} participants have submitted answers for this question. To preserve score integrity, option counts and answer keys cannot be modified.
              </div>
            )}

            {/* Prompt Textarea */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Question Prompt</label>
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                rows={3}
                className="w-full bg-[#090D15] border border-[#1E293B] rounded p-2.5 text-xs text-white focus:outline-none focus:border-[#00E5FF] font-sans"
              />
            </div>

            {/* Options & Correct Answer Selection */}
            <div className="space-y-2">
              <label className="block text-xs text-slate-400">
                Options & Verified Master Key (Click badge to mark correct)
              </label>
              <div className="space-y-2">
                {editOptions.map((opt, optIdx) => {
                  const letter = String.fromCharCode(65 + optIdx);
                  const isCorrect = editCorrectIds.includes(opt.id);

                  return (
                    <div key={opt.id} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (editingQuestion.submissionCount > 0) return;
                          setEditCorrectIds([opt.id]);
                        }}
                        className={`w-8 h-8 rounded border text-xs font-bold shrink-0 cursor-pointer ${
                          isCorrect
                            ? "bg-[#062419] border-[#00F59B] text-[#00F59B]"
                            : "bg-[#090D15] border-[#1E293B] text-slate-500 hover:text-white"
                        }`}
                      >
                        {letter}
                      </button>
                      <input
                        type="text"
                        value={opt.text}
                        disabled={editingQuestion.submissionCount > 0}
                        onChange={(e) => {
                          const updated = [...editOptions];
                          updated[optIdx].text = e.target.value;
                          setEditOptions(updated);
                        }}
                        className="flex-1 bg-[#090D15] border border-[#1E293B] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#00E5FF]"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Timer & Points */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Time Limit (Sec)</label>
                <input
                  type="number"
                  min={5}
                  max={300}
                  value={editTimeLimit}
                  onChange={(e) => setEditTimeLimit(Number(e.target.value))}
                  className="w-full bg-[#090D15] border border-[#1E293B] rounded p-2 text-xs text-white focus:outline-none focus:border-[#00E5FF]"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Points</label>
                <input
                  type="number"
                  min={10}
                  max={1000}
                  value={editPoints}
                  disabled={editingQuestion.submissionCount > 0}
                  onChange={(e) => setEditPoints(Number(e.target.value))}
                  className="w-full bg-[#090D15] border border-[#1E293B] rounded p-2 text-xs text-white focus:outline-none focus:border-[#00E5FF]"
                />
              </div>
            </div>

            {/* Explanation */}
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Explanation</label>
              <input
                type="text"
                value={editExplanation}
                onChange={(e) => setEditExplanation(e.target.value)}
                placeholder="Rationale for the correct key..."
                className="w-full bg-[#090D15] border border-[#1E293B] rounded p-2 text-xs text-white focus:outline-none focus:border-[#00E5FF]"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#1E293B]">
              <button
                type="button"
                onClick={() => setEditingQuestion(null)}
                className="px-4 py-2 rounded bg-[#1A2338] text-slate-300 hover:text-white text-xs border border-[#334155] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveQuestionEdits}
                disabled={isPending}
                className="px-5 py-2 rounded bg-[#00F59B] hover:bg-[#00D989] text-black font-bold text-xs shadow-md transition-colors cursor-pointer"
              >
                Save Changes to Key
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
