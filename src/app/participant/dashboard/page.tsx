import { requireRole } from "@/lib/auth-guard";
import { getParticipantQuizzes } from "@/lib/participant-quiz-service";
import RoomCodeJoinBar from "@/components/participant/RoomCodeJoinBar";
import ArenaQuizList from "@/components/participant/ArenaQuizList";

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

        {/* Competition Arenas Cards List */}
        <ArenaQuizList quizzes={availableQuizzes} />
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
