import Link from "next/link";
import { requireRole } from "@/lib/auth-guard";
import db from "@/db";
import { quizzes, participantAttempts, users } from "@/db/schema";
import { eq, desc, sql, or } from "drizzle-orm";

export default async function AdminReportsPage() {
  const session = await requireRole(["ADMIN", "SUPER_ADMIN"], "/login");

  // Fetch quizzes with attempt counts
  let query = db
    .select({
      id: quizzes.id,
      title: quizzes.title,
      roomCode: quizzes.roomCode,
      createdBy: quizzes.createdBy,
      creatorName: users.name,
      creatorEmail: users.email,
      sessionStatus: quizzes.sessionStatus,
      resultsReleased: quizzes.resultsReleased,
      isSharedWithAdmins: quizzes.isSharedWithAdmins,
      totalQuestions: quizzes.totalQuestions,
      totalPoints: quizzes.totalPoints,
      createdAt: quizzes.createdAt,
      attemptCount: sql<number>`count(${participantAttempts.id})::int`,
      avgScore: sql<number>`coalesce(round(avg(${participantAttempts.totalScore})), 0)::int`,
    })
    .from(quizzes)
    .innerJoin(users, eq(quizzes.createdBy, users.id))
    .leftJoin(participantAttempts, eq(quizzes.id, participantAttempts.quizId))
    .$dynamic();

  if (session.role !== "SUPER_ADMIN") {
    query = query.where(
      or(
        eq(quizzes.createdBy, session.userId),
        eq(quizzes.isSharedWithAdmins, true)
      )
    );
  }

  const reportItems = await query
    .groupBy(quizzes.id, users.name, users.email)
    .orderBy(desc(quizzes.createdAt));

  return (
    <div className="flex flex-col flex-1 bg-white">
      {/* Header */}
      <div className="border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Performance Reports &amp; Results
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit scores, accuracy rates, proctoring events, and inspect candidate activity.
          </p>
        </div>

        <Link
          href="/admin/live"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg shadow-xs transition-colors self-start sm:self-auto"
        >
          Open Live Stage
        </Link>
      </div>

      {/* Reports Table */}
      <div className="flex-1 p-6 overflow-y-auto">
        {reportItems.length === 0 ? (
          <div className="border border-dashed border-slate-300 rounded-xl p-12 text-center max-w-md mx-auto my-8">
            <h3 className="text-sm font-bold text-slate-800 mb-1">No reports available yet</h3>
            <p className="text-xs text-slate-500 mb-4">
              When participants take and submit quiz questions, aggregated telemetry and scoring reports will populate here.
            </p>
            <Link
              href="/admin/quizzes"
              className="inline-block px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white text-xs font-semibold rounded-lg"
            >
              Browse Quizzes
            </Link>
          </div>
        ) : (
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px] border-b border-slate-200">
                  <th className="py-3 px-4">Quiz / Competition</th>
                  <th className="py-3 px-4">Room Code</th>
                  <th className="py-3 px-4">Participants</th>
                  <th className="py-3 px-4">Average Score</th>
                  <th className="py-3 px-4">Results Released</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reportItems.map((item) => {
                  const isOwner = item.createdBy === session.userId || session.role === "SUPER_ADMIN";

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 flex items-center gap-2">
                          <span>{item.title}</span>
                          {!isOwner && (
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-300">
                              Shared by {item.creatorName}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {item.totalQuestions} Questions &bull; {item.totalPoints} Total Pts
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-sky-700">
                        {item.roomCode || "N/A"}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-800">{item.attemptCount}</span>
                        <span className="text-slate-400 ml-1">students</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-800">{item.avgScore}</span>
                        <span className="text-slate-400 ml-1">/ {item.totalPoints}</span>
                      </td>
                      <td className="py-3 px-4">
                        {item.resultsReleased ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            ✓ Public
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                            Hidden
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        <Link
                          href={`/admin/quizzes/${item.id}/live`}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold shadow-2xs inline-flex items-center gap-1 ${
                            isOwner
                              ? "bg-sky-500 hover:bg-sky-600 text-white"
                              : "bg-slate-900 hover:bg-slate-800 text-white"
                          }`}
                        >
                          <span>{isOwner ? "Telemetry & Qualifiers" : "Observe Telemetry"}</span>
                          <span>→</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
