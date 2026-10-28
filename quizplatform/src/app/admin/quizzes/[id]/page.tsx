import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth-guard";
import { getQuizWithQuestions } from "@/lib/quiz-service";
import QuestionStudioClient from "@/components/admin/QuestionStudioClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminQuizDetailPage({ params }: PageProps) {
  const session = await requireRole(["ADMIN", "SUPER_ADMIN"], "/login");
  const { id } = await params;

  let result;
  try {
    result = await getQuizWithQuestions(id, session);
  } catch {
    // If forbidden by ownership or not found
    notFound();
  }

  if (!result || !result.quiz) {
    notFound();
  }

  const { quiz, questions } = result;

  return (
    <QuestionStudioClient
      quiz={{
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        roomCode: quiz.roomCode,
        sessionStatus: quiz.sessionStatus,
        resultsReleased: quiz.resultsReleased,
        defaultTimePerQuestionSec: quiz.defaultTimePerQuestionSec,
        totalQuestions: quiz.totalQuestions,
        totalPoints: quiz.totalPoints,
      }}
      initialQuestions={questions.map((q) => ({
        id: q.id,
        quizId: q.quizId,
        createdBy: q.createdBy,
        questionType: q.questionType as "MULTIPLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER",
        questionText: q.questionText,
        codeSnippet: q.codeSnippet,
        mediaUrl: q.mediaUrl,
        options: (q.options as Array<{ id: string; text: string }>) || [],
        correctOptionIds: (q.correctOptionIds as string[]) || [],
        explanation: q.explanation,
        points: q.points,
        timeLimitSeconds: q.timeLimitSeconds,
        orderIndex: q.orderIndex,
      }))}
      currentUserId={session.userId}
      currentUserRole={session.role}
    />
  );
}
