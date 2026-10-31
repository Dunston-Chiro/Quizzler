import Link from "next/link";
import { requireRole } from "@/lib/auth-guard";
import db from "@/db";
import { quizzes } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getSharedLiveQuizzes } from "@/lib/quiz-service";

export default async function AdminDashboardPage() {
  const session = await requireRole(["ADMIN", "SUPER_ADMIN"], "/login");

  // Fetch quizzes created by user (or all if super admin)
  let quizQuery = db
    .select({
      id: quizzes.id,
      title: quizzes.title,
      roomCode: quizzes.roomCode,
      sessionStatus: quizzes.sessionStatus,
      totalQuestions: quizzes.totalQuestions,
      totalPoints: quizzes.totalPoints,
      updatedAt: quizzes.updatedAt,
    })
    .from(quizzes)
    .$dynamic();

  if (session.role !== "SUPER_ADMIN") {
    quizQuery = quizQuery.where(eq(quizzes.createdBy, session.userId));
  }

  const userQuizzes = await quizQuery.orderBy(desc(quizzes.updatedAt)).limit(6);
  const sharedLiveQuizzes = await getSharedLiveQuizzes(session);

  // Active quiz or latest quiz for active room indicator (owned or shared)
  const activeQuiz =
    userQuizzes.find((q) => q.sessionStatus === "LIVE") ||
    userQuizzes[0] ||
    sharedLiveQuizzes.find((q) => q.sessionStatus === "LIVE") ||
    sharedLiveQuizzes[0];
  const activeRoomCode = activeQuiz?.roomCode || "STG2-BIM";

  return (
    <div className="flex flex-col flex-1 bg-white">
      {/* Top Welcome / Hero Banner */}
      <div className="border-b border-slate-200 px-6 py-5 bg-gradient-to-r from-sky-50 via-white to-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 text-[11px] font-bold uppercase tracking-wider mb-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-600 animate-pulse" />
            Live Competition Proctor
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Welcome back, {session.name}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Select a competition activity below to launch to Room{" "}
            <span className="font-mono font-bold text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200">
              {activeRoomCode}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/admin/quizzes"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg shadow-sm transition-colors"
          >
            <svg className="w-4 h-4 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Manage All Quizzes
          </Link>
          {activeQuiz && (
            <Link
              href={`/admin/quizzes/${activeQuiz.id}/live`}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs rounded-lg shadow-sm transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Go to Live Stage
            </Link>
          )}
        </div>
      </div>

      {/* Main Launchpad Grid */}
      <div className="flex-1 p-6 space-y-8 overflow-y-auto">
        {/* Section 1: Major Activities (Socrative 3-tile grid) */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Launch Activity
            </h2>
            <span className="text-[11px] text-slate-400">
              Starts a server-synchronized session in your active room
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* 1. Quiz Tile */}
            <Link
              href={activeQuiz ? `/admin/quizzes/${activeQuiz.id}/live` : "/admin/quizzes"}
              className="group p-6 rounded-2xl border-2 border-sky-100 hover:border-sky-400 bg-gradient-to-b from-sky-50/50 to-white shadow-2xs hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="w-12 h-12 rounded-xl bg-sky-500 text-white flex items-center justify-center mb-4 group-hover:scale-105 transition-transform shadow-xs">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-base font-bold text-slate-900 group-hover:text-sky-600 transition-colors">
                  Competition Quiz
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Deliver scheduled or spontaneous multi-question rounds with server-enforced timers.
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-sky-100 flex items-center justify-between text-xs font-bold text-sky-600">
                <span>{activeQuiz ? `Launch "${activeQuiz.title.slice(0, 20)}..."` : "Browse Quizzes"}</span>
                <span>→</span>
              </div>
            </Link>

            {/* 2. Space Race / Speed Sprint */}
            <Link
              href={activeQuiz ? `/admin/quizzes/${activeQuiz.id}/live` : "/admin/quizzes"}
              className="group p-6 rounded-2xl border-2 border-indigo-100 hover:border-indigo-400 bg-gradient-to-b from-indigo-50/50 to-white shadow-2xs hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="w-12 h-12 rounded-xl bg-indigo-500 text-white flex items-center justify-center mb-4 group-hover:scale-105 transition-transform shadow-xs">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                  Space Race / Speed Sprint
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Gamified live speed challenge. Participants advance across the screen as they answer correctly.
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-indigo-100 flex items-center justify-between text-xs font-bold text-indigo-600">
                <span>Launch Speed Stage</span>
                <span>→</span>
              </div>
            </Link>

            {/* 3. Exit Ticket / Candidate Selection */}
            <Link
              href="/admin/reports"
              className="group p-6 rounded-2xl border-2 border-emerald-100 hover:border-emerald-400 bg-gradient-to-b from-emerald-50/50 to-white shadow-2xs hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="w-12 h-12 rounded-xl bg-emerald-500 text-white flex items-center justify-center mb-4 group-hover:scale-105 transition-transform shadow-xs">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <h3 className="text-base font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">
                  Reports &amp; Round 2 Qualifiers
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Review participant scoring, proctoring flags, and select top candidates for the next round.
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-emerald-100 flex items-center justify-between text-xs font-bold text-emerald-600">
                <span>View Performance Reports</span>
                <span>→</span>
              </div>
            </Link>
          </div>
        </div>

        {/* Section 2: Quick Question Bar (Socrative Feature) */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Quick Question Injection
            </h2>
            <span className="text-[11px] text-slate-400">
              Inject a quick question directly to active participants
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Link
              href={activeQuiz ? `/admin/quizzes/${activeQuiz.id}/live` : "/admin/quizzes"}
              className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-sky-50/60 hover:border-sky-300 transition-all flex items-center gap-3.5 group"
            >
              <div className="w-10 h-10 rounded-lg bg-sky-100 text-sky-700 font-black text-sm flex items-center justify-center shrink-0 group-hover:bg-sky-500 group-hover:text-white transition-colors">
                MC
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-800 group-hover:text-sky-700">
                  Multiple Choice
                </h4>
                <p className="text-[11px] text-slate-500">A, B, C, D quick polling</p>
              </div>
            </Link>

            <Link
              href={activeQuiz ? `/admin/quizzes/${activeQuiz.id}/live` : "/admin/quizzes"}
              className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-emerald-50/60 hover:border-emerald-300 transition-all flex items-center gap-3.5 group"
            >
              <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 font-black text-sm flex items-center justify-center shrink-0 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                T/F
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-800 group-hover:text-emerald-700">
                  True / False
                </h4>
                <p className="text-[11px] text-slate-500">Binary verification</p>
              </div>
            </Link>

            <Link
              href={activeQuiz ? `/admin/quizzes/${activeQuiz.id}/live` : "/admin/quizzes"}
              className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-purple-50/60 hover:border-purple-300 transition-all flex items-center gap-3.5 group"
            >
              <div className="w-10 h-10 rounded-lg bg-purple-100 text-purple-700 font-black text-sm flex items-center justify-center shrink-0 group-hover:bg-purple-500 group-hover:text-white transition-colors">
                SA
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-800 group-hover:text-purple-700">
                  Short Answer
                </h4>
                <p className="text-[11px] text-slate-500">Freeform code or phrase</p>
              </div>
            </Link>
          </div>
        </div>

        {/* Section 3: Recent Quizzes & Live Stage Quick Access */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Recent Quizzes
            </h2>
            <Link
              href="/admin/quizzes"
              className="text-xs font-semibold text-sky-600 hover:text-sky-800"
            >
              View all ({userQuizzes.length}) →
            </Link>
          </div>

          {userQuizzes.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-slate-300 rounded-xl bg-slate-50">
              <p className="text-xs text-slate-500 mb-3">You haven&apos;t created any quizzes yet.</p>
              <Link
                href="/admin/quizzes"
                className="inline-block px-3.5 py-1.5 bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold rounded-lg transition-colors"
              >
                Create your first quiz
              </Link>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px] border-b border-slate-200">
                    <th className="py-2.5 px-4">Quiz Title</th>
                    <th className="py-2.5 px-4">Room</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4">Questions</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {userQuizzes.map((q) => (
                    <tr key={q.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {q.title}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-700">
                        {q.roomCode || "N/A"}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            q.sessionStatus === "LIVE"
                              ? "bg-emerald-100 text-emerald-800"
                              : q.sessionStatus === "SCHEDULED"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {q.sessionStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {q.totalQuestions} questions ({q.totalPoints} pts)
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        <Link
                          href={`/admin/quizzes/${q.id}`}
                          className="px-2.5 py-1 text-slate-600 hover:text-slate-900 border border-slate-200 rounded text-[11px] font-semibold hover:bg-white"
                        >
                          Edit Studio
                        </Link>
                        <Link
                          href={`/admin/quizzes/${q.id}/live`}
                          className="px-2.5 py-1 bg-sky-500 hover:bg-sky-600 text-white rounded text-[11px] font-bold shadow-2xs"
                        >
                          Launch
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Section 4: Shared Live Quizzes (View-Only Monitoring) */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-base">👁️</span>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Shared Live Quizzes
              </h2>
              <span className="bg-sky-100 text-sky-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                View-Only
              </span>
            </div>
            <span className="text-[11px] text-slate-400">
              Live quizzes shared by other organizers for proctor monitoring
            </span>
          </div>

          {sharedLiveQuizzes.length === 0 ? (
            <div className="p-6 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/60">
              <p className="text-xs text-slate-500 font-medium">
                No shared live quizzes from other organizers are active right now.
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                When another Admin enables &ldquo;Share live quiz with other Admins&rdquo;, it will appear here for observation.
              </p>
            </div>
          ) : (
            <div className="border border-sky-200 rounded-xl overflow-hidden shadow-2xs bg-gradient-to-r from-sky-50/30 via-white to-slate-50/30">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-sky-50/80 text-slate-600 uppercase font-bold text-[10px] border-b border-sky-200">
                    <th className="py-2.5 px-4">Quiz Title</th>
                    <th className="py-2.5 px-4">Organizer</th>
                    <th className="py-2.5 px-4">Room</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4">Scope</th>
                    <th className="py-2.5 px-4 text-right">Observation Mode</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sharedLiveQuizzes.map((q) => (
                    <tr key={q.id} className="hover:bg-sky-50/50 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {q.title}
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        <div className="font-semibold">{q.creatorName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{q.creatorEmail}</div>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-sky-700">
                        {q.roomCode || "N/A"}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                            q.sessionStatus === "LIVE"
                              ? "bg-emerald-100 text-emerald-800"
                              : q.sessionStatus === "SCHEDULED"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {q.sessionStatus === "LIVE" && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                          {q.sessionStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {q.totalQuestions} questions ({q.totalPoints} pts)
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          href={`/admin/quizzes/${q.id}/live`}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-white hover:bg-sky-50 text-sky-700 border border-sky-300 rounded text-[11px] font-bold shadow-2xs hover:border-sky-400 transition-colors"
                        >
                          <span>👁️</span> Monitor Live (View-Only) →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
