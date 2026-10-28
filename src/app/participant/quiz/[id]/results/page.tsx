import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth-guard";
import db from "@/db";
import { participantAttempts } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getParticipantResults } from "@/lib/participant-quiz-service";
import QuizResultsClient from "@/components/participant/QuizResultsClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ParticipantQuizResultsPage({ params }: PageProps) {
  const session = await requireRole(
    ["PARTICIPANT", "ADMIN", "SUPER_ADMIN"],
    "/participant/dashboard"
  );
  const { id } = await params;

  // Find user's attempt for this quiz
  const [attempt] = await db
    .select({ id: participantAttempts.id, status: participantAttempts.status })
    .from(participantAttempts)
    .where(
      and(
        eq(participantAttempts.quizId, id),
        eq(participantAttempts.userId, session.userId)
      )
    )
    .limit(1);

  if (!attempt) {
    redirect(`/participant/quiz/${id}`);
  }

  const resultsData = await getParticipantResults(attempt.id, session);

  return (
    <main className="py-6 sm:py-10">
      <QuizResultsClient
        data={resultsData}
        participantName={session.name}
        participantTeam={session.teamName || null}
        institution={session.collegeName || "BIMTECH"}
      />
    </main>
  );
}
