import Link from "next/link";
import { requireRole } from "@/lib/auth-guard";
import db from "@/db";
import { quizzes } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import {
  getLiveStageTelemetry,
  createQuiz,
  createQuestion,
} from "@/lib/quiz-service";
import LiveStageClient from "@/components/admin/LiveStageClient";

export default async function AdminLiveDefaultPage() {
  const session = await requireRole(["ADMIN", "SUPER_ADMIN"], "/login");

  // 1. Look for an active or recent quiz
  let query = db
    .select({ id: quizzes.id, sessionStatus: quizzes.sessionStatus })
    .from(quizzes)
    .$dynamic();

  if (session.role !== "SUPER_ADMIN") {
    query = query.where(eq(quizzes.createdBy, session.userId));
  }

  const userQuizzes = await query.orderBy(desc(quizzes.updatedAt)).limit(5);

  let targetQuizId = userQuizzes.find((q) => q.sessionStatus === "LIVE")?.id;
  if (!targetQuizId && userQuizzes.length > 0) {
    targetQuizId = userQuizzes[0].id;
  }

  // If no quiz exists at all, bootstrap a starter competition quiz
  if (!targetQuizId) {
    const newQuiz = await createQuiz(
      {
        title: "National Tech Challenge 2026 — Stage 1",
        description:
          "Live server-synchronized proctoring session for campus qualifiers.",
        roomCode: "STG2-BIM",
        defaultTimePerQuestionSec: 30,
      },
      session
    );

    // Add 3 starter competition questions
    await createQuestion(
      newQuiz.id,
      {
        questionText:
          "Which data structure operates on a First-In-First-Out (FIFO) discipline?",
        questionType: "MULTIPLE_CHOICE",
        options: [
          { id: "opt-1", text: "Stack" },
          { id: "opt-2", text: "Queue" },
          { id: "opt-3", text: "Binary Search Tree" },
          { id: "opt-4", text: "Priority Heap" },
        ],
        correctOptionIds: ["opt-2"],
        explanation: "Queues enforce FIFO ordering where elements leave in order of arrival.",
        points: 100,
        timeLimitSeconds: 30,
      },
      session
    );

    await createQuestion(
      newQuiz.id,
      {
        questionText:
          "What is the average time complexity of searching an element in a balanced Hash Table?",
        questionType: "MULTIPLE_CHOICE",
        options: [
          { id: "opt-1", text: "O(n)" },
          { id: "opt-2", text: "O(log n)" },
          { id: "opt-3", text: "O(1)" },
          { id: "opt-4", text: "O(n log n)" },
        ],
        correctOptionIds: ["opt-3"],
        explanation: "Hash tables achieve expected O(1) amortized lookup under uniform hashing.",
        points: 100,
        timeLimitSeconds: 30,
      },
      session
    );

    await createQuestion(
      newQuiz.id,
      {
        questionText:
          "In Next.js App Router, Server Components execute strictly on the server and do not add to client bundle size.",
        questionType: "TRUE_FALSE",
        options: [
          { id: "opt-1", text: "True" },
          { id: "opt-2", text: "False" },
        ],
        correctOptionIds: ["opt-1"],
        explanation: "React Server Components run only on the server, sending rendered HTML/RSC payload without shipping JS.",
        points: 100,
        timeLimitSeconds: 20,
      },
      session
    );

    targetQuizId = newQuiz.id;
  }

  const telemetry = await getLiveStageTelemetry(targetQuizId, session);

  if (!telemetry) {
    return (
      <div className="p-8 text-center max-w-md mx-auto my-12">
        <h2 className="text-xl font-bold text-slate-800 mb-2">No Active Stage</h2>
        <p className="text-slate-500 text-sm mb-6">
          You don&apos;t have any quizzes created yet. Create a quiz to launch the Live Stage.
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
