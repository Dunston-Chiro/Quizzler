"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { eq } from "drizzle-orm";
import db from "@/db";
import { quizzes } from "@/db/schema";
import {
  startOrResumeQuizAttempt,
  submitQuestionAnswer,
  recordParticipantProctorEvent,
  getAuthoritativeCurrentQuestion,
} from "@/lib/participant-quiz-service";
import { logActivity } from "@/lib/activity-log-service";

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

async function getRequiredParticipantSession() {
  const session = await getSession();
  if (!session) {
    throw new Error("UNAUTHORIZED: You must be logged in to access the quiz arena.");
  }
  return session;
}

export async function startQuizAttemptAction(
  quizId: string
): Promise<ActionResult<{ attemptId: string; status: string; message: string }>> {
  try {
    const session = await getRequiredParticipantSession();
    const result = await startOrResumeQuizAttempt(quizId, session);
    await logActivity({
      actorId: session.userId,
      actorRole: session.role,
      action: "PARTICIPANT_QUIZ_ENTERED",
      category: "QUIZ",
      targetEntity: "QUIZ",
      targetId: quizId,
      metadata: { attemptId: result.attemptId, status: result.status },
    });
    revalidatePath("/participant/dashboard");
    revalidatePath(`/participant/quiz/${quizId}/runner`);
    return { success: true, data: result };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to start quiz attempt.";
    return { success: false, error: msg };
  }
}

export async function submitAnswerAction(
  attemptId: string,
  questionId: string,
  selectedOptionIds: string[]
): Promise<ActionResult<{ isCompleted: boolean; nextIndex: number }>> {
  try {
    const session = await getRequiredParticipantSession();
    const result = await submitQuestionAnswer(
      attemptId,
      questionId,
      selectedOptionIds,
      session
    );
    if (result.isCompleted) {
      await logActivity({
        actorId: session.userId,
        actorRole: session.role,
        action: "PARTICIPANT_QUIZ_COMPLETED",
        category: "QUIZ",
        targetEntity: "PARTICIPANT_ATTEMPT",
        targetId: attemptId,
      });
    }
    return { success: true, data: result };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to submit answer.";
    return { success: false, error: msg };
  }
}

export async function reportProctorViolationAction(
  attemptId: string,
  eventType: "TAB_SWITCH" | "WINDOW_BLUR" | "FULLSCREEN_EXIT"
): Promise<ActionResult<{ tabSwitchCount: number }>> {
  try {
    const session = await getRequiredParticipantSession();
    const result = await recordParticipantProctorEvent(
      attemptId,
      eventType,
      { timestamp: new Date().toISOString() },
      session
    );
    return { success: true, data: { tabSwitchCount: result.tabSwitchCount } };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to record proctor telemetry.";
    return { success: false, error: msg };
  }
}

export async function joinQuizByRoomCodeAction(
  roomCode: string
): Promise<ActionResult<{ quizId: string }>> {
  try {
    await getRequiredParticipantSession();
    const normalizedCode = roomCode.trim().toUpperCase();

    const [quiz] = await db
      .select({ id: quizzes.id, sessionStatus: quizzes.sessionStatus })
      .from(quizzes)
      .where(eq(quizzes.roomCode, normalizedCode))
      .limit(1);

    if (!quiz) {
      return { success: false, error: `No competition found with Room Code "${normalizedCode}".` };
    }

    if (quiz.sessionStatus === "DRAFT") {
      return { success: false, error: "This competition room is not open for participants." };
    }

    return { success: true, data: { quizId: quiz.id } };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to join room.";
    return { success: false, error: msg };
  }
}

export async function getActiveQuestionAction(
  attemptId: string
): Promise<ActionResult<unknown>> {
  try {
    const session = await getRequiredParticipantSession();
    const result = await getAuthoritativeCurrentQuestion(attemptId, session);
    return { success: true, data: result };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to retrieve question.";
    return { success: false, error: msg };
  }
}
