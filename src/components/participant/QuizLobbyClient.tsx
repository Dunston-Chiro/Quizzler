"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { startQuizAttemptAction } from "@/app/actions/participant-quiz";

interface QuizLobbyClientProps {
  quiz: {
    id: string;
    title: string;
    description: string | null;
    roomCode: string | null;
    sessionStatus: string;
    totalQuestions: number;
    totalPoints: number;
    defaultTimePerQuestionSec: number;
    showTabSwitchCount?: boolean;
  };
  existingAttempt: {
    id: string;
    status: string;
    currentQuestionIndex: number;
  } | null;
  userName: string;
  userTeam: string | null;
  institution: string;
}

export default function QuizLobbyClient({
  quiz,
  existingAttempt,
  userName,
  userTeam,
  institution,
}: QuizLobbyClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleStart = () => {
    setErrorMsg(null);
    startTransition(async () => {
      const res = await startQuizAttemptAction(quiz.id);
      if (res.success && res.data) {
        if (res.data.status === "COMPLETED") {
          router.push(`/participant/quiz/${quiz.id}/results`);
        } else {
          router.push(`/participant/quiz/${quiz.id}/runner`);
        }
      } else {
        setErrorMsg(res.error || "Failed to initialize quiz session.");
      }
    });
  };

  const isLive = quiz.sessionStatus === "LIVE";
  const hasCompleted = existingAttempt?.status === "COMPLETED";

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 md:p-10 font-sans">
      <div className="bg-white border-4 border-black p-6 sm:p-10 shadow-[8px_8px_0px_#000]">
        {/* Top Header Badge */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="inline-block bg-[#FFE600] border-2 border-black px-3 py-1 font-mono text-xs font-black uppercase shadow-[2px_2px_0px_#000]">
            ROOM CODE: {quiz.roomCode || "N/A"}
          </div>
          <div className="inline-block bg-black text-[#00F0FF] px-3 py-1 font-mono text-xs font-bold uppercase">
            STATUS: {quiz.sessionStatus}
          </div>
        </div>

        {/* Title & Description */}
        <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tight mb-3">
          {quiz.title}
        </h1>
        <p className="text-base text-neutral-700 font-medium mb-6">
          {quiz.description || "Live synchronized academic quiz bowl. Answer sequentially within the server-enforced countdown."}
        </p>

        {/* Competitor Banner */}
        <div className="bg-[#FFFDF8] border-3 border-black p-4 mb-6 shadow-[3px_3px_0px_#000] flex flex-wrap items-center justify-between gap-4 font-mono text-xs">
          <div>
            <div className="text-[10px] text-neutral-500 font-bold uppercase">Team / Candidate</div>
            <div className="font-black text-sm text-black">{userTeam || userName}</div>
          </div>
          <div>
            <div className="text-[10px] text-neutral-500 font-bold uppercase">Institution</div>
            <div className="font-black text-sm text-black">{institution}</div>
          </div>
          <div>
            <div className="text-[10px] text-neutral-500 font-bold uppercase">Total Scope</div>
            <div className="font-black text-sm text-black">{quiz.totalQuestions} Questions &bull; {quiz.totalPoints} PTS</div>
          </div>
        </div>

        {/* Examination Rules Card */}
        <div className="bg-[#00F0FF]/15 border-3 border-black p-5 mb-8">
          <h2 className="font-black text-sm uppercase tracking-wider mb-3 text-black">
            ⚡ Stage Protocols &amp; Instructions
          </h2>
          <ul className="space-y-2 text-xs font-medium text-neutral-900 font-mono">
            <li className="flex items-start gap-2">
              <span className="font-bold text-black shrink-0">1.</span>
              <span><strong>One Question at a Time:</strong> Questions appear in a randomized sequence. Once answered or timed out, you cannot revisit previous questions.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold text-black shrink-0">2.</span>
              <span><strong>{quiz.defaultTimePerQuestionSec}-Second Server Countdown:</strong> Each question carries an authoritative timer. When time expires, your choice is automatically sealed and the next question loads.</span>
            </li>
            {quiz.showTabSwitchCount ? (
              <>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-black shrink-0">3.</span>
                  <span><strong>Anti-Cheat Shield Active:</strong> Window blur and tab switching are logged to the proctoring monitor in real-time.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-black shrink-0">4.</span>
                  <span><strong>Disconnection Recovery:</strong> If your network drops or page reloads, re-entering resumes your active question and remaining time.</span>
                </li>
              </>
            ) : (
              <li className="flex items-start gap-2">
                <span className="font-bold text-black shrink-0">3.</span>
                <span><strong>Disconnection Recovery:</strong> If your network drops or page reloads, re-entering resumes your active question and remaining time.</span>
              </li>
            )}
          </ul>
        </div>

        {errorMsg && (
          <div className="mb-6 p-3 bg-[#FF5C5C] border-3 border-black font-mono text-xs font-bold text-black shadow-[3px_3px_0px_#000]">
            ⚠️ {errorMsg}
          </div>
        )}

        {/* Start / Action Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t-3 border-black">
          <Link
            href="/participant/dashboard"
            className="w-full sm:w-auto px-6 py-3 bg-white text-black font-bold uppercase text-xs border-3 border-black shadow-[3px_3px_0px_#000] hover:bg-neutral-100 transition-colors text-center"
          >
            ← Back to Dashboard
          </Link>

          {hasCompleted ? (
            <Link
              href={`/participant/quiz/${quiz.id}/results`}
              className="w-full sm:w-auto px-8 py-3 bg-[#00F0FF] text-black font-black uppercase text-xs border-3 border-black shadow-[4px_4px_0px_#000] hover:translate-x-0.5 hover:translate-y-0.5 active:translate-x-1 active:translate-y-1 transition-transform text-center"
            >
              View Scorecard &amp; Standings →
            </Link>
          ) : isLive ? (
            <button
              onClick={handleStart}
              disabled={isPending}
              className="w-full sm:w-auto px-8 py-3 bg-[#FFE600] text-black font-black uppercase text-xs tracking-wider border-3 border-black shadow-[4px_4px_0px_#000] hover:translate-x-0.5 hover:translate-y-0.5 active:translate-x-1 active:translate-y-1 transition-transform disabled:opacity-50 cursor-pointer"
            >
              {isPending
                ? "Connecting to Arena..."
                : existingAttempt
                ? "⚡ Resume Active Quiz →"
                : "Enter Competition Arena Now →"}
            </button>
          ) : (
            <button
              disabled
              className="w-full sm:w-auto px-8 py-3 bg-neutral-200 text-neutral-500 font-black uppercase text-xs border-3 border-neutral-400 cursor-not-allowed select-none"
            >
              Stage Locked (Waiting for Proctor Launch)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
