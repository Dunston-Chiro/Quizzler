import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth-guard";
import db from "@/db";
import { quizzes, participantAttempts } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import QuizLobbyClient from "@/components/participant/QuizLobbyClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ParticipantQuizLobbyPage({ params }: PageProps) {
  const session = await requireRole(
    ["PARTICIPANT", "ADMIN", "SUPER_ADMIN"],
    "/participant/dashboard"
  );
  const { id } = await params;

  const [quiz] = await db
    .select()
    .from(quizzes)
    .where(eq(quizzes.id, id))
    .limit(1);

  if (!quiz) {
    notFound();
  }

  const [existingAttempt] = await db
    .select({
      id: participantAttempts.id,
      status: participantAttempts.status,
      currentQuestionIndex: participantAttempts.currentQuestionIndex,
    })
    .from(participantAttempts)
    .where(
      and(
        eq(participantAttempts.quizId, id),
        eq(participantAttempts.userId, session.userId)
      )
    )
    .limit(1);

  return (
    <main className="py-6 sm:py-10">
      <QuizLobbyClient
        quiz={{
          id: quiz.id,
          title: quiz.title,
          description: quiz.description,
          roomCode: quiz.roomCode,
          sessionStatus: quiz.sessionStatus,
          totalQuestions: quiz.totalQuestions,
          totalPoints: quiz.totalPoints,
          defaultTimePerQuestionSec: quiz.defaultTimePerQuestionSec,
          showTabSwitchCount: quiz.showTabSwitchCount,
        }}
        existingAttempt={existingAttempt || null}
        userName={session.name}
        userTeam={session.teamName || null}
        institution={session.collegeName || "BIMTECH"}
      />
    </main>
  );
}
