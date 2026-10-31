import Link from "next/link";
import { requireRole } from "@/lib/auth-guard";
import db from "@/db";
import { quizzes } from "@/db/schema";
import { eq, desc, or, and } from "drizzle-orm";
import { getLiveStageTelemetry } from "@/lib/quiz-service";
import LiveStageClient from "@/components/admin/LiveStageClient";

export default async function AdminLiveDefaultPage() {
  const session = await requireRole(["ADMIN", "SUPER_ADMIN"], "/login");

  // 1. Look for an active LIVE quiz first:
  //    - Owned LIVE quiz has highest priority
  //    - Shared LIVE quiz has second priority
  let liveTargetId: string | null = null;

  if (session.role === "SUPER_ADMIN") {
    const [liveQuiz] = await db
      .select({ id: quizzes.id })
      .from(quizzes)
      .where(eq(quizzes.sessionStatus, "LIVE"))
      .orderBy(desc(quizzes.updatedAt))
      .limit(1);
    if (liveQuiz) liveTargetId = liveQuiz.id;
  } else {
    // Check owned LIVE quiz first
    const [ownedLiveQuiz] = await db
      .select({ id: quizzes.id })
      .from(quizzes)
      .where(
        and(
          eq(quizzes.createdBy, session.userId),
          eq(quizzes.sessionStatus, "LIVE")
        )
      )
      .orderBy(desc(quizzes.updatedAt))
      .limit(1);

    if (ownedLiveQuiz) {
      liveTargetId = ownedLiveQuiz.id;
    } else {
      // Check shared LIVE quiz
      const [sharedLiveQuiz] = await db
        .select({ id: quizzes.id })
        .from(quizzes)
        .where(
          and(
            eq(quizzes.isSharedWithAdmins, true),
            eq(quizzes.sessionStatus, "LIVE")
          )
        )
        .orderBy(desc(quizzes.updatedAt))
        .limit(1);

      if (sharedLiveQuiz) {
        liveTargetId = sharedLiveQuiz.id;
      }
    }
  }

  // 2. If no LIVE quiz is currently active, find the most recent owned or shared quiz
  let targetQuizId = liveTargetId;
  if (!targetQuizId) {
    let recentQuery = db
      .select({ id: quizzes.id })
      .from(quizzes)
      .$dynamic();

    if (session.role !== "SUPER_ADMIN") {
      recentQuery = recentQuery.where(
        or(
          eq(quizzes.createdBy, session.userId),
          eq(quizzes.isSharedWithAdmins, true)
        )
      );
    }

    const [mostRecentQuiz] = await recentQuery
      .orderBy(desc(quizzes.updatedAt))
      .limit(1);

    if (mostRecentQuiz) {
      targetQuizId = mostRecentQuiz.id;
    }
  }

  // 3. If no quiz exists at all in the system or shared with this admin, show empty state
  if (!targetQuizId) {
    return (
      <div className="p-8 text-center max-w-md mx-auto my-12">
        <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">No Active Stage</h2>
        <p className="text-slate-500 text-sm mb-6">
          No live or shared competition quizzes are active right now. You can create a quiz or ask another organizer to share their live session.
        </p>
        <Link
          href="/admin/quizzes"
          className="inline-block px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white font-semibold rounded-lg text-sm transition-colors"
        >
          Go to Quiz Studio
        </Link>
      </div>
    );
  }

  const telemetry = await getLiveStageTelemetry(targetQuizId, session);

  if (!telemetry) {
    return (
      <div className="p-8 text-center max-w-md mx-auto my-12">
        <h2 className="text-xl font-bold text-slate-800 mb-2">No Active Stage</h2>
        <p className="text-slate-500 text-sm mb-6">
          The selected quiz is unavailable or live monitoring access is not permitted.
        </p>
        <Link
          href="/admin/quizzes"
          className="inline-block px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white font-semibold rounded-lg text-sm transition-colors"
        >
          Go to Quiz Studio
        </Link>
      </div>
    );
  }

  return <LiveStageClient quizId={targetQuizId} initialData={telemetry} />;
}
