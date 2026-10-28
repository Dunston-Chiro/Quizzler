"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import {
  createQuiz,
  updateQuiz,
  deleteQuiz,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  reorderQuestions,
  updateQuizStatus,
  toggleResultVisibility,
  toggleLeaderboardVisibility,
  toggleAttemptQualification,
  QuestionInput,
  QuizInput,
} from "@/lib/quiz-service";

import db from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { logActivity } from "@/lib/activity-log-service";

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

async function getRequiredAdminSession() {
  const session = await getSession();
  if (!session) {
    throw new Error("UNAUTHORIZED: Session credentials required.");
  }

  // Fresh verification against PostgreSQL to prevent stale session privilege retention
  const [freshUser] = await db
    .select({
      role: users.role,
      isActive: users.isActive,
      isBlocked: users.isBlocked,
    })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  if (freshUser?.isBlocked) {
    throw new Error(
      "ACCOUNT_BLOCKED: Your administrator account has been suspended by a Super-Admin."
    );
  }

  if (
    !freshUser ||
    !freshUser.isActive ||
    (freshUser.role !== "ADMIN" && freshUser.role !== "SUPER_ADMIN")
  ) {
    throw new Error("UNAUTHORIZED: Admin or Super-Admin clearance required.");
  }

  session.role = freshUser.role;
  return session;
}

export async function createQuizAction(
  input: QuizInput
): Promise<ActionResult> {
  try {
    const session = await getRequiredAdminSession();
    const quiz = await createQuiz(input, session);
    await logActivity({
      actorId: session.userId,
      actorRole: session.role,
      action: "QUIZ_CREATED",
      category: "QUIZ",
      targetEntity: "QUIZ",
      targetId: quiz.id,
      targetLabel: quiz.title,
    });
    revalidatePath("/admin/quizzes");
    revalidatePath("/admin/dashboard");
    return { success: true, data: quiz };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to create quiz.";
    return { success: false, error: msg };
  }
}

export async function updateQuizAction(
  quizId: string,
  input: Partial<QuizInput>
): Promise<ActionResult> {
  try {
    const session = await getRequiredAdminSession();
    const updated = await updateQuiz(quizId, input, session);
    await logActivity({
      actorId: session.userId,
      actorRole: session.role,
      action: "QUIZ_UPDATED",
      category: "QUIZ",
      targetEntity: "QUIZ",
      targetId: quizId,
      targetLabel: updated?.title || "Quiz",
    });
    revalidatePath(`/admin/quizzes/${quizId}`);
    revalidatePath("/admin/quizzes");
    return { success: true, data: updated };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update quiz.";
    return { success: false, error: msg };
  }
}

export async function deleteQuizAction(
  quizId: string
): Promise<ActionResult> {
  try {
    const session = await getRequiredAdminSession();
    await deleteQuiz(quizId, session);
    await logActivity({
      actorId: session.userId,
      actorRole: session.role,
      action: "QUIZ_DELETED",
      category: "QUIZ",
      targetEntity: "QUIZ",
      targetId: quizId,
    });
    revalidatePath("/admin/quizzes");
    revalidatePath("/admin/dashboard");
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to delete quiz.";
    return { success: false, error: msg };
  }
}

export async function createQuestionAction(
  quizId: string,
  input: QuestionInput
): Promise<ActionResult> {
  try {
    const session = await getRequiredAdminSession();
    const newQuestion = await createQuestion(quizId, input, session);
    await logActivity({
      actorId: session.userId,
      actorRole: session.role,
      action: "QUESTION_CREATED",
      category: "QUIZ",
      targetEntity: "QUESTION",
      targetId: newQuestion.id,
      targetLabel: newQuestion.questionText.slice(0, 80),
    });
    revalidatePath(`/admin/quizzes/${quizId}`);
    revalidatePath(`/admin/quizzes/${quizId}/live`);
    return { success: true, data: newQuestion };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to create question.";
    return { success: false, error: msg };
  }
}

export async function updateQuestionAction(
  questionId: string,
  quizId: string,
  input: Partial<QuestionInput>
): Promise<ActionResult> {
  try {
    const session = await getRequiredAdminSession();
    const updated = await updateQuestion(questionId, input, session);
    await logActivity({
      actorId: session.userId,
      actorRole: session.role,
      action: "QUESTION_UPDATED",
      category: "QUIZ",
      targetEntity: "QUESTION",
      targetId: questionId,
      targetLabel: updated?.questionText ? updated.questionText.slice(0, 80) : "Question",
    });
    revalidatePath(`/admin/quizzes/${quizId}`);
    return { success: true, data: updated };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update question.";
    return { success: false, error: msg };
  }
}

export async function deleteQuestionAction(
  questionId: string,
  quizId: string
): Promise<ActionResult> {
  try {
    const session = await getRequiredAdminSession();
    await deleteQuestion(questionId, session);
    await logActivity({
      actorId: session.userId,
      actorRole: session.role,
      action: "QUESTION_DELETED",
      category: "QUIZ",
      targetEntity: "QUESTION",
      targetId: questionId,
    });
    revalidatePath(`/admin/quizzes/${quizId}`);
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to delete question.";
    return { success: false, error: msg };
  }
}

export async function reorderQuestionsAction(
  quizId: string,
  orderedIds: string[]
): Promise<ActionResult> {
  try {
    const session = await getRequiredAdminSession();
    await reorderQuestions(quizId, orderedIds, session);
    revalidatePath(`/admin/quizzes/${quizId}`);
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to reorder questions.";
    return { success: false, error: msg };
  }
}

export async function updateQuizStatusAction(
  quizId: string,
  newStatus: "DRAFT" | "SCHEDULED" | "LIVE" | "ENDED"
): Promise<ActionResult> {
  try {
    const session = await getRequiredAdminSession();
    const updated = await updateQuizStatus(quizId, newStatus, session);
    const actionName =
      newStatus === "LIVE"
        ? "QUIZ_LAUNCHED"
        : newStatus === "ENDED"
        ? "QUIZ_ENDED"
        : "QUIZ_STATUS_CHANGED";
    await logActivity({
      actorId: session.userId,
      actorRole: session.role,
      action: actionName,
      category: "QUIZ",
      targetEntity: "QUIZ",
      targetId: quizId,
      metadata: { newStatus },
    });
    revalidatePath(`/admin/quizzes/${quizId}`);
    revalidatePath(`/admin/quizzes/${quizId}/live`);
    revalidatePath("/admin/quizzes");
    return { success: true, data: updated };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update quiz status.";
    return { success: false, error: msg };
  }
}

export async function toggleResultVisibilityAction(
  quizId: string,
  resultsReleased: boolean
): Promise<ActionResult> {
  try {
    const session = await getRequiredAdminSession();
    const updated = await toggleResultVisibility(quizId, resultsReleased, session);
    await logActivity({
      actorId: session.userId,
      actorRole: session.role,
      action: resultsReleased ? "QUIZ_RESULTS_RELEASED" : "QUIZ_RESULTS_CONCEALED",
      category: "QUIZ",
      targetEntity: "QUIZ",
      targetId: quizId,
    });
    revalidatePath(`/admin/quizzes/${quizId}`);
    revalidatePath(`/admin/quizzes/${quizId}/live`);
    revalidatePath(`/participant/quiz/${quizId}/results`);
    return { success: true, data: updated };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to toggle result visibility.";
    return { success: false, error: msg };
  }
}

export async function toggleLeaderboardVisibilityAction(
  quizId: string,
  showLeaderboard: boolean
): Promise<ActionResult> {
  try {
    const session = await getRequiredAdminSession();
    const updated = await toggleLeaderboardVisibility(quizId, showLeaderboard, session);
    revalidatePath(`/admin/quizzes/${quizId}`);
    revalidatePath(`/admin/quizzes/${quizId}/live`);
    revalidatePath(`/participant/quiz/${quizId}/results`);
    return { success: true, data: updated };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to toggle leaderboard visibility.";
    return { success: false, error: msg };
  }
}

export async function toggleQualificationAction(
  attemptId: string,
  quizId: string,
  qualified: boolean
): Promise<ActionResult> {
  try {
    const session = await getRequiredAdminSession();
    const updated = await toggleAttemptQualification(attemptId, qualified, session);
    await logActivity({
      actorId: session.userId,
      actorRole: session.role,
      action: qualified ? "PARTICIPANT_QUALIFIED" : "PARTICIPANT_DISQUALIFIED_NEXT_ROUND",
      category: "QUIZ",
      targetEntity: "PARTICIPANT_ATTEMPT",
      targetId: attemptId,
      metadata: { quizId, qualified },
    });
    revalidatePath(`/admin/quizzes/${quizId}/live`);
    return { success: true, data: updated };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to toggle candidate qualification.";
    return { success: false, error: msg };
  }
}
