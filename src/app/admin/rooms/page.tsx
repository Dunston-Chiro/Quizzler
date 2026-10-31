import Link from "next/link";
import { requireRole } from "@/lib/auth-guard";
import db from "@/db";
import { quizzes, users } from "@/db/schema";
import { eq, desc, or } from "drizzle-orm";

export default async function AdminRoomsPage() {
  const session = await requireRole(["ADMIN", "SUPER_ADMIN"], "/login");

  let query = db
    .select({
      id: quizzes.id,
      title: quizzes.title,
      roomCode: quizzes.roomCode,
      createdBy: quizzes.createdBy,
      creatorName: users.name,
      creatorEmail: users.email,
      sessionStatus: quizzes.sessionStatus,
      totalQuestions: quizzes.totalQuestions,
      isSharedWithAdmins: quizzes.isSharedWithAdmins,
      updatedAt: quizzes.updatedAt,
    })
    .from(quizzes)
    .innerJoin(users, eq(quizzes.createdBy, users.id))
    .$dynamic();

  if (session.role !== "SUPER_ADMIN") {
    query = query.where(
      or(
        eq(quizzes.createdBy, session.userId),
        eq(quizzes.isSharedWithAdmins, true)
      )
    );
  }

  const roomQuizzes = await query.orderBy(desc(quizzes.updatedAt));

  return (
    <div className="flex flex-col flex-1 bg-white">
      {/* Header */}
      <div className="border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Active Competition Rooms
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Share these room codes with students and participants to enter live sessions.
          </p>
        </div>

        <Link
          href="/admin/quizzes"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-sky-500 hover:bg-sky-600 text-white font-semibold text-xs rounded-lg shadow-xs transition-colors self-start sm:self-auto"
        >
          + Create Room / Quiz
        </Link>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 overflow-y-auto">
        {roomQuizzes.length === 0 ? (
          <div className="border border-dashed border-slate-300 rounded-xl p-12 text-center max-w-md mx-auto my-8">
            <h3 className="text-sm font-bold text-slate-800 mb-1">No rooms available</h3>
            <p className="text-xs text-slate-500 mb-4">
              Rooms are automatically created when you set up a competition quiz or when another organizer shares a quiz with you.
            </p>
            <Link
              href="/admin/quizzes"
              className="inline-block px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white text-xs font-semibold rounded-lg"
            >
              Go to Quiz Studio
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {roomQuizzes.map((quiz) => {
              const isOwner = quiz.createdBy === session.userId || session.role === "SUPER_ADMIN";

              return (
                <div
                  key={quiz.id}
                  className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs hover:shadow-md transition-shadow flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Room Access Code
                      </span>
                      <div className="flex items-center gap-1.5">
                        {!isOwner && quiz.isSharedWithAdmins && (
                          <span
                            className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-300"
                            title="Shared by another organizer in view-only mode"
                          >
                            Shared 👁️
                          </span>
                        )}
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            quiz.sessionStatus === "LIVE"
                              ? "bg-emerald-100 text-emerald-800 animate-pulse"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {quiz.sessionStatus === "LIVE" ? "ROOM LIVE" : "IDLE"}
                        </span>
                      </div>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center mb-3">
                      <div className="font-mono text-xl font-black text-slate-900 tracking-wider">
                        {quiz.roomCode || "N/A"}
                      </div>
                    </div>

                    <h3 className="text-xs font-bold text-slate-800 line-clamp-1 mb-1">
                      {quiz.title}
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      {quiz.totalQuestions} questions &bull; Server-timed
                    </p>

                    {!isOwner && (
                      <div className="text-[11px] text-slate-500 mt-2 truncate flex items-center gap-1">
                        <span className="font-semibold text-slate-600">Created by:</span>
                        <span className="font-bold text-slate-800">{quiz.creatorName}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 mt-4">
                    <Link
                      href={`/admin/quizzes/${quiz.id}`}
                      className="text-xs font-semibold text-slate-600 hover:text-slate-900"
                    >
                      {isOwner ? "Edit Questions" : "View Questions (View-Only)"}
                    </Link>

                    <Link
                      href={`/admin/quizzes/${quiz.id}/live`}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-2xs flex items-center gap-1 ${
                        isOwner
                          ? "bg-sky-500 hover:bg-sky-600 text-white"
                          : "bg-slate-900 hover:bg-slate-800 text-white"
                      }`}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {isOwner ? "Enter Live Stage" : "Observe Live Stage"}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
