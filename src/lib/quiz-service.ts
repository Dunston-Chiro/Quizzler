import { eq, and, sql, desc, asc } from "drizzle-orm";
import db from "@/db";
import {
  quizzes,
  questions,
  participantAttempts,
  participantAnswers,
  proctoringEvents,
  users,
  Quiz,
  Question,
} from "@/db/schema";
import { SessionPayload } from "@/types/auth";

export interface QuestionInput {
  questionText: string;
  questionType?: "MULTIPLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER";
  codeSnippet?: string;
  mediaUrl?: string;
  options: Array<{ id: string; text: string }>;
  correctOptionIds: string[];
  explanation?: string;
  points?: number;
  timeLimitSeconds?: number;
  orderIndex?: number;
}

export interface QuizInput {
  title: string;
  description?: string;
  defaultTimePerQuestionSec?: number;
  shuffleQuestions?: boolean;
  showTabSwitchCount?: boolean;
  roomCode?: string;
}

/**
 * Helper to generate a room code like STG2-BIM or QZ-942
 */
export function generateRoomCode(prefix = "QZ"): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 4; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}-${suffix}`;
}

/**
 * Asserts that the caller is an ADMIN or SUPER_ADMIN
 */
export function assertAdminRole(session: SessionPayload): void {
  if (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN") {
    throw new Error("UNAUTHORIZED_ROLE: Requires ADMIN or SUPER_ADMIN clearance.");
  }
}

/**
 * Asserts ownership: Super-admin can access anything; Admin can only access their own.
 */
export function assertOwnership(
  ownerId: string,
  session: SessionPayload,
  resourceName = "Resource"
): void {
  assertAdminRole(session);
  if (session.role === "SUPER_ADMIN") return;
  if (ownerId !== session.userId) {
    throw new Error(
      `ACCESS_DENIED: You do not have permission to manage this ${resourceName}. It belongs to another organizer.`
    );
  }
}

/**
 * 1. Get Quizzes for Admin (Owned only, or all for Super-Admin)
 */
export async function getAdminQuizzes(session: SessionPayload) {
  assertAdminRole(session);

  let query = db
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
      showTabSwitchCount: quizzes.showTabSwitchCount,
      defaultTimePerQuestionSec: quizzes.defaultTimePerQuestionSec,
      totalQuestions: quizzes.totalQuestions,
      totalPoints: quizzes.totalPoints,
      createdAt: quizzes.createdAt,
      updatedAt: quizzes.updatedAt,
    })
    .from(quizzes)
    .innerJoin(users, eq(quizzes.createdBy, users.id))
    .$dynamic();

  if (session.role !== "SUPER_ADMIN") {
    query = query.where(eq(quizzes.createdBy, session.userId));
  }

  return await query.orderBy(desc(quizzes.createdAt));
}

/**
 * 2. Get Single Quiz with Questions (Restricted to owner or super-admin)
 */
export async function getQuizWithQuestions(
  quizId: string,
  session: SessionPayload
) {
  assertAdminRole(session);

  const [quiz] = await db
    .select()
    .from(quizzes)
    .where(eq(quizzes.id, quizId))
    .limit(1);

  if (!quiz) {
    return null;
  }

  // Strict ownership check
  assertOwnership(quiz.createdBy, session, "Quiz");

  // Fetch questions
  const quizQuestions = await db
    .select()
    .from(questions)
    .where(eq(questions.quizId, quizId))
    .orderBy(asc(questions.orderIndex));

  return { quiz, questions: quizQuestions };
}

/**
 * 3. Create Quiz
 */
export async function createQuiz(input: QuizInput, session: SessionPayload) {
  assertAdminRole(session);

  if (!input.title || input.title.trim().length < 2) {
    throw new Error("VALIDATION_ERROR: Quiz title must be at least 2 characters long.");
  }

  const roomCode = input.roomCode?.trim().toUpperCase() || generateRoomCode();

  const [newQuiz] = await db
    .insert(quizzes)
    .values({
      title: input.title.trim(),
      description: input.description?.trim() || null,
      roomCode,
      createdBy: session.userId,
      sessionStatus: "DRAFT",
      resultsReleased: false,
      showTabSwitchCount: input.showTabSwitchCount || false,
      defaultTimePerQuestionSec: input.defaultTimePerQuestionSec || 30,
      shuffleQuestions: input.shuffleQuestions || false,
      totalQuestions: 0,
      totalPoints: 0,
    })
    .returning();

  return newQuiz;
}

/**
 * 4. Update Quiz
 */
export async function updateQuiz(
  quizId: string,
  input: Partial<QuizInput>,
  session: SessionPayload
) {
  assertAdminRole(session);

  const [quiz] = await db
    .select()
    .from(quizzes)
    .where(eq(quizzes.id, quizId))
    .limit(1);

  if (!quiz) throw new Error("NOT_FOUND: Quiz does not exist.");
  assertOwnership(quiz.createdBy, session, "Quiz");

  const updateData: Partial<Quiz> = {
    updatedAt: new Date(),
  };

  if (input.title !== undefined) updateData.title = input.title.trim();
  if (input.description !== undefined) updateData.description = input.description.trim();
  if (input.defaultTimePerQuestionSec !== undefined) {
    updateData.defaultTimePerQuestionSec = input.defaultTimePerQuestionSec;
  }
  if (input.shuffleQuestions !== undefined) {
    updateData.shuffleQuestions = input.shuffleQuestions;
  }
  if (input.showTabSwitchCount !== undefined) {
    updateData.showTabSwitchCount = input.showTabSwitchCount;
  }
  if (input.roomCode !== undefined) {
    updateData.roomCode = input.roomCode.trim().toUpperCase();
  }

  const [updated] = await db
    .update(quizzes)
    .set(updateData)
    .where(eq(quizzes.id, quizId))
    .returning();

  return updated;
}

/**
 * 5. Delete Quiz (Must own quiz; cannot delete if active attempts exist)
 */
export async function deleteQuiz(quizId: string, session: SessionPayload) {
  assertAdminRole(session);

  const [quiz] = await db
    .select()
    .from(quizzes)
    .where(eq(quizzes.id, quizId))
    .limit(1);

  if (!quiz) throw new Error("NOT_FOUND: Quiz does not exist.");
  assertOwnership(quiz.createdBy, session, "Quiz");

  if (quiz.sessionStatus === "LIVE") {
    throw new Error("CORRUPTION_PREVENTION: Cannot delete a quiz that is currently LIVE.");
  }

  // Check if participant attempts exist
  const [attempt] = await db
    .select({ id: participantAttempts.id })
    .from(participantAttempts)
    .where(eq(participantAttempts.quizId, quizId))
    .limit(1);

  if (attempt) {
    throw new Error(
      "CORRUPTION_PREVENTION: Cannot delete a quiz with historical or active participant attempts."
    );
  }

  await db.delete(quizzes).where(eq(quizzes.id, quizId));
  return { success: true };
}

/**
 * 6. Create Question in Quiz (Must own parent quiz; sets createdBy to current admin)
 */
export async function createQuestion(
  quizId: string,
  input: QuestionInput,
  session: SessionPayload
) {
  assertAdminRole(session);

  const [quiz] = await db
    .select()
    .from(quizzes)
    .where(eq(quizzes.id, quizId))
    .limit(1);

  if (!quiz) throw new Error("NOT_FOUND: Quiz does not exist.");
  assertOwnership(quiz.createdBy, session, "Quiz");

  if (!input.questionText || input.questionText.trim().length < 2) {
    throw new Error("VALIDATION_ERROR: Question prompt is required.");
  }

  if (!input.options || input.options.length < 2) {
    throw new Error("VALIDATION_ERROR: At least 2 options are required.");
  }

  if (!input.correctOptionIds || input.correctOptionIds.length === 0) {
    throw new Error("VALIDATION_ERROR: At least one correct option must be selected.");
  }

  // Determine order index
  let orderIndex = input.orderIndex;
  if (orderIndex === undefined) {
    const [maxOrder] = await db
      .select({ max: sql<number>`COALESCE(MAX(${questions.orderIndex}), 0)` })
      .from(questions)
      .where(eq(questions.quizId, quizId));
    orderIndex = (maxOrder?.max ?? 0) + 1;
  }

  const points = input.points ?? 100;
  const timeLimit = input.timeLimitSeconds ?? quiz.defaultTimePerQuestionSec ?? 30;

  const [newQuestion] = await db
    .insert(questions)
    .values({
      quizId,
      createdBy: session.userId,
      questionType: input.questionType || "MULTIPLE_CHOICE",
      questionText: input.questionText.trim(),
      codeSnippet: input.codeSnippet?.trim() || null,
      mediaUrl: input.mediaUrl?.trim() || null,
      options: input.options,
      correctOptionIds: input.correctOptionIds,
      explanation: input.explanation?.trim() || null,
      points,
      timeLimitSeconds: timeLimit,
      orderIndex,
    })
    .returning();

  // Update quiz aggregates
  await db
    .update(quizzes)
    .set({
      totalQuestions: sql`${quizzes.totalQuestions} + 1`,
      totalPoints: sql`${quizzes.totalPoints} + ${points}`,
      updatedAt: new Date(),
    })
    .where(eq(quizzes.id, quizId));

  return newQuestion;
}

/**
 * 7. Update Question (Must own question AND parent quiz; cannot modify if live answers exist)
 */
export async function updateQuestion(
  questionId: string,
  input: Partial<QuestionInput>,
  session: SessionPayload
) {
  assertAdminRole(session);

  const [question] = await db
    .select()
    .from(questions)
    .where(eq(questions.id, questionId))
    .limit(1);

  if (!question) throw new Error("NOT_FOUND: Question does not exist.");

  // Strict ownership check: Must be question owner or super-admin
  assertOwnership(question.createdBy, session, "Question");

  // Also check parent quiz
  const [quiz] = await db
    .select()
    .from(quizzes)
    .where(eq(quizzes.id, question.quizId))
    .limit(1);

  if (quiz) {
    assertOwnership(quiz.createdBy, session, "Parent Quiz");

    // Check if participants have already submitted answers for this question
    const [existingAnswer] = await db
      .select({ id: participantAnswers.id })
      .from(participantAnswers)
      .where(eq(participantAnswers.questionId, questionId))
      .limit(1);

    if (existingAnswer && (input.options || input.correctOptionIds || input.points)) {
      throw new Error(
        "CORRUPTION_PREVENTION: Cannot alter options, correct answers, or points for a question that already has participant submissions."
      );
    }
  }

  const updateData: Partial<Question> = {};
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

  return updated;
}

/**
 * 8. Delete Question (Must own question AND parent quiz; cannot delete if submitted)
 */
export async function deleteQuestion(
  questionId: string,
  session: SessionPayload
) {
  assertAdminRole(session);

  const [question] = await db
    .select()
    .from(questions)
    .where(eq(questions.id, questionId))
    .limit(1);

  if (!question) throw new Error("NOT_FOUND: Question does not exist.");

  // Strict ownership check
  assertOwnership(question.createdBy, session, "Question");

  const [quiz] = await db
    .select()
    .from(quizzes)
    .where(eq(quizzes.id, question.quizId))
    .limit(1);

  if (quiz) {
    assertOwnership(quiz.createdBy, session, "Parent Quiz");

    // Check if participants have answers
    const [existingAnswer] = await db
      .select({ id: participantAnswers.id })
      .from(participantAnswers)
      .where(eq(participantAnswers.questionId, questionId))
      .limit(1);

    if (existingAnswer) {
      throw new Error(
        "CORRUPTION_PREVENTION: Cannot delete a question with existing participant answers."
      );
    }
  }

  await db.delete(questions).where(eq(questions.id, questionId));

  // Decrement quiz totals
  if (quiz) {
    await db
      .update(quizzes)
      .set({
        totalQuestions: sql`GREATEST(0, ${quizzes.totalQuestions} - 1)`,
        totalPoints: sql`GREATEST(0, ${quizzes.totalPoints} - ${question.points})`,
        updatedAt: new Date(),
      })
      .where(eq(quizzes.id, quiz.id));
  }

  return { success: true };
}

/**
 * 9. Reorder Questions in Quiz
 */
export async function reorderQuestions(
  quizId: string,
  orderedIds: string[],
  session: SessionPayload
) {
  assertAdminRole(session);

  const [quiz] = await db
    .select()
    .from(quizzes)
    .where(eq(quizzes.id, quizId))
    .limit(1);

  if (!quiz) throw new Error("NOT_FOUND: Quiz does not exist.");
  assertOwnership(quiz.createdBy, session, "Quiz");

  if (quiz.sessionStatus === "LIVE") {
    throw new Error("CORRUPTION_PREVENTION: Cannot reorder questions during a LIVE quiz session.");
  }

  // Update indices in transaction or sequential queries
  for (let index = 0; index < orderedIds.length; index++) {
    const qId = orderedIds[index];
    await db
      .update(questions)
      .set({ orderIndex: index + 1 })
      .where(and(eq(questions.id, qId), eq(questions.quizId, quizId)));
  }

  return { success: true };
}

/**
 * 10. Change Quiz Session Status (DRAFT, SCHEDULED, LIVE, ENDED)
 */
export async function updateQuizStatus(
  quizId: string,
  newStatus: "DRAFT" | "SCHEDULED" | "LIVE" | "ENDED",
  session: SessionPayload
) {
  assertAdminRole(session);

  const [quiz] = await db
    .select()
    .from(quizzes)
    .where(eq(quizzes.id, quizId))
    .limit(1);

  if (!quiz) throw new Error("NOT_FOUND: Quiz does not exist.");
  assertOwnership(quiz.createdBy, session, "Quiz");

  if (newStatus === "LIVE") {
    const [qCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(questions)
      .where(eq(questions.quizId, quizId));

    if (!qCount || Number(qCount.count) === 0) {
      throw new Error("VALIDATION_ERROR: Cannot launch a quiz with 0 questions. Add at least 1 question first.");
    }
  }

  const [updated] = await db
    .update(quizzes)
    .set({
      sessionStatus: newStatus,
      updatedAt: new Date(),
    })
    .where(eq(quizzes.id, quizId))
    .returning();

  return updated;
}

/**
 * 11. Toggle Results Visibility for Students
 */
export async function toggleResultVisibility(
  quizId: string,
  resultsReleased: boolean,
  session: SessionPayload
) {
  assertAdminRole(session);

  const [quiz] = await db
    .select()
    .from(quizzes)
    .where(eq(quizzes.id, quizId))
    .limit(1);

  if (!quiz) throw new Error("NOT_FOUND: Quiz does not exist.");
  assertOwnership(quiz.createdBy, session, "Quiz");

  const [updated] = await db
    .update(quizzes)
    .set({
      resultsReleased,
      updatedAt: new Date(),
    })
    .where(eq(quizzes.id, quizId))
    .returning();

  return updated;
}

/**
 * 11b. Toggle Leaderboard Visibility for Participants
 */
export async function toggleLeaderboardVisibility(
  quizId: string,
  showLeaderboard: boolean,
  session: SessionPayload
) {
  assertAdminRole(session);

  const [quiz] = await db
    .select()
    .from(quizzes)
    .where(eq(quizzes.id, quizId))
    .limit(1);

  if (!quiz) throw new Error("NOT_FOUND: Quiz does not exist.");
  assertOwnership(quiz.createdBy, session, "Quiz");

  const [updated] = await db
    .update(quizzes)
    .set({
      showLeaderboard,
      updatedAt: new Date(),
    })
    .where(eq(quizzes.id, quizId))
    .returning();

  return updated;
}

/**
 * 11c. Toggle Tab Switch Count Visibility for Participants
 */
export async function toggleTabSwitchCountVisibility(
  quizId: string,
  showTabSwitchCount: boolean,
  session: SessionPayload
) {
  assertAdminRole(session);

  const [quiz] = await db
    .select()
    .from(quizzes)
    .where(eq(quizzes.id, quizId))
    .limit(1);

  if (!quiz) throw new Error("NOT_FOUND: Quiz does not exist.");
  assertOwnership(quiz.createdBy, session, "Quiz");

  const [updated] = await db
    .update(quizzes)
    .set({
      showTabSwitchCount,
      updatedAt: new Date(),
    })
    .where(eq(quizzes.id, quizId))
    .returning();

  return updated;
}

/**
 * 12. Toggle Round 2 Qualification for a participant attempt
 */
export async function toggleAttemptQualification(
  attemptId: string,
  qualified: boolean,
  session: SessionPayload
) {
  assertAdminRole(session);

  const [attempt] = await db
    .select()
    .from(participantAttempts)
    .where(eq(participantAttempts.id, attemptId))
    .limit(1);

  if (!attempt) throw new Error("NOT_FOUND: Attempt does not exist.");

  const [quiz] = await db
    .select()
    .from(quizzes)
    .where(eq(quizzes.id, attempt.quizId))
    .limit(1);

  if (!quiz) throw new Error("NOT_FOUND: Associated quiz not found.");
  assertOwnership(quiz.createdBy, session, "Quiz");

  const [updated] = await db
    .update(participantAttempts)
    .set({ qualifiedForNextRound: qualified })
    .where(eq(participantAttempts.id, attemptId))
    .returning();

  return updated;
}

/**
 * 13. Live Stage Telemetry for Socrative-style Admin Dashboard
 */
export async function getLiveStageTelemetry(
  quizId: string,
  session: SessionPayload
) {
  assertAdminRole(session);

  const [quiz] = await db
    .select()
    .from(quizzes)
    .where(eq(quizzes.id, quizId))
    .limit(1);

  if (!quiz) return null;
  assertOwnership(quiz.createdBy, session, "Quiz");

  // Fetch all questions for this quiz in order
  const quizQuestions = await db
    .select({
      id: questions.id,
      orderIndex: questions.orderIndex,
      questionText: questions.questionText,
      questionType: questions.questionType,
      options: questions.options,
      correctOptionIds: questions.correctOptionIds,
      points: questions.points,
      timeLimitSeconds: questions.timeLimitSeconds,
    })
    .from(questions)
    .where(eq(questions.quizId, quizId))
    .orderBy(asc(questions.orderIndex));

  // Fetch participant attempts
  const attempts = await db
    .select({
      id: participantAttempts.id,
      userId: participantAttempts.userId,
      userName: users.name,
      userEmail: users.email,
      collegeName: users.collegeName,
      rollNumber: users.rollNumber,
      currentQuestionIndex: participantAttempts.currentQuestionIndex,
      currentQuestionStartedAt: participantAttempts.currentQuestionStartedAt,
      totalScore: participantAttempts.totalScore,
      tabSwitchCount: participantAttempts.tabSwitchCount,
      status: participantAttempts.status,
      qualifiedForNextRound: participantAttempts.qualifiedForNextRound,
      startedAt: participantAttempts.startedAt,
    })
    .from(participantAttempts)
    .innerJoin(users, eq(participantAttempts.userId, users.id))
    .where(eq(participantAttempts.quizId, quizId))
    .orderBy(desc(participantAttempts.totalScore));

  // Fetch answers for this quiz's attempts
  const attemptIds = attempts.map((a) => a.id);
  let answersList: Array<{
    id: string;
    attemptId: string;
    questionId: string;
    selectedOptionIds: string[];
    isCorrect: boolean;
    scoreAwarded: number;
    timedOut: boolean;
  }> = [];

  if (attemptIds.length > 0) {
    answersList = await db
      .select({
        id: participantAnswers.id,
        attemptId: participantAnswers.attemptId,
        questionId: participantAnswers.questionId,
        selectedOptionIds: participantAnswers.selectedOptionIds,
        isCorrect: participantAnswers.isCorrect,
        scoreAwarded: participantAnswers.scoreAwarded,
        timedOut: participantAnswers.timedOut,
      })
      .from(participantAnswers)
      .where(sql`${participantAnswers.attemptId} IN ${attemptIds}`);
  }

  // Fetch proctoring summary
  let proctorEventsCount = 0;
  if (attemptIds.length > 0) {
    const [pCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(proctoringEvents)
      .where(sql`${proctoringEvents.attemptId} IN ${attemptIds}`);
    proctorEventsCount = Number(pCount?.count || 0);
  }

  // Calculate live statistics
  const totalEnrolled = attempts.length;
  const activeCount = attempts.filter((a) => a.status === "IN_PROGRESS").length;
  const disqualifiedCount = attempts.filter((a) => a.status === "DISQUALIFIED").length;
  const flaggedCount = attempts.filter((a) => a.tabSwitchCount > 0).length;

  // Question-level accuracy stats
  const questionAccuracy = quizQuestions.map((q) => {
    const qAnswers = answersList.filter((ans) => ans.questionId === q.id);
    const correctAnswers = qAnswers.filter((ans) => ans.isCorrect).length;
    const rate = qAnswers.length > 0 ? Math.round((correctAnswers / qAnswers.length) * 100) : 0;
    return {
      questionId: q.id,
      orderIndex: q.orderIndex,
      totalResponses: qAnswers.length,
      correctResponses: correctAnswers,
      accuracyRate: rate,
    };
  });

  // Overall class accuracy
  const totalSubmissions = answersList.length;
  const totalCorrect = answersList.filter((a) => a.isCorrect).length;
  const overallAccuracy =
    totalSubmissions > 0 ? Math.round((totalCorrect / totalSubmissions) * 100 * 10) / 10 : 0;

  return {
    quiz,
    questions: quizQuestions,
    attempts,
    answers: answersList,
    metrics: {
      totalParticipants: totalEnrolled,
      activeParticipants: activeCount,
      disqualifiedCount,
      flaggedCount,
      totalProctorEvents: proctorEventsCount,
      totalAnswersSubmitted: totalSubmissions,
      overallAccuracy,
      questionAccuracy,
    },
  };
}
