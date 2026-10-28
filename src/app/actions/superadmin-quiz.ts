"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import {
  getAllQuizzesForSuperAdmin,
  getSuperAdminQuizInspection,
  superAdminUpdateQuestion,
  SuperAdminQuizSummary,
  QuizInspectionResult,
} from "@/lib/superadmin-quiz-service";
import { QuestionInput } from "@/lib/quiz-service";

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

async function getRequiredSuperAdminSession() {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") {
    throw new Error("UNAUTHORIZED: Super-Admin credentials required.");
  }
  return session;
}

export async function fetchSuperAdminQuizzesAction(): Promise<
  ActionResult<SuperAdminQuizSummary[]>
> {
  try {
    const session = await getRequiredSuperAdminSession();
    const result = await getAllQuizzesForSuperAdmin(session);
    return { success: true, data: result };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to fetch quizzes.";
    return { success: false, error: msg };
  }
}

export async function fetchSuperAdminQuizInspectionAction(
  quizId: string
): Promise<ActionResult<QuizInspectionResult | null>> {
  try {
    const session = await getRequiredSuperAdminSession();
    const result = await getSuperAdminQuizInspection(quizId, session);
    return { success: true, data: result };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to inspect quiz.";
    return { success: false, error: msg };
  }
}

export async function updateQuestionSuperAdminAction(
  questionId: string,
  input: Partial<QuestionInput>
): Promise<ActionResult> {
  try {
    const session = await getRequiredSuperAdminSession();
    const updated = await superAdminUpdateQuestion(questionId, input, session);
    revalidatePath("/super-admin/quizzes");
    revalidatePath("/super-admin/dashboard");
    return { success: true, data: updated };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update question.";
    return { success: false, error: msg };
  }
}
