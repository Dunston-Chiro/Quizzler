"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { verifyQuizPasscodeAction } from "@/app/actions/participant-quiz";

export interface ArenaQuizItem {
  id: string;
  title: string;
  description: string | null;
  sessionStatus: "DRAFT" | "SCHEDULED" | "LIVE" | "ENDED";
  defaultTimePerQuestionSec: number;
  totalQuestions: number;
  totalPoints: number;
  resultsReleased: boolean;
  showLeaderboard: boolean;
  createdAt: Date | string;
  userAttempt?: {
    id: string;
    status: string;
    currentQuestionIndex: number;
    totalScore: number;
    completedAt: Date | null;
  } | null;
}

interface ArenaQuizListProps {
  quizzes: ArenaQuizItem[];
}

export default function ArenaQuizList({ quizzes }: ArenaQuizListProps) {
  const router = useRouter();
  const [selectedQuiz, setSelectedQuiz] = useState<ArenaQuizItem | null>(null);
  const [passcode, setPasscode] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleOpenPasscodeModal = (quiz: ArenaQuizItem) => {
    setSelectedQuiz(quiz);
    setPasscode("");
    setErrorMsg(null);
  };

  const handleCloseModal = () => {
    setSelectedQuiz(null);
    setPasscode("");
    setErrorMsg(null);
  };

  const handleVerifyPasscode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuiz || !passcode.trim()) return;

    setErrorMsg(null);
    startTransition(async () => {
      const res = await verifyQuizPasscodeAction(selectedQuiz.id, passcode.trim());
      if (res.success && res.data) {
        handleCloseModal();
        router.push(
          `/participant/quiz/${selectedQuiz.id}?code=${encodeURIComponent(res.data.roomCode)}`
        );
      } else {
        setErrorMsg(
          res.error || "Incorrect Room Code / Passcode. Please check with your proctor."
        );
      }
    });
  };

  if (quizzes.length === 0) {
    return (
      <div className="bg-white border-4 border-black p-8 shadow-[6px_6px_0px_#000] text-center">
        <div className="w-12 h-12 bg-[#FFE600] border-3 border-black text-black font-black text-2xl flex items-center justify-center mx-auto mb-3 shadow-[3px_3px_0px_#000]">
          !
        </div>
        <h3 className="text-lg font-black uppercase mb-1">
          No Live Stages Open Right Now
        </h3>
        <p className="text-sm font-medium text-neutral-600 max-w-md mx-auto">
          Event organizers have not published any competition stages to the Arena yet. If your proctor provided a direct Room Code, use the instant entrance box above.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {quizzes.map((quiz) => {
          const attempt = quiz.userAttempt;
          const isLive = quiz.sessionStatus === "LIVE";
          const isScheduled = quiz.sessionStatus === "SCHEDULED";
          const hasCompleted = attempt?.status === "COMPLETED";
          const isInProgress = attempt?.status === "IN_PROGRESS";

          return (
            <div
              key={quiz.id}
              className="bg-white border-4 border-black p-6 shadow-[6px_6px_0px_#000] flex flex-col justify-between"
            >
              <div>
                {/* Top Status & Security Badges (Passcode Protected, Never leaks Room Code) */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="bg-neutral-100 border-2 border-black px-2.5 py-0.5 font-mono text-xs font-black uppercase shadow-[2px_2px_0px_#000] flex items-center gap-1">
                    <span>🔒 PASSCODE REQUIRED</span>
                  </div>

                  {hasCompleted ? (
                    <span className="bg-[#FF90E8] border-2 border-black px-2.5 py-0.5 font-mono text-xs font-black uppercase shadow-[2px_2px_0px_#000]">
                      ✓ COMPLETED
                    </span>
                  ) : isInProgress ? (
                    <span className="bg-emerald-400 border-2 border-black px-2.5 py-0.5 font-mono text-xs font-black uppercase shadow-[2px_2px_0px_#000] animate-pulse">
                      ● IN PROGRESS
                    </span>
                  ) : isLive ? (
                    <span className="bg-emerald-300 border-2 border-black px-2.5 py-0.5 font-mono text-xs font-black uppercase shadow-[2px_2px_0px_#000]">
                      ● LIVE NOW
                    </span>
                  ) : isScheduled ? (
                    <span className="bg-[#00F0FF] border-2 border-black px-2.5 py-0.5 font-mono text-xs font-black uppercase shadow-[2px_2px_0px_#000]">
                      NOT STARTED
                    </span>
                  ) : (
                    <span className="bg-neutral-200 border-2 border-black px-2.5 py-0.5 font-mono text-xs font-bold uppercase">
                      ENDED
                    </span>
                  )}
                </div>

                <h3 className="text-xl font-black uppercase tracking-tight mb-2">
                  {quiz.title}
                </h3>
                <p className="text-xs font-medium text-neutral-700 mb-4 line-clamp-2">
                  {quiz.description || "Live synchronized academic quiz bowl."}
                </p>

                {/* Meta stats badges */}
                <div className="grid grid-cols-3 gap-2 bg-[#FFFDF8] border-2 border-black p-2.5 mb-5 text-center font-mono text-xs">
                  <div>
                    <div className="text-[10px] text-neutral-500 font-bold uppercase">Questions</div>
                    <div className="font-black text-sm">{quiz.totalQuestions}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-neutral-500 font-bold uppercase">Timer / Q</div>
                    <div className="font-black text-sm">{quiz.defaultTimePerQuestionSec}s</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-neutral-500 font-bold uppercase">Total Points</div>
                    <div className="font-black text-sm">{quiz.totalPoints}</div>
                  </div>
                </div>
              </div>

              {/* Actions Bar */}
              <div className="pt-4 border-t-2 border-black">
                {hasCompleted ? (
                  <Link
                    href={`/participant/quiz/${quiz.id}/results`}
                    className="w-full inline-block text-center bg-[#00F0FF] text-black font-black uppercase tracking-wide py-2.5 border-3 border-black shadow-[3px_3px_0px_#000] hover:translate-x-0.5 hover:translate-y-0.5 active:translate-x-1 active:translate-y-1 transition-transform text-xs"
                  >
                    View Scorecard &amp; Standings →
                  </Link>
                ) : isInProgress ? (
                  <Link
                    href={`/participant/quiz/${quiz.id}/runner`}
                    className="w-full inline-block text-center bg-emerald-400 text-black font-black uppercase tracking-wide py-2.5 border-3 border-black shadow-[3px_3px_0px_#000] hover:translate-x-0.5 hover:translate-y-0.5 active:translate-x-1 active:translate-y-1 transition-transform text-xs"
                  >
                    ⚡ Resume Active Quiz (Q{attempt.currentQuestionIndex + 1}) →
                  </Link>
                ) : isLive ? (
                  <button
                    type="button"
                    onClick={() => handleOpenPasscodeModal(quiz)}
                    className="w-full text-center bg-[#FFE600] text-black font-black uppercase tracking-wide py-2.5 border-3 border-black shadow-[3px_3px_0px_#000] hover:translate-x-0.5 hover:translate-y-0.5 active:translate-x-1 active:translate-y-1 transition-transform text-xs cursor-pointer"
                  >
                    Enter Competition Arena →
                  </button>
                ) : (
                  <button
                    disabled
                    className="w-full bg-neutral-200 text-neutral-500 font-black uppercase tracking-wide py-2.5 border-3 border-neutral-400 text-xs cursor-not-allowed select-none"
                  >
                    {isScheduled ? "Not Started (Lobby Locked)" : "Competition Ended"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Room Code / Passcode Prompt for Entering Live Arena */}
      {selectedQuiz && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white border-4 border-black p-6 sm:p-8 max-w-md w-full shadow-[10px_10px_0px_#000] relative animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between gap-2 border-b-3 border-black pb-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="bg-[#FFE600] border-2 border-black px-2 py-0.5 font-mono text-xs font-black uppercase">
                  PASSCODE REQUIRED
                </span>
                <span className="text-xs font-black uppercase tracking-wider text-neutral-600">
                  Arena Security Gate
                </span>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="w-7 h-7 bg-black text-white font-black text-sm flex items-center justify-center hover:bg-neutral-800 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <h3 className="text-xl font-black uppercase tracking-tight mb-2">
              {selectedQuiz.title}
            </h3>
            <p className="text-xs font-medium text-neutral-700 mb-5">
              To enter this live stage, please enter the competition Room Code / Passcode given to you by your proctor.
            </p>

            <form onSubmit={handleVerifyPasscode}>
              <div className="mb-4">
                <label className="block font-mono text-xs font-black uppercase mb-1">
                  Enter Room Code / Passcode
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="E.G. STG2-BIM..."
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value.toUpperCase())}
                  className="w-full bg-neutral-50 border-3 border-black px-4 py-2.5 font-mono font-black text-sm uppercase focus:outline-none focus:bg-[#FFE600]/20 shadow-[3px_3px_0px_#000]"
                />
              </div>

              {errorMsg && (
                <div className="p-3 bg-[#FF5C5C] border-2 border-black font-mono text-xs font-bold text-black shadow-[2px_2px_0px_#000] mb-4">
                  ⚠️ {errorMsg}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t-2 border-black">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 border-2 border-black font-mono text-xs font-black uppercase cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || !passcode.trim()}
                  className="px-6 py-2 bg-[#FFE600] text-black font-black uppercase tracking-wider border-3 border-black shadow-[3px_3px_0px_#000] hover:translate-x-0.5 hover:translate-y-0.5 active:translate-x-1 active:translate-y-1 transition-transform disabled:opacity-50 cursor-pointer text-xs"
                >
                  {isPending ? "Validating..." : "Verify & Enter Stage →"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
