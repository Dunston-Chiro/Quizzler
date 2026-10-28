import { redirect, notFound } from "next/navigation";
import { requireRole } from "@/lib/auth-guard";
import db from "@/db";
import { quizzes, participantAttempts } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  startOrResumeQuizAttempt,
  getAuthoritativeCurrentQuestion,
  ParticipantQuestionPayload,
} from "@/lib/participant-quiz-service";
import TimedQuizRunnerClient from "@/components/participant/TimedQuizRunnerClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ParticipantQuizRunnerPage({ params }: PageProps) {
  const session = await requireRole(
    ["PARTICIPANT", "ADMIN", "SUPER_ADMIN"],
    "/participant/dashboard"
  );
  const { id } = await params;

  // 1. Fetch quiz
  const [quiz] = await db
    .select()
    .from(quizzes)
    .where(eq(quizzes.id, id))
    .limit(1);

  if (!quiz) {
    notFound();
  }

  // 2. Fetch or initialize attempt
  let [attempt] = await db
    .select()
    .from(participantAttempts)
    .where(
      and(
        eq(participantAttempts.quizId, id),
        eq(participantAttempts.userId, session.userId)
      )
    )
    .limit(1);

  if (!attempt) {
    try {
      const initRes = await startOrResumeQuizAttempt(id, session);
      if (initRes.status === "COMPLETED") {
        redirect(`/participant/quiz/${id}/results`);
      }
      const [newAttempt] = await db
        .select()
        .from(participantAttempts)
        .where(eq(participantAttempts.id, initRes.attemptId))
        .limit(1);
      attempt = newAttempt;
    } catch {
      redirect(`/participant/quiz/${id}`);
    }
  }

  if (attempt.status === "COMPLETED") {
    redirect(`/participant/quiz/${id}/results`);
  }

  if (attempt.status === "DISQUALIFIED") {
    redirect(`/participant/dashboard?error=disqualified`);
  }

  // 3. Retrieve authoritative current question with timeout checks
  const questionPayload = await getAuthoritativeCurrentQuestion(attempt.id, session);

  if ("status" in questionPayload && questionPayload.status === "COMPLETED") {
    redirect(`/participant/quiz/${id}/results`);
  }

  const validPayload = questionPayload as ParticipantQuestionPayload;

  return (
    <TimedQuizRunnerClient
      initialPayload={validPayload}
      participantName={session.name}
      participantTeam={session.teamName || null}
      institution={session.collegeName || "BIMTECH"}
    />
  );
}
