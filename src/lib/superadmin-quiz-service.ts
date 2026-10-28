import { eq, desc, asc } from "drizzle-orm";
import db from "@/db";
import {
  quizzes,
  questions,
  participantAnswers,
  users,
} from "@/db/schema";
import { SessionPayload } from "@/types/auth";
import { assertSuperAdminRole } from "@/lib/user-management-service";
import { logActivity } from "@/lib/activity-log-service";
import { QuestionInput } from "@/lib/quiz-service";

export interface SuperAdminQuizSummary {
  id: string;
  title: string;
  description: string | null;
  roomCode: string | null;
  createdBy: string;
  creatorName: string;
  creatorEmail: string;
  sessionStatus: "DRAFT" | "SCHEDULED" | "LIVE" | "ENDED";
  resultsReleased: boolean;
  showLeaderboard: boolean;
  defaultTimePerQuestionSec: number;
  totalQuestions: number;
  totalPoints: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface InspectedQuestion {
  id: string;
  quizId: string;
  questionText: string;
  questionType: string;
  codeSnippet: string | null;
  mediaUrl: string | null;
  options: Array<{ id: string; text: string }>;
  correctOptionIds: string[];
  explanation: string | null;
  points: number;
  timeLimitSeconds: number;
  orderIndex: number;
  submissionCount: number;
  optionDistribution: Record<string, { count: number; percentage: number }>;
}

export interface QuizInspectionResult {
  quiz: SuperAdminQuizSummary;
  questions: InspectedQuestion[];
}

/**
 * Returns all quizzes across all organizers for Super-Admin review.
 */
export async function getAllQuizzesForSuperAdmin(
  session: SessionPayload
): Promise<SuperAdminQuizSummary[]> {
  await assertSuperAdminRole(session);

  const rawQuizzes = await db
    .select({
      id: quizzes.id,
      title: quizzes.title,
      description: quizzes.description,
      roomCode: quizzes.roomCode,
      createdBy: quizzes.createdBy,
      creatorName: users.name,
      creatorEmail: users.email,
      sessionStatus: quizzes.sessionStatus,
      resultsReleased: quizzes.resultsReleased,
      showLeaderboard: quizzes.showLeaderboard,
      defaultTimePerQuestionSec: quizzes.defaultTimePerQuestionSec,
      totalQuestions: quizzes.totalQuestions,
      totalPoints: quizzes.totalPoints,
      createdAt: quizzes.createdAt,
      updatedAt: quizzes.updatedAt,
    })
    .from(quizzes)
    .innerJoin(users, eq(quizzes.createdBy, users.id))
    .orderBy(desc(quizzes.createdAt));

  return rawQuizzes;
}

/**
 * Consolidated inspection of a quiz, revealing all questions, options, verified master keys, and answer distributions.
 */
export async function getSuperAdminQuizInspection(
  quizId: string,
  session: SessionPayload
): Promise<QuizInspectionResult | null> {
  await assertSuperAdminRole(session);

  const [quiz] = await db
    .select({
      id: quizzes.id,
      title: quizzes.title,
      description: quizzes.description,
      roomCode: quizzes.roomCode,
      createdBy: quizzes.createdBy,
      creatorName: users.name,
      creatorEmail: users.email,
      sessionStatus: quizzes.sessionStatus,
      resultsReleased: quizzes.resultsReleased,
      showLeaderboard: quizzes.showLeaderboard,
      defaultTimePerQuestionSec: quizzes.defaultTimePerQuestionSec,
      totalQuestions: quizzes.totalQuestions,
      totalPoints: quizzes.totalPoints,
      createdAt: quizzes.createdAt,
      updatedAt: quizzes.updatedAt,
    })
    .from(quizzes)
    .innerJoin(users, eq(quizzes.createdBy, users.id))
    .where(eq(quizzes.id, quizId))
    .limit(1);

  if (!quiz) return null;

  // Fetch all questions for this quiz
  const rawQuestions = await db
    .select()
    .from(questions)
    .where(eq(questions.quizId, quizId))
    .orderBy(asc(questions.orderIndex));

  // Compute live option distribution from participant answers
  const inspectedQuestions: InspectedQuestion[] = [];

  for (const q of rawQuestions) {
    const answers = await db
      .select({ selectedOptionIds: participantAnswers.selectedOptionIds })
      .from(participantAnswers)
      .where(eq(participantAnswers.questionId, q.id));

    const totalSubmissions = answers.length;
    const distribution: Record<string, { count: number; percentage: number }> = {};

    const optionsList = (q.options as Array<{ id: string; text: string }>) || [];
    for (const opt of optionsList) {
      distribution[opt.id] = { count: 0, percentage: 0 };
    }

    for (const ans of answers) {
      const selected = (ans.selectedOptionIds as string[]) || [];
      for (const optId of selected) {
        if (!distribution[optId]) {
          distribution[optId] = { count: 0, percentage: 0 };
        }
        distribution[optId].count += 1;
      }
    }

    if (totalSubmissions > 0) {
      for (const optId of Object.keys(distribution)) {
        distribution[optId].percentage = Math.round(
          (distribution[optId].count / totalSubmissions) * 100
        );
      }
    }

    inspectedQuestions.push({
      id: q.id,
      quizId: q.quizId,
      questionText: q.questionText,
      questionType: q.questionType,
      codeSnippet: q.codeSnippet,
      mediaUrl: q.mediaUrl,
      options: optionsList,
      correctOptionIds: (q.correctOptionIds as string[]) || [],
      explanation: q.explanation,
      points: q.points,
      timeLimitSeconds: q.timeLimitSeconds,
      orderIndex: q.orderIndex,
      submissionCount: totalSubmissions,
      optionDistribution: distribution,
    });
  }

  return {
    quiz,
    questions: inspectedQuestions,
  };
}

/**
 * Superadmin update of a quiz question with corruption safeguards.
 */
export async function superAdminUpdateQuestion(
  questionId: string,
  input: Partial<QuestionInput>,
  session: SessionPayload
) {
  const superAdmin = await assertSuperAdminRole(session);

  const [question] = await db
    .select()
    .from(questions)
    .where(eq(questions.id, questionId))
    .limit(1);

  if (!question) throw new Error("NOT_FOUND: Question does not exist.");

  // Check if participants have already submitted answers
  const [existingAnswer] = await db
    .select({ id: participantAnswers.id })
    .from(participantAnswers)
    .where(eq(participantAnswers.questionId, questionId))
    .limit(1);

  if (existingAnswer && (input.options || input.correctOptionIds || input.points)) {
    throw new Error(
      "CORRUPTION_PREVENTION: Cannot alter options, correct answers, or points for a question that already has participant submissions. Historical scores and answer choices would be invalidated."
    );
  }

  const updateData: Record<string, unknown> = {};
  if (input.questionText !== undefined) updateData.questionText = input.questionText.trim();
  if (input.questionType !== undefined) updateData.questionType = input.questionType;
  if (input.codeSnippet !== undefined) updateData.codeSnippet = input.codeSnippet.trim() || null;
  if (input.mediaUrl !== undefined) updateData.mediaUrl = input.mediaUrl.trim() || null;
  if (input.options !== undefined) updateData.options = input.options;
  if (input.correctOptionIds !== undefined) updateData.correctOptionIds = input.correctOptionIds;
  if (input.explanation !== undefined) updateData.explanation = input.explanation.trim() || null;
  if (input.timeLimitSeconds !== undefined) updateData.timeLimitSeconds = input.timeLimitSeconds;
  if (input.points !== undefined) updateData.points = input.points;

  const [updated] = await db
    .update(questions)
    .set(updateData)
    .where(eq(questions.id, questionId))
    .returning();

  // Audit log with safe summary (never copy raw correct answers or secret keys to generic metadata)
  await logActivity({
    actorId: superAdmin.id,
    actorRole: "SUPER_ADMIN",
    action: "QUESTION_UPDATED",
    category: "QUIZ",
    targetEntity: "QUESTION",
    targetId: questionId,
    targetLabel: updated.questionText.slice(0, 80),
    metadata: {
      modifiedFields: Object.keys(updateData),
      quizId: question.quizId,
    },
  });

  return updated;
}
