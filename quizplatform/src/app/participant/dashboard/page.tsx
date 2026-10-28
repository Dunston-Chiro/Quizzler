import Link from "next/link";
import { requireRole } from "@/lib/auth-guard";
import { getParticipantQuizzes } from "@/lib/participant-quiz-service";
import RoomCodeJoinBar from "@/components/participant/RoomCodeJoinBar";

export default async function ParticipantDashboard() {
  const session = await requireRole(
    ["PARTICIPANT", "ADMIN", "SUPER_ADMIN"],
    "/participant/dashboard"
  );

  const availableQuizzes = await getParticipantQuizzes(session.userId);

  return (
    <main className="max-w-6xl w-full mx-auto p-4 sm:p-6 md:p-10 font-sans">
      {/* Top Welcome Banner */}
      <div className="bg-[#00F0FF] border-4 border-black p-6 sm:p-8 shadow-[8px_8px_0px_#000] mb-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="inline-block bg-black text-white px-3 py-1 font-mono text-xs uppercase font-bold border-2 border-black">
            Participant Arena &bull; Live Competition Engine
          </div>
          <div className="inline-block bg-white text-black px-3 py-1 font-mono text-xs font-black uppercase border-2 border-black shadow-[2px_2px_0px_#000]">
            Institution: {session.collegeName || "BIMTECH"}
          </div>
        </div>

        <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tight mb-2">
          {session.teamName ? `Team ${session.teamName}` : `Welcome, ${session.name}`}
        </h1>
        <p className="text-sm md:text-base font-medium text-neutral-900">
          Team Leader: <strong className="font-mono">{session.name}</strong> ({session.email}) &bull; Clearance: <strong className="font-mono uppercase">{session.role}</strong>
        </p>
      </div>

      {/* Room Code Quick Join Input */}
      <RoomCodeJoinBar />

      {/* Section: Available Quizzes */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight">
              Competition Arenas
            </h2>
            <span className="font-mono text-xs font-bold px-2 py-0.5 bg-black text-white rounded">
              {availableQuizzes.length}
            </span>
          </div>
          <span className="font-mono text-xs text-neutral-600 font-bold hidden sm:inline">
            Server-Authoritative Timing &bull; One-Way Sequential Progression
          </span>
        </div>

        {availableQuizzes.length === 0 ? (
          <div className="bg-white border-4 border-black p-8 shadow-[6px_6px_0px_#000] text-center">
            <div className="w-12 h-12 bg-[#FFE600] border-3 border-black text-black font-black text-2xl flex items-center justify-center mx-auto mb-3 shadow-[3px_3px_0px_#000]">
              !
            </div>
            <h3 className="text-lg font-black uppercase mb-1">
              No Live Stages Open Right Now
            </h3>
            <p className="text-sm font-medium text-neutral-600 max-w-md mx-auto">
              Event organizers have not launched any public competition stages yet. If your proctor provided a Room Code, use the box above to enter the lobby.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {availableQuizzes.map((quiz) => {
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
                    {/* Top Room & Status Tags */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="bg-[#FFE600] border-2 border-black px-2.5 py-0.5 font-mono text-xs font-black uppercase shadow-[2px_2px_0px_#000]">
                        ROOM: {quiz.roomCode || "N/A"}
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
                          UPCOMING
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
                      <Link
                        href={`/participant/quiz/${quiz.id}`}
                        className="w-full inline-block text-center bg-[#FFE600] text-black font-black uppercase tracking-wide py-2.5 border-3 border-black shadow-[3px_3px_0px_#000] hover:translate-x-0.5 hover:translate-y-0.5 active:translate-x-1 active:translate-y-1 transition-transform text-xs"
                      >
                        Enter Competition Arena →
                      </Link>
                    ) : (
                      <button
                        disabled
                        className="w-full bg-neutral-200 text-neutral-500 font-black uppercase tracking-wide py-2.5 border-3 border-neutral-400 text-xs cursor-not-allowed select-none"
                      >
                        {isScheduled ? "Lobby Locked (Waiting for Proctor)" : "Competition Ended"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Security & Rules Card */}
      <div className="bg-[#FF90E8] border-4 border-black p-6 shadow-[6px_6px_0px_#000] font-mono text-xs">
        <div className="font-black text-sm uppercase tracking-wider mb-2">
          🛡️ Exam &amp; Anti-Cheating Invariants
        </div>
        <ul className="list-disc list-inside space-y-1 text-neutral-900 font-medium">
          <li><strong>One-Way Progression:</strong> Questions are delivered sequentially. Once answered or timed out, you cannot revisit previous questions.</li>
          <li><strong>Server-Authoritative Clock:</strong> Timers are verified on the server. Refreshing the browser does not reset or pause the countdown.</li>
          <li><strong>Window &amp; Tab Telemetry:</strong> Switching tabs or minimizing the browser logs a violation event to the proctoring audit log.</li>
        </ul>
      </div>
    </main>
  );
}
