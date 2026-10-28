"use client";

import { useState, useEffect, useRef, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  submitAnswerAction,
  reportProctorViolationAction,
  getActiveQuestionAction,
} from "@/app/actions/participant-quiz";
import { ParticipantQuestionPayload } from "@/lib/participant-quiz-service";

interface TimedQuizRunnerClientProps {
  initialPayload: ParticipantQuestionPayload;
  participantName: string;
  participantTeam: string | null;
  institution: string;
}

export default function TimedQuizRunnerClient({
  initialPayload,
  participantName,
  participantTeam,
  institution,
}: TimedQuizRunnerClientProps) {
  const router = useRouter();
  const [currentData, setCurrentData] = useState<ParticipantQuestionPayload>(initialPayload);
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);
  const [timeRemaining, setTimeRemaining] = useState<number>(initialPayload.timeRemainingSeconds);
  const [tabViolations, setTabViolations] = useState<number>(initialPayload.tabSwitchCount);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [warningToast, setWarningToast] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Ref to track latest submission state to prevent double submits during timer expiry
  const submittingRef = useRef(false);
  useEffect(() => {
    submittingRef.current = isSubmitting;
  }, [isSubmitting]);

  const currentQuestion = currentData.question;
  const isLastQuestion = currentData.isLastQuestion;
  const totalQuestions = currentData.totalQuestions;
  const currentIndex = currentData.currentQuestionIndex;

  // 1. Submit Answer Function (Authoritative)
  const executeSubmit = useCallback(
    async (optionsToSubmit: string[]) => {
      if (submittingRef.current) return;
      submittingRef.current = true;
      setIsSubmitting(true);

      try {
        const res = await submitAnswerAction(
          currentData.attemptId,
          currentQuestion.id,
          optionsToSubmit
        );

        if (res.success && res.data) {
          if (res.data.isCompleted) {
            router.push(`/participant/quiz/${currentData.quizId}/results`);
            return;
          }

          // Fetch next question from server
          const nextRes = await getActiveQuestionAction(currentData.attemptId);
          if (nextRes.success && nextRes.data) {
            const nextPayload = nextRes.data as
              | { status: "COMPLETED" | "DISQUALIFIED"; attemptId: string; quizId: string }
              | ParticipantQuestionPayload;

            if ("status" in nextPayload && nextPayload.status === "COMPLETED") {
              router.push(`/participant/quiz/${currentData.quizId}/results`);
              return;
            }

            const validNext = nextPayload as ParticipantQuestionPayload;
            setCurrentData(validNext);
            setSelectedOptionIds([]);
            setTimeRemaining(validNext.timeRemainingSeconds);
            setTabViolations(validNext.tabSwitchCount);
          } else {
            router.push(`/participant/quiz/${currentData.quizId}/results`);
          }
        } else {
          alert(res.error || "Failed to submit response.");
        }
      } catch (err: unknown) {
        console.error("Submission error:", err);
      } finally {
        submittingRef.current = false;
        setIsSubmitting(false);
      }
    },
    [currentData.attemptId, currentData.quizId, currentQuestion.id, router]
  );

  // 2. Synchronized Countdown Timer
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // Automatic timer expiration
          if (!submittingRef.current) {
            executeSubmit(selectedOptionIds);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentQuestion.id, selectedOptionIds, executeSubmit]);

  // 3. Anti-Cheat Visibility & Blur Telemetry
  useEffect(() => {
    let violationTimeout: NodeJS.Timeout;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setTabViolations((v) => v + 1);
        setWarningToast("⚠️ Tab switch detected! Event logged to proctoring audit log.");

        startTransition(async () => {
          await reportProctorViolationAction(currentData.attemptId, "TAB_SWITCH");
        });

        violationTimeout = setTimeout(() => setWarningToast(null), 4000);
      }
    };

    const handleWindowBlur = () => {
      setTabViolations((v) => v + 1);
      setWarningToast("⚠️ Focus lost! Keep your browser in full focus.");

      startTransition(async () => {
        await reportProctorViolationAction(currentData.attemptId, "WINDOW_BLUR");
      });

      violationTimeout = setTimeout(() => setWarningToast(null), 4000);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
      clearTimeout(violationTimeout);
    };
  }, [currentData.attemptId]);

  // Handle Option Click
  const handleToggleOption = (optId: string) => {
    if (isSubmitting) return;

    if (currentQuestion.questionType === "MULTIPLE_CHOICE" || currentQuestion.questionType === "TRUE_FALSE") {
      // Single choice default
      setSelectedOptionIds([optId]);
    } else {
      setSelectedOptionIds((prev) =>
        prev.includes(optId) ? prev.filter((id) => id !== optId) : [...prev, optId]
      );
    }
  };

  const handleManualSubmit = () => {
    executeSubmit(selectedOptionIds);
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const isCriticalTime = timeRemaining <= 10;
  const progressPercent = Math.round(((currentIndex + 1) / totalQuestions) * 100);

  return (
    <div className="min-h-screen bg-[#FFFDF8] text-black font-sans pb-16 selection:bg-[#FFE600]">
      {/* Top Warning Banner if Violations Occur */}
      {warningToast && (
        <div className="bg-[#FF5C5C] text-black border-b-4 border-black px-4 py-2 text-center font-mono font-black text-xs shadow-md sticky top-0 z-50 animate-bounce">
          {warningToast}
        </div>
      )}

      {/* Top Arena Navigation Bar */}
      <header className="border-b-4 border-black bg-white px-4 md:px-8 py-3 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-[#FFE600] border-3 border-black px-3 py-1 font-black text-sm uppercase shadow-[2px_2px_0px_#000]">
              QUIZZLER
            </div>
            <div className="hidden sm:inline-block bg-black text-[#00F0FF] border-2 border-black px-2.5 py-0.5 font-mono text-xs font-bold uppercase">
              ROOM: {currentData.roomCode || "ARENA"}
            </div>
            <div className="hidden md:inline-block bg-[#00F0FF] border-2 border-black px-2.5 py-0.5 font-mono text-xs font-bold uppercase shadow-[2px_2px_0px_#000]">
              GUARD: TAB LOCK ON
            </div>
          </div>

          <div className="flex items-center gap-3 font-mono text-xs">
            <div className="hidden sm:block text-right">
              <div className="font-bold text-black uppercase">{participantTeam || participantName}</div>
              <div className="text-[10px] text-neutral-500">{institution}</div>
            </div>
            <div className="w-8 h-8 rounded-full bg-black text-[#FFE600] font-black text-xs flex items-center justify-center border-2 border-black">
              {participantName.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>
      </header>

      {/* Main Arena Container */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8">
        {/* Subheader: Progress & Critical Clock */}
        <div className="bg-white border-4 border-black p-4 sm:p-5 shadow-[6px_6px_0px_#000] mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            {/* Progress Column */}
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="bg-black text-[#FFE600] px-2 py-0.5 font-mono text-xs font-black uppercase">
                  QUESTION {currentIndex + 1} / {totalQuestions}
                </span>
                <span className="font-mono text-xs font-bold text-neutral-600">
                  ROUND: SPRINT
                </span>
              </div>
              <div className="text-xs font-mono font-bold text-neutral-700 mb-1.5">
                {currentIndex} COMPLETED &bull; {totalQuestions - currentIndex} REMAINING
              </div>
              {/* Neobrutalist Progress Bar */}
              <div className="w-full bg-neutral-200 border-2 border-black h-3.5 shadow-[2px_2px_0px_#000] overflow-hidden">
                <div
                  className="bg-[#00F0FF] h-full border-r-2 border-black transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Tab Violations Column */}
            <div className="text-center md:border-x-2 md:border-black px-2">
              <div className="inline-block bg-[#FFFDF8] border-2 border-black p-2 shadow-[2px_2px_0px_#000] w-full">
                <div className="font-mono text-[10px] text-neutral-500 uppercase font-black">
                  Proctoring Telemetry
                </div>
                <div className="font-mono font-black text-xs text-black mt-0.5">
                  ⚠️ Tab Switches:{" "}
                  <span
                    className={`px-1.5 py-0.2 rounded font-bold ${
                      tabViolations > 0 ? "bg-[#FF5C5C] text-black" : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {tabViolations} / 3 Flag
                  </span>
                </div>
              </div>
            </div>

            {/* Critical Clock Column */}
            <div className="flex items-center justify-end">
              <div
                className={`flex items-center gap-3 px-4 py-2 border-3 border-black shadow-[3px_3px_0px_#000] w-full sm:w-auto justify-center ${
                  isCriticalTime
                    ? "bg-[#FF5C5C] text-black animate-pulse"
                    : "bg-[#FFE600] text-black"
                }`}
              >
                <div>
                  <div className="font-mono text-[10px] uppercase font-bold tracking-wider leading-none">
                    CRITICAL CLOCK
                  </div>
                  <div className="font-mono font-black text-2xl tracking-tight leading-none mt-1">
                    {formatTimer(timeRemaining)} SEC
                  </div>
                </div>
                <div className="text-xl">⏱️</div>
              </div>
            </div>
          </div>
        </div>

        {/* Central Question Card */}
        <div className="bg-white border-4 border-black p-6 sm:p-10 shadow-[8px_8px_0px_#000] mb-6">
          {/* Metadata pill bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-4 mb-4 border-b-2 border-black font-mono text-xs">
            <div className="flex items-center gap-2">
              <span className="bg-neutral-100 border border-black px-2 py-0.5 font-bold">
                MODE: // VAULT-SPRINT/{String(currentIndex + 1).padStart(3, "0")}
              </span>
              <span className="bg-[#FF90E8] border border-black px-2 py-0.5 font-black uppercase shadow-[1px_1px_0px_#000]">
                {currentQuestion.questionType.replace("_", " ")}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-[#FFE600] border border-black px-2 py-0.5 font-black shadow-[1px_1px_0px_#000]">
                +{currentQuestion.points} PTS
              </span>
              <span className="bg-neutral-100 border border-black px-2 py-0.5 font-bold">
                LIMIT: {currentQuestion.timeLimitSeconds}S
              </span>
            </div>
          </div>

          {/* Prompt Section */}
          <div className="mb-6">
            <div className="font-mono text-xs font-black text-neutral-500 uppercase tracking-widest mb-1.5">
              {"// OBJECTIVE DECRYPT //"}
            </div>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-black leading-snug tracking-tight">
              {currentQuestion.questionText}
            </h2>

            {/* Code Snippet Block */}
            {currentQuestion.codeSnippet && (
              <pre className="mt-4 p-4 bg-black text-[#00F0FF] border-3 border-black font-mono text-xs sm:text-sm overflow-x-auto shadow-[4px_4px_0px_#000]">
                <code>{currentQuestion.codeSnippet}</code>
              </pre>
            )}
          </div>

          {/* Options Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
            {currentQuestion.options?.map((opt, optIdx) => {
              const optLabel = String.fromCharCode(65 + optIdx);
              const isSelected = selectedOptionIds.includes(opt.id);

              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleToggleOption(opt.id)}
                  disabled={isSubmitting}
                  className={`text-left p-4 border-3 border-black font-sans transition-all cursor-pointer flex items-start gap-3.5 ${
                    isSelected
                      ? "bg-[#FFE600] shadow-[5px_5px_0px_#000] translate-x-0.5 translate-y-0.5"
                      : "bg-[#FFFDF8] hover:bg-neutral-50 shadow-[3px_3px_0px_#000] active:translate-x-0.5 active:translate-y-0.5"
                  }`}
                >
                  <div
                    className={`w-7 h-7 shrink-0 font-mono font-black text-xs flex items-center justify-center border-2 border-black ${
                      isSelected ? "bg-black text-[#FFE600]" : "bg-neutral-200 text-black"
                    }`}
                  >
                    {optLabel}
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-sm text-black leading-snug">
                      {opt.text}
                    </div>
                    {isSelected && (
                      <span className="inline-block mt-1 font-mono text-[10px] font-black uppercase bg-black text-[#FFE600] px-1.5 py-0.2">
                        CHOICE LOCKED
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Bottom Actions Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-white border-4 border-black shadow-[6px_6px_0px_#000] mb-6">
          {/* Previous Locked Indicator (Linear Progression) */}
          <button
            type="button"
            disabled
            className="w-full sm:w-auto px-5 py-3 bg-neutral-200 border-2 border-neutral-400 text-neutral-500 font-mono text-xs font-bold uppercase cursor-not-allowed select-none"
          >
            🔒 PREVIOUS LOCKED [ONE-WAY PROGRESSION]
          </button>

          {/* Submit / Advance Button */}
          <button
            type="button"
            onClick={handleManualSubmit}
            disabled={isSubmitting || selectedOptionIds.length === 0}
            className="w-full sm:w-auto px-8 py-3 bg-[#FFE600] text-black font-black uppercase text-xs sm:text-sm tracking-wider border-3 border-black shadow-[4px_4px_0px_#000] hover:translate-x-0.5 hover:translate-y-0.5 active:translate-x-1 active:translate-y-1 transition-transform disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {isSubmitting
              ? "VERIFYING & RECORDING..."
              : isLastQuestion
              ? "SUBMIT & FINALIZE COMPETITION →"
              : "CONFIRM CHOICE & NEXT QUESTION →"}
          </button>
        </div>

        {/* Security Footer Notice */}
        <div className="bg-black text-[#00F0FF] border-3 border-black p-3 font-mono text-xs text-center shadow-[4px_4px_0px_#000]">
          <span className="font-black text-[#FFE600] uppercase">LOCK-SCREEN ACTIVE:</span> Do not switch tabs, exit window focus, or inspect elements. Response timestamps are server-authoritative.
        </div>
      </main>
    </div>
  );
}
