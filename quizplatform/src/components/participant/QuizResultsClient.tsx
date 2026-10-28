"use client";

import Link from "next/link";
import { QuizAttemptResultPayload } from "@/lib/participant-quiz-service";

interface QuizResultsClientProps {
  data: QuizAttemptResultPayload;
  participantName: string;
  participantTeam: string | null;
  institution: string;
}

export default function QuizResultsClient({
  data,
  participantName,
  participantTeam,
  institution,
}: QuizResultsClientProps) {
  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s.toString().padStart(2, "0")}s`;
  };

  const accuracyPercent =
    data.answeredCount > 0
      ? Math.round((data.correctCount / data.answeredCount) * 100)
      : 0;

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 md:p-10 font-sans">
      {/* Top Banner */}
      <div className="bg-[#FFE600] border-4 border-black p-6 sm:p-8 shadow-[8px_8px_0px_#000] mb-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="inline-block bg-black text-[#FFE600] px-3 py-1 font-mono text-xs font-black uppercase">
            COMPETITION COMPLETED &bull; ROOM: {data.roomCode || "N/A"}
          </div>
          <div className="inline-block bg-white text-black px-3 py-1 font-mono text-xs font-black uppercase border-2 border-black shadow-[2px_2px_0px_#000]">
            {institution}
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black uppercase tracking-tight mb-2">
              Arena Accomplished!
            </h1>
            <p className="text-sm sm:text-base font-medium text-neutral-800">
              Candidate: <strong className="font-mono">{participantTeam || participantName}</strong> &bull; Quiz: <strong className="font-bold">{data.quizTitle}</strong>
            </p>
          </div>

          {/* Total Score Badge */}
          <div className="bg-white border-4 border-black p-4 sm:p-6 text-center shadow-[4px_4px_0px_#000] shrink-0">
            <div className="font-mono text-xs text-neutral-500 uppercase font-black">
              Total Score
            </div>
            <div className="font-mono font-black text-3xl sm:text-4xl text-black mt-0.5">
              {data.resultsReleased ? data.totalScore : "SEALED"}
            </div>
            <div className="font-mono text-[11px] text-neutral-600 mt-0.5">
              {data.resultsReleased ? `out of ${data.totalPossiblePoints} PTS` : "Scores Hidden"}
            </div>
          </div>
        </div>
      </div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border-3 border-black p-4 shadow-[4px_4px_0px_#000]">
          <div className="font-mono text-[10px] text-neutral-500 uppercase font-black">
            Questions Answered
          </div>
          <div className="font-mono font-black text-2xl text-black mt-1">
            {data.answeredCount} / {data.totalQuestions}
          </div>
          <div className="font-mono text-[11px] text-neutral-500 mt-0.5">All questions sealed</div>
        </div>

        <div className="bg-white border-3 border-black p-4 shadow-[4px_4px_0px_#000]">
          <div className="font-mono text-[10px] text-neutral-500 uppercase font-black">
            Elapsed Time
          </div>
          <div className="font-mono font-black text-2xl text-black mt-1">
            {formatTime(data.timeSpentSeconds)}
          </div>
          <div className="font-mono text-[11px] text-neutral-500 mt-0.5">Server recorded duration</div>
        </div>

        <div className="bg-white border-3 border-black p-4 shadow-[4px_4px_0px_#000]">
          <div className="font-mono text-[10px] text-neutral-500 uppercase font-black">
            Accuracy Rate
          </div>
          <div className="font-mono font-black text-2xl text-black mt-1">
            {data.resultsReleased ? `${accuracyPercent}%` : "PENDING"}
          </div>
          <div className="font-mono text-[11px] text-neutral-500 mt-0.5">
            {data.resultsReleased ? `${data.correctCount} correct answers` : "Awaiting release"}
          </div>
        </div>

        <div className="bg-white border-3 border-black p-4 shadow-[4px_4px_0px_#000]">
          <div className="font-mono text-[10px] text-neutral-500 uppercase font-black">
            Proctor Telemetry
          </div>
          <div className="font-mono font-black text-2xl text-black mt-1">
            {data.tabSwitchCount === 0 ? "CLEAR" : `${data.tabSwitchCount} FLAGS`}
          </div>
          <div className="font-mono text-[11px] text-neutral-500 mt-0.5">Tab switches logged</div>
        </div>
      </div>

      {/* Results Released vs Blinded Notification */}
      {!data.resultsReleased && (
        <div className="bg-[#00F0FF] border-4 border-black p-6 shadow-[6px_6px_0px_#000] mb-8">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">🔒</span>
            <h2 className="text-lg font-black uppercase tracking-tight">
              Detailed Scorecards Awaiting Release
            </h2>
          </div>
          <p className="text-xs sm:text-sm font-medium text-neutral-900 leading-relaxed">
            Your responses have been securely persisted on the server. The competition proctor will unlock detailed correct-answer breakdowns and final rankings once all campus participants have finished.
          </p>
        </div>
      )}

      {/* Top 10 Leaderboard (If Enabled by Admin) */}
      {data.leaderboard && data.leaderboard.length > 0 && (
        <div className="bg-white border-4 border-black p-6 sm:p-8 shadow-[8px_8px_0px_#000] mb-8">
          <div className="flex items-center justify-between pb-3 border-b-3 border-black mb-4">
            <div className="flex items-center gap-2">
              <span className="bg-[#FFE600] border-2 border-black px-2 py-0.5 font-mono text-xs font-black uppercase">
                TOP 10 LEADERBOARD
              </span>
              <h2 className="text-xl font-black uppercase tracking-tight">
                Campus Standings
              </h2>
            </div>
            <span className="font-mono text-xs font-bold text-neutral-600">
              Live Verified Rankings
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse font-sans text-xs sm:text-sm">
              <thead>
                <tr className="bg-black text-white font-mono uppercase text-xs">
                  <th className="py-2.5 px-3">Rank</th>
                  <th className="py-2.5 px-3">Team / Leader</th>
                  <th className="py-2.5 px-3">Institution</th>
                  <th className="py-2.5 px-3 text-right">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-black">
                {data.leaderboard.map((team) => {
                  const isCurrent =
                    team.userName === participantName ||
                    (participantTeam && team.teamName === participantTeam);

                  return (
                    <tr
                      key={team.rank}
                      className={`hover:bg-[#FFFDF8] transition-colors ${
                        isCurrent ? "bg-[#FFE600]/30 font-bold" : ""
                      }`}
                    >
                      <td className="py-3 px-3 font-mono font-black text-sm">
                        {team.rank === 1 ? (
                          <span className="inline-block bg-[#FFE600] border border-black px-1.5 py-0.2">
                            🥇 #1
                          </span>
                        ) : team.rank === 2 ? (
                          <span className="inline-block bg-neutral-200 border border-black px-1.5 py-0.2">
                            🥈 #2
                          </span>
                        ) : team.rank === 3 ? (
                          <span className="inline-block bg-[#FF90E8] border border-black px-1.5 py-0.2">
                            🥉 #3
                          </span>
                        ) : (
                          `#${team.rank}`
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-black text-black flex items-center gap-1.5">
                          <span>{team.teamName}</span>
                          {isCurrent && (
                            <span className="text-[10px] font-mono bg-black text-[#FFE600] px-1 rounded">
                              YOU
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-neutral-500 font-mono">
                          leader: {team.userName}
                        </div>
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-neutral-700">
                        {team.collegeName}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-black text-base text-black">
                        {team.score} PTS
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Question Breakdown (Only when resultsReleased === true) */}
      {data.resultsReleased && data.questionBreakdown && (
        <div className="space-y-4 mb-8">
          <h2 className="text-xl font-black uppercase tracking-tight mb-2">
            Detailed Question Breakdown
          </h2>

          {data.questionBreakdown.map((q, idx) => (
            <div
              key={q.questionId}
              className={`p-5 border-3 border-black shadow-[4px_4px_0px_#000] bg-white ${
                q.isCorrect
                  ? "border-l-8 border-l-emerald-500"
                  : "border-l-8 border-l-[#FF5C5C]"
              }`}
            >
              <div className="flex items-center justify-between pb-2 border-b border-black/20 gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 bg-black text-white font-mono font-bold text-xs flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <span
                    className={`font-mono text-xs font-black uppercase px-2 py-0.5 border border-black ${
                      q.isCorrect ? "bg-emerald-300 text-black" : "bg-[#FF5C5C] text-black"
                    }`}
                  >
                    {q.isCorrect ? "✓ CORRECT" : q.timedOut ? "⏱️ TIMED OUT" : "✕ INCORRECT"}
                  </span>
                </div>
                <span className="font-mono text-xs font-bold">
                  +{q.scoreAwarded} PTS
                </span>
              </div>

              <p className="text-base font-bold text-black mb-3">{q.questionText}</p>

              {q.codeSnippet && (
                <pre className="p-3 bg-black text-[#00F0FF] font-mono text-xs mb-3 overflow-x-auto">
                  <code>{q.codeSnippet}</code>
                </pre>
              )}

              {/* Options Breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                {q.options.map((opt, optIdx) => {
                  const optLabel = String.fromCharCode(65 + optIdx);
                  const isSelected = q.selectedOptionIds.includes(opt.id);
                  const isCorrectAnswer = q.correctOptionIds.includes(opt.id);

                  let badgeStyle = "bg-[#FFFDF8] border-neutral-300 text-neutral-700";
                  if (isCorrectAnswer) {
                    badgeStyle = "bg-emerald-100 border-black font-bold text-black";
                  } else if (isSelected && !isCorrectAnswer) {
                    badgeStyle = "bg-[#FF5C5C]/20 border-black font-bold text-black";
                  }

                  return (
                    <div
                      key={opt.id}
                      className={`flex items-center gap-2 p-2.5 border-2 text-xs font-sans ${badgeStyle}`}
                    >
                      <span className="w-5 h-5 bg-black text-white font-mono font-bold text-[10px] flex items-center justify-center shrink-0">
                        {optLabel}
                      </span>
                      <span className="flex-1">{opt.text}</span>
                      {isCorrectAnswer && (
                        <span className="text-emerald-700 font-mono font-bold text-[10px]">
                          ✓ Correct Key
                        </span>
                      )}
                      {isSelected && !isCorrectAnswer && (
                        <span className="text-rose-700 font-mono font-bold text-[10px]">
                          Your Choice
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {q.explanation && (
                <div className="mt-3 bg-neutral-100 border border-black p-2.5 font-mono text-xs text-neutral-800">
                  <strong>Explanation:</strong> {q.explanation}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Navigation Footer */}
      <div className="flex items-center justify-between pt-6 border-t-3 border-black">
        <Link
          href="/participant/dashboard"
          className="px-6 py-3 bg-black text-white font-bold uppercase text-xs border-3 border-black shadow-[3px_3px_0px_#000] hover:bg-neutral-800 transition-colors"
        >
          ← Return to Dashboard
        </Link>
      </div>
    </div>
  );
}
