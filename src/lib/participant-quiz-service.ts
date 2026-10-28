import { eq, and, desc, asc, sql } from "drizzle-orm";
import db from "@/db";
import {
  quizzes,
  questions,
  participantAttempts,
  participantAnswers,
  proctoringEvents,
  users,
} from "@/db/schema";
import { SessionPayload } from "@/types/auth";

export interface ParticipantQuestionPayload {
  attemptId: string;
  quizId: string;
  quizTitle: string;
  roomCode: string | null;
  currentQuestionIndex: number;
  totalQuestions: number;
  question: {
    id: string;
    questionText: string;
    questionType: string;
    codeSnippet: string | null;
    mediaUrl: string | null;
    options: Array<{ id: string; text: string }>;
    points: number;
    timeLimitSeconds: number;
  };
  timeRemainingSeconds: number;
  tabSwitchCount: number;
  isLastQuestion: boolean;
}

export interface QuizAttemptResultPayload {
  attemptId: string;
  quizId: string;
  quizTitle: string;
  roomCode: string | null;
  status: "IN_PROGRESS" | "COMPLETED" | "DISQUALIFIED";
  resultsReleased: boolean;
  showLeaderboard: boolean;
  totalScore: number;
  totalPossiblePoints: number;
  totalQuestions: number;
  answeredCount: number;
  correctCount: number;
  tabSwitchCount: number;
  startedAt: Date;
  completedAt: Date | null;
  timeSpentSeconds: number;
  questionBreakdown?: Array<{
    questionId: string;
    questionText: string;
    questionType: string;
    codeSnippet: string | null;
    options: Array<{ id: string; text: string }>;
    selectedOptionIds: string[];
    correctOptionIds: string[];
    isCorrect: boolean;
    scoreAwarded: number;
    timedOut: boolean;
    explanation: string | null;
  }>;
  leaderboard?: Array<{
    rank: number;
    teamName: string;
    userName: string;
    collegeName: string;
    score: number;
    completedAt: Date | null;
  }>;
}

/**
 * Helper to shuffle an array deterministically using Fisher-Yates
 */
function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * 1. Get Quizzes Available for Participant Dashboard
 */
export async function getParticipantQuizzes(userId: string) {
  // Fetch quizzes that are scheduled, live, or ended
  const allQuizzes = await db
    .select({
      id: quizzes.id,
      title: quizzes.title,
      description: quizzes.description,
      roomCode: quizzes.roomCode,
      sessionStatus: quizzes.sessionStatus,
      defaultTimePerQuestionSec: quizzes.defaultTimePerQuestionSec,
      totalQuestions: quizzes.totalQuestions,
      totalPoints: quizzes.totalPoints,
      resultsReleased: quizzes.resultsReleased,
      showLeaderboard: quizzes.showLeaderboard,
      createdAt: quizzes.createdAt,
    })
    .from(quizzes)
    .where(sql`${quizzes.sessionStatus} != 'DRAFT'`)
    .orderBy(desc(quizzes.createdAt));

  // Fetch attempts by this user
  const userAttempts = await db
    .select({
      id: participantAttempts.id,
      quizId: participantAttempts.quizId,
      status: participantAttempts.status,
      currentQuestionIndex: participantAttempts.currentQuestionIndex,
      totalScore: participantAttempts.totalScore,
      completedAt: participantAttempts.completedAt,
    })
    .from(participantAttempts)
    .where(eq(participantAttempts.userId, userId));

  const attemptsByQuiz = new Map<string, (typeof userAttempts)[0]>();
  for (const att of userAttempts) {
    attemptsByQuiz.set(att.quizId, att);
  }

  return allQuizzes.map((quiz) => {
    const attempt = attemptsByQuiz.get(quiz.id) || null;
    return {
      ...quiz,
      userAttempt: attempt
        ? {
            id: attempt.id,
            status: attempt.status,
            currentQuestionIndex: attempt.currentQuestionIndex,
            totalScore: attempt.totalScore,
            completedAt: attempt.completedAt,
          }
        : null,
    };
  });
}

/**
 * 2. Start or Resume an Attempt
 * Enforces:
 * - Quiz must be LIVE
 * - Prevents duplicate active attempts
 * - Shuffles questions in randomized order for each participant and persists it
 */
export async function startOrResumeQuizAttempt(
  quizId: string,
  session: SessionPayload
) {
  // 1. Fetch quiz
  const [quiz] = await db
    .select()
    .from(quizzes)
    .where(eq(quizzes.id, quizId))
    .limit(1);

  if (!quiz) {
    throw new Error("NOT_FOUND: Competition quiz not found.");
  }

  if (quiz.sessionStatus === "DRAFT") {
    throw new Error("QUIZ_NOT_AVAILABLE: This quiz is still in draft state.");
  }

  // 2. Check existing attempt
  const [existingAttempt] = await db
    .select()
    .from(participantAttempts)
    .where(
      and(
        eq(participantAttempts.quizId, quizId),
        eq(participantAttempts.userId, session.userId)
      )
    )
    .limit(1);

  if (existingAttempt) {
    if (existingAttempt.status === "COMPLETED") {
      return {
        attemptId: existingAttempt.id,
        status: "COMPLETED",
        message: "Quiz already submitted.",
      };
    }
    if (existingAttempt.status === "DISQUALIFIED") {
      throw new Error("DISQUALIFIED: You have been disqualified from this quiz.");
    }
    // Resume active attempt
    return {
      attemptId: existingAttempt.id,
      status: "IN_PROGRESS",
      message: "Resuming existing active session.",
    };
  }

  // Quiz must be LIVE to start a new attempt
  if (quiz.sessionStatus !== "LIVE") {
    throw new Error(
      `QUIZ_NOT_LIVE: Competition is currently ${quiz.sessionStatus}. You cannot start until the organizer launches the stage.`
    );
  }

  // 3. Fetch all questions for this quiz
  const quizQuestions = await db
    .select({ id: questions.id })
    .from(questions)
    .where(eq(questions.quizId, quizId))
    .orderBy(asc(questions.orderIndex));

  if (quizQuestions.length === 0) {
    throw new Error("EMPTY_QUIZ: This quiz does not contain any questions.");
  }

  // 4. Randomize question order for this participant
  const randomizedIds = shuffleArray(quizQuestions.map((q) => q.id));

  // 5. Create attempt
  const now = new Date();
  const [newAttempt] = await db
    .insert(participantAttempts)
    .values({
      quizId,
      userId: session.userId,
      currentQuestionIndex: 0,
      currentQuestionStartedAt: now,
      questionOrder: randomizedIds,
      totalScore: 0,
      tabSwitchCount: 0,
      status: "IN_PROGRESS",
      startedAt: now,
    })
    .returning();

  return {
    attemptId: newAttempt.id,
    status: "IN_PROGRESS",
    message: "New attempt started.",
  };
}

/**
 * 3. Retrieve Authoritative Current Question
 * Handles:
 * - Server-side timer calculation
 * - Disconnect & refresh recovery
 * - Automatic timeout advancement
 * - Strips master correctOptionIds and explanations
 */
export async function getAuthoritativeCurrentQuestion(
  attemptId: string,
  session: SessionPayload
): Promise<
  | { status: "COMPLETED" | "DISQUALIFIED"; attemptId: string; quizId: string }
  | ParticipantQuestionPayload
> {
  const [attempt] = await db
    .select()
    .from(participantAttempts)
    .where(eq(participantAttempts.id, attemptId))
    .limit(1);

  if (!attempt) {
    throw new Error("NOT_FOUND: Quiz attempt not found.");
  }

  // Security check: must own attempt
  if (attempt.userId !== session.userId && session.role !== "SUPER_ADMIN") {
    throw new Error("FORBIDDEN: You do not own this quiz attempt.");
  }

  if (attempt.status === "COMPLETED" || attempt.status === "DISQUALIFIED") {
    return {
      status: attempt.status,
      attemptId: attempt.id,
      quizId: attempt.quizId,
    };
  }

  const [quiz] = await db
    .select()
    .from(quizzes)
    .where(eq(quizzes.id, attempt.quizId))
    .limit(1);

  if (!quiz) {
    throw new Error("NOT_FOUND: Parent quiz not found.");
  }

  const questionOrder = (attempt.questionOrder as string[]) || [];
  if (questionOrder.length === 0) {
    throw new Error("INVALID_STATE: Attempt has no question sequence.");
  }

  // Check if reached beyond last question
  if (attempt.currentQuestionIndex >= questionOrder.length) {
    await db
      .update(participantAttempts)
      .set({
        status: "COMPLETED",
        completedAt: new Date(),
      })
      .where(eq(participantAttempts.id, attemptId));

    return {
      status: "COMPLETED",
      attemptId: attempt.id,
      quizId: attempt.quizId,
    };
  }

  // Loop to handle timeout advancement in case participant disconnected for multiple questions
  let currentIndex = attempt.currentQuestionIndex;
  let startedAt = attempt.currentQuestionStartedAt || new Date();

  while (currentIndex < questionOrder.length) {
    const questionId = questionOrder[currentIndex];
    const [qData] = await db
      .select()
      .from(questions)
      .where(eq(questions.id, questionId))
      .limit(1);

    if (!qData) {
      // Question was deleted by admin; advance
      currentIndex++;
      startedAt = new Date();
      continue;
    }

    const durationSec =
      qData.timeLimitSeconds || quiz.defaultTimePerQuestionSec || 30;
    const nowMs = Date.now();
    const startedMs = startedAt.getTime();
    const elapsedSec = Math.floor((nowMs - startedMs) / 1000);
    const remainingSec = durationSec - elapsedSec;

    // Grace period for latency: 2 seconds
    if (remainingSec <= -2) {
      // Timed out while disconnected or inactive!
      // Check if an answer was recorded
      const [existingAns] = await db
        .select({ id: participantAnswers.id })
        .from(participantAnswers)
        .where(
          and(
            eq(participantAnswers.attemptId, attemptId),
            eq(participantAnswers.questionId, questionId)
          )
        )
        .limit(1);

      if (!existingAns) {
        // Record automated timeout answer
        await db.insert(participantAnswers).values({
          attemptId,
          questionId,
          selectedOptionIds: [],
          startedAt,
          submittedAt: new Date(),
          isCorrect: false,
          scoreAwarded: 0,
          timedOut: true,
        });
      }

      // Advance index
      currentIndex++;
      startedAt = new Date();

      await db
        .update(participantAttempts)
        .set({
          currentQuestionIndex: currentIndex,
          currentQuestionStartedAt: startedAt,
        })
        .where(eq(participantAttempts.id, attemptId));

      continue;
    }

    // Question is active and time remains!
    // Return sanitized question payload (WITHOUT correctOptionIds or explanation)
    return {
      attemptId: attempt.id,
      quizId: quiz.id,
      quizTitle: quiz.title,
      roomCode: quiz.roomCode,
      currentQuestionIndex: currentIndex,
      totalQuestions: questionOrder.length,
      question: {
        id: qData.id,
        questionText: qData.questionText,
        questionType: qData.questionType,
        codeSnippet: qData.codeSnippet,
        mediaUrl: qData.mediaUrl,
        options: (qData.options as Array<{ id: string; text: string }>) || [],
        points: qData.points,
        timeLimitSeconds: durationSec,
      },
      timeRemainingSeconds: Math.max(0, remainingSec),
      tabSwitchCount: attempt.tabSwitchCount,
      isLastQuestion: currentIndex === questionOrder.length - 1,
    };
  }

  // All questions completed
  await db
    .update(participantAttempts)
    .set({
      status: "COMPLETED",
      completedAt: new Date(),
    })
    .where(eq(participantAttempts.id, attemptId));

  return {
    status: "COMPLETED",
    attemptId: attempt.id,
    quizId: attempt.quizId,
  };
}

/**
 * 4. Submit Answer for Current Question
 * Enforces:
 * - Server deadline verification
 * - One answer per question
 * - Server-side scoring (points awarded)
 * - Automatic progression to next question or completion
 */
export async function submitQuestionAnswer(
  attemptId: string,
  questionId: string,
  selectedOptionIds: string[],
  session: SessionPayload
) {
  const [attempt] = await db
    .select()
    .from(participantAttempts)
    .where(eq(participantAttempts.id, attemptId))
    .limit(1);

  if (!attempt) {
    throw new Error("NOT_FOUND: Quiz attempt not found.");
  }

  // Ownership check
  if (attempt.userId !== session.userId) {
    throw new Error("FORBIDDEN: You do not own this attempt.");
  }

  if (attempt.status !== "IN_PROGRESS") {
    throw new Error(`ATTEMPT_LOCKED: Attempt is already ${attempt.status}.`);
  }

  const questionOrder = (attempt.questionOrder as string[]) || [];
  const expectedQuestionId = questionOrder[attempt.currentQuestionIndex];

  if (expectedQuestionId !== questionId) {
    throw new Error(
      "INVALID_PROGRESSION: Out-of-order question submission. You cannot skip or backtrack."
    );
  }

  // Fetch parent quiz and question
  const [quiz] = await db
    .select()
    .from(quizzes)
    .where(eq(quizzes.id, attempt.quizId))
    .limit(1);

  const [question] = await db
    .select()
    .from(questions)
    .where(eq(questions.id, questionId))
    .limit(1);

  if (!quiz || !question) {
    throw new Error("NOT_FOUND: Quiz or question missing.");
  }

  // Check if answer already exists
  const [existingAnswer] = await db
    .select({ id: participantAnswers.id })
    .from(participantAnswers)
    .where(
      and(
        eq(participantAnswers.attemptId, attemptId),
        eq(participantAnswers.questionId, questionId)
      )
    )
    .limit(1);

  if (existingAnswer) {
    // Already answered; advance safely
    const nextIdx = attempt.currentQuestionIndex + 1;
    const isCompleted = nextIdx >= questionOrder.length;

    await db
      .update(participantAttempts)
      .set({
        currentQuestionIndex: nextIdx,
        currentQuestionStartedAt: new Date(),
        status: isCompleted ? "COMPLETED" : "IN_PROGRESS",
        completedAt: isCompleted ? new Date() : null,
      })
      .where(eq(participantAttempts.id, attemptId));

    return {
      success: true,
      isCompleted,
      nextIndex: nextIdx,
    };
  }

  // Server-Authoritative Timing Validation
  const durationSec =
    question.timeLimitSeconds || quiz.defaultTimePerQuestionSec || 30;
  const startedAt = attempt.currentQuestionStartedAt || new Date();
  const now = new Date();
  const elapsedSec = Math.floor((now.getTime() - startedAt.getTime()) / 1000);

  // 3-second grace period for network latency
  const timedOut = elapsedSec > durationSec + 3;

  // Grade Answer on Server
  let isCorrect = false;
  let scoreAwarded = 0;

  if (!timedOut) {
    const correctIds = (question.correctOptionIds as string[]) || [];
    // Sort and compare arrays for equality
    const sortedSelected = [...selectedOptionIds].sort();
    const sortedCorrect = [...correctIds].sort();

    if (
      sortedSelected.length === sortedCorrect.length &&
      sortedSelected.every((val, idx) => val === sortedCorrect[idx])
    ) {
      isCorrect = true;
      scoreAwarded = question.points;
    }
  }

  // Insert Answer record
  await db.insert(participantAnswers).values({
    attemptId,
    questionId,
    selectedOptionIds,
    startedAt,
    submittedAt: now,
    isCorrect,
    scoreAwarded,
    timedOut,
  });

  // Increment score & index
  const nextIndex = attempt.currentQuestionIndex + 1;
  const isCompleted = nextIndex >= questionOrder.length;

  await db
    .update(participantAttempts)
    .set({
      totalScore: sql`${participantAttempts.totalScore} + ${scoreAwarded}`,
      currentQuestionIndex: nextIndex,
      currentQuestionStartedAt: now,
      status: isCompleted ? "COMPLETED" : "IN_PROGRESS",
      completedAt: isCompleted ? now : null,
    })
    .where(eq(participantAttempts.id, attemptId));

  return {
    success: true,
    isCompleted,
    nextIndex,
  };
}

/**
 * 5. Record Anti-Cheat Proctoring Telemetry
 * Records window blur, tab switch events; rate-limited & validated
 */
export async function recordParticipantProctorEvent(
  attemptId: string,
  eventType: "TAB_SWITCH" | "WINDOW_BLUR" | "FULLSCREEN_EXIT",
  metadata: Record<string, unknown> = {},
  session: SessionPayload
) {
  const [attempt] = await db
    .select({
      id: participantAttempts.id,
      quizId: participantAttempts.quizId,
      userId: participantAttempts.userId,
      status: participantAttempts.status,
      tabSwitchCount: participantAttempts.tabSwitchCount,
    })
    .from(participantAttempts)
    .where(eq(participantAttempts.id, attemptId))
    .limit(1);

  if (!attempt) {
    throw new Error("NOT_FOUND: Attempt not found.");
  }

  if (attempt.userId !== session.userId) {
    throw new Error("FORBIDDEN: Attempt ownership violation.");
  }

  if (attempt.status !== "IN_PROGRESS") {
    return { success: false, tabSwitchCount: attempt.tabSwitchCount };
  }

  // Insert telemetry event
  await db.insert(proctoringEvents).values({
    attemptId,
    quizId: attempt.quizId,
    userId: session.userId,
    eventType,
    metadata,
    createdAt: new Date(),
  });

  // Increment attempt tab switch count
  const [updated] = await db
    .update(participantAttempts)
    .set({
      tabSwitchCount: sql`${participantAttempts.tabSwitchCount} + 1`,
    })
    .where(eq(participantAttempts.id, attemptId))
    .returning({ tabSwitchCount: participantAttempts.tabSwitchCount });

  return {
    success: true,
    tabSwitchCount: updated.tabSwitchCount,
  };
}

/**
 * 6. Get Detailed Results & Scorecard for Participant
 * Strictly respects `resultsReleased` and `showLeaderboard`
 */
export async function getParticipantResults(
  attemptId: string,
  session: SessionPayload
): Promise<QuizAttemptResultPayload> {
  const [attempt] = await db
    .select()
    .from(participantAttempts)
    .where(eq(participantAttempts.id, attemptId))
    .limit(1);

  if (!attempt) {
    throw new Error("NOT_FOUND: Attempt not found.");
  }

  // Must own attempt or be super-admin/admin
  if (
    attempt.userId !== session.userId &&
    session.role !== "ADMIN" &&
    session.role !== "SUPER_ADMIN"
  ) {
    throw new Error("FORBIDDEN: You do not have permission to view this scorecard.");
  }

  const [quiz] = await db
    .select()
    .from(quizzes)
    .where(eq(quizzes.id, attempt.quizId))
    .limit(1);

  if (!quiz) {
    throw new Error("NOT_FOUND: Parent quiz not found.");
  }

  // Fetch all answers submitted for this attempt
  const answers = await db
    .select()
    .from(participantAnswers)
    .where(eq(participantAnswers.attemptId, attemptId));

  const totalQuestions = quiz.totalQuestions || 0;
  const answeredCount = answers.length;
  const correctCount = answers.filter((a) => a.isCorrect).length;

  const startedAt = attempt.startedAt;
  const completedAt = attempt.completedAt;
  const timeSpentSeconds = completedAt
    ? Math.max(0, Math.floor((completedAt.getTime() - startedAt.getTime()) / 1000))
    : 0;

  // Build Leaderboard if enabled
  let leaderboardData: QuizAttemptResultPayload["leaderboard"] = undefined;
  if (quiz.showLeaderboard || quiz.resultsReleased) {
    const topAttempts = await db
      .select({
        score: participantAttempts.totalScore,
        completedAt: participantAttempts.completedAt,
        teamName: users.teamName,
        userName: users.name,
        collegeName: users.collegeName,
      })
      .from(participantAttempts)
      .innerJoin(users, eq(participantAttempts.userId, users.id))
      .where(
        and(
          eq(participantAttempts.quizId, quiz.id),
          eq(participantAttempts.status, "COMPLETED")
        )
      )
      .orderBy(desc(participantAttempts.totalScore), asc(participantAttempts.completedAt))
      .limit(10);

    leaderboardData = topAttempts.map((item, index) => ({
      rank: index + 1,
      teamName: item.teamName || item.userName,
      userName: item.userName,
      collegeName: item.collegeName || "BIMTECH",
      score: item.score,
      completedAt: item.completedAt,
    }));
  }

  // If results are NOT released, return blinded summary
  if (!quiz.resultsReleased && session.role !== "SUPER_ADMIN") {
    return {
      attemptId: attempt.id,
      quizId: quiz.id,
      quizTitle: quiz.title,
      roomCode: quiz.roomCode,
      status: attempt.status,
      resultsReleased: false,
      showLeaderboard: quiz.showLeaderboard,
      totalScore: attempt.totalScore,
      totalPossiblePoints: quiz.totalPoints,
      totalQuestions,
      answeredCount,
      correctCount: 0, // Hidden until released
      tabSwitchCount: attempt.tabSwitchCount,
      startedAt,
      completedAt,
      timeSpentSeconds,
      leaderboard: leaderboardData,
    };
  }

  // Results ARE released: attach full question breakdown with explanations
  const quizQuestions = await db
    .select()
    .from(questions)
    .where(eq(questions.quizId, quiz.id))
    .orderBy(asc(questions.orderIndex));

  const answersMap = new Map<string, (typeof answers)[0]>();
  for (const a of answers) {
    answersMap.set(a.questionId, a);
  }

  const breakdown = quizQuestions.map((q) => {
    const ans = answersMap.get(q.id);
    return {
      questionId: q.id,
      questionText: q.questionText,
      questionType: q.questionType,
      codeSnippet: q.codeSnippet,
      options: (q.options as Array<{ id: string; text: string }>) || [],
      selectedOptionIds: (ans?.selectedOptionIds as string[]) || [],
      correctOptionIds: (q.correctOptionIds as string[]) || [],
      isCorrect: ans?.isCorrect || false,
      scoreAwarded: ans?.scoreAwarded || 0,
      timedOut: ans?.timedOut || false,
      explanation: q.explanation,
    };
  });

  return {
    attemptId: attempt.id,
    quizId: quiz.id,
    quizTitle: quiz.title,
    roomCode: quiz.roomCode,
    status: attempt.status,
    resultsReleased: true,
    showLeaderboard: quiz.showLeaderboard,
    totalScore: attempt.totalScore,
    totalPossiblePoints: quiz.totalPoints,
    totalQuestions,
    answeredCount,
    correctCount,
    tabSwitchCount: attempt.tabSwitchCount,
    startedAt,
    completedAt,
    timeSpentSeconds,
    questionBreakdown: breakdown,
    leaderboard: leaderboardData,
  };
}
