/**
 * Quizzler — Arena Visibility, Participant Passcode, Skip Mechanics & Admin Access Request Test Suite
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/test-arena-and-participant-enhancements.ts
 */

import { eq, and } from "drizzle-orm";
import db from "../src/db";
import {
  quizzes,
  questions,
  participantAttempts,
  participantAnswers,
  quizAccessRequests,
  users,
} from "../src/db/schema";
import {
  createQuiz,
  createQuestion,
  updateQuizStatus,
  toggleQuizArenaVisibility,
  requestQuizFullAccess,
  respondToQuizAccessRequest,
  hasApprovedQuizAccess,
  toggleAttemptQualification,
} from "../src/lib/quiz-service";
import {
  getParticipantQuizzes,
  startOrResumeQuizAttempt,
  getAuthoritativeCurrentQuestion,
  skipOrAdvanceQuestion,
  getParticipantResults,
  validateRoomCodeForEntry,
  validateQuizPasscode,
} from "../src/lib/participant-quiz-service";
import { SessionPayload } from "../src/types/auth";
import bcrypt from "bcryptjs";

async function runEnhancementTests() {
  console.log("==================================================================");
  console.log("🚀 STARTING ARENA, PASSCODE, SKIP & ADMIN ACCESS ENHANCEMENT TESTS");
  console.log("==================================================================");

  let passedTests = 0;
  let failedTests = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passedTests++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      if (details) console.error(`     Details: ${details}`);
      failedTests++;
    }
  }

  // 1. Setup Test Users
  console.log("\n[SETUP] Initializing test accounts...");
  const passwordHash = await bcrypt.hash("Password123!", 10);

  async function getOrCreateUser(email: string, name: string, role: "ADMIN" | "PARTICIPANT" | "SUPER_ADMIN") {
    const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing) return existing;

    const [inserted] = await db
      .insert(users)
      .values({
        name,
        email,
        passwordHash,
        role,
        isActive: true,
      })
      .returning();
    return inserted;
  }

  const admin1User = await getOrCreateUser("arena.admin1@test.com", "Admin Alpha", "ADMIN");
  const admin2User = await getOrCreateUser("arena.admin2@test.com", "Admin Beta", "ADMIN");
  const student1User = await getOrCreateUser("arena.student1@test.com", "Student One", "PARTICIPANT");
  const student2User = await getOrCreateUser("arena.student2@test.com", "Student Two", "PARTICIPANT");

  const admin1Session: SessionPayload = {
    userId: admin1User.id,
    name: admin1User.name,
    email: admin1User.email,
    role: "ADMIN",
    expiresAt: new Date(Date.now() + 3600000),
  };

  const admin2Session: SessionPayload = {
    userId: admin2User.id,
    name: admin2User.name,
    email: admin2User.email,
    role: "ADMIN",
    expiresAt: new Date(Date.now() + 3600000),
  };

  const student1Session: SessionPayload = {
    userId: student1User.id,
    name: student1User.name,
    email: student1User.email,
    role: "PARTICIPANT",
    expiresAt: new Date(Date.now() + 3600000),
  };

  const student2Session: SessionPayload = {
    userId: student2User.id,
    name: student2User.name,
    email: student2User.email,
    role: "PARTICIPANT",
    expiresAt: new Date(Date.now() + 3600000),
  };

  // 2. Create Test Quizzes
  console.log("\n[TEST SECTION 1] Arena Visibility & Passcode Protection");
  const testQuiz = await createQuiz(
    {
      title: "Arena Security Challenge",
      description: "Testing passcode protection & skip mechanics",
      defaultTimePerQuestionSec: 45,
      isSharedWithAdmins: true,
    },
    admin1Session
  );

  const roomCode = testQuiz.roomCode || "ARENA-CODE";

  // Add 3 test questions
  await createQuestion(
    testQuiz.id,
    {
      questionText: "What is 2 + 2?",
      questionType: "MULTIPLE_CHOICE",
      options: [
        { id: "opt1", text: "3" },
        { id: "opt2", text: "4" },
      ],
      correctOptionIds: ["opt2"],
      points: 100,
      timeLimitSeconds: 30,
    },
    admin1Session
  );

  await createQuestion(
    testQuiz.id,
    {
      questionText: "What is the capital of France?",
      questionType: "MULTIPLE_CHOICE",
      options: [
        { id: "opt3", text: "London" },
        { id: "opt4", text: "Paris" },
      ],
      correctOptionIds: ["opt4"],
      points: 100,
      timeLimitSeconds: 30,
    },
    admin1Session
  );

  await createQuestion(
    testQuiz.id,
    {
      questionText: "Which is a prime number?",
      questionType: "MULTIPLE_CHOICE",
      options: [
        { id: "opt5", text: "7" },
        { id: "opt6", text: "9" },
      ],
      correctOptionIds: ["opt5"],
      points: 100,
      timeLimitSeconds: 30,
    },
    admin1Session
  );

  // Verification 1: DRAFT quiz rejected on room code join
  let draftRejected = false;
  try {
    await validateRoomCodeForEntry(roomCode);
  } catch (err: any) {
    if (err.message?.includes("QUIZ_NOT_STARTED")) {
      draftRejected = true;
    }
  }
  assert(draftRejected, "validateRoomCodeForEntry rejects DRAFT quiz");

  // Set quiz to LIVE
  await updateQuizStatus(testQuiz.id, "LIVE", admin1Session);

  // Verification 2: Arena query hides roomCode
  const arenaQuizzes = await getParticipantQuizzes(student1User.id);
  const arenaQuiz = arenaQuizzes.find((q) => q.id === testQuiz.id);
  assert(arenaQuiz !== undefined, "Live quiz is visible in Arena");
  assert(
    !("roomCode" in (arenaQuiz as any)),
    "Arena quiz payload DOES NOT expose roomCode to participants",
    `Found keys: ${Object.keys(arenaQuiz || {})}`
  );

  // Verification 3: Hide from arena
  await toggleQuizArenaVisibility(testQuiz.id, false, admin1Session);
  const hiddenArenaQuizzes = await getParticipantQuizzes(student1User.id);
  const hiddenQuizCheck = hiddenArenaQuizzes.find((q) => q.id === testQuiz.id);
  assert(hiddenQuizCheck === undefined, "Quiz with showInArena: false is excluded from Arena listing");

  // Re-enable arena visibility
  await toggleQuizArenaVisibility(testQuiz.id, true, admin1Session);
  const reenabledQuizzes = await getParticipantQuizzes(student1User.id);
  assert(
    reenabledQuizzes.some((q) => q.id === testQuiz.id),
    "Re-enabled quiz reappears in Arena"
  );

  // Verification 4: Passcode validation function
  let incorrectCodeRejected = false;
  try {
    await validateQuizPasscode(testQuiz.id, "INCORRECT_CODE");
  } catch (err: any) {
    if (err.message?.includes("INCORRECT_PASSCODE")) {
      incorrectCodeRejected = true;
    }
  }
  assert(incorrectCodeRejected, "validateQuizPasscode rejects incorrect code");

  const correctCodeResult = await validateQuizPasscode(testQuiz.id, roomCode.toLowerCase());
  assert(correctCodeResult.roomCode === roomCode.toUpperCase(), "validateQuizPasscode accepts correct code (case-insensitive)");

  // Verification 5: Starting attempt without passcode fails
  let failedWithoutPasscode = false;
  try {
    await startOrResumeQuizAttempt(testQuiz.id, student1Session);
  } catch (err: any) {
    if (err.message?.includes("INVALID_PASSCODE")) {
      failedWithoutPasscode = true;
    }
  }
  assert(failedWithoutPasscode, "Starting attempt without room code passcode throws INVALID_PASSCODE error");

  // Starting attempt with valid passcode succeeds
  const attempt1 = await startOrResumeQuizAttempt(testQuiz.id, student1Session, roomCode);
  assert(attempt1.status === "IN_PROGRESS", "Attempt started successfully with valid passcode");

  // 3. Test Advance Without Submitting (Skip)
  console.log("\n[TEST SECTION 2] Advance Without Submitting (Skip Mechanics)");

  // Fetch the authoritative current question for student 1
  const currentQPayload = await getAuthoritativeCurrentQuestion(attempt1.attemptId, student1Session);
  assert("question" in currentQPayload && Boolean(currentQPayload.question?.id), "Retrieved authoritative first question");

  if (!("question" in currentQPayload)) {
    throw new Error("FAIL: currentQPayload does not contain question");
  }
  const firstQId = currentQPayload.question.id;

  // Student 1 skips question 1
  const skipResult1 = await skipOrAdvanceQuestion(attempt1.attemptId, firstQId, student1Session);
  assert(skipResult1.success, "skipOrAdvanceQuestion returns success");
  assert(!skipResult1.isCompleted, "Attempt is not yet completed after skipping Q1");
  assert(skipResult1.nextIndex === 1, "nextIndex advances to 1");

  // Verify that NO answer was recorded in participant_answers for Q1
  const recordedAnswers = await db
    .select()
    .from(participantAnswers)
    .where(eq(participantAnswers.attemptId, attempt1.attemptId));
  assert(
    recordedAnswers.length === 0,
    "Advance without submitting: NO record inserted into participant_answers table",
    `Found ${recordedAnswers.length} answers`
  );

  // Verify score remains 0
  const [attemptAfterSkip] = await db
    .select()
    .from(participantAttempts)
    .where(eq(participantAttempts.id, attempt1.attemptId));
  assert(attemptAfterSkip.totalScore === 0, "totalScore remains 0 after skipping question");
  assert(attemptAfterSkip.currentQuestionIndex === 1, "Attempt currentQuestionIndex advanced to 1 in database");

  // 4. Test Admin Activity Closure Auto-Submit
  console.log("\n[TEST SECTION 3] Admin Quiz Closure Auto-Submit");

  // Also start attempt for Student 2
  const attempt2 = await startOrResumeQuizAttempt(testQuiz.id, student2Session, roomCode);
  assert(attempt2.status === "IN_PROGRESS", "Student 2 attempt is IN_PROGRESS");

  // Admin ends the quiz
  await updateQuizStatus(testQuiz.id, "ENDED", admin1Session);

  // Verify both attempts are automatically finalized to COMPLETED with completedAt set
  const [closedAttempt1] = await db
    .select()
    .from(participantAttempts)
    .where(eq(participantAttempts.id, attempt1.attemptId));
  const [closedAttempt2] = await db
    .select()
    .from(participantAttempts)
    .where(eq(participantAttempts.id, attempt2.attemptId));

  assert(
    closedAttempt1.status === "COMPLETED" && closedAttempt1.completedAt !== null,
    "Student 1 attempt automatically finalized to COMPLETED on admin quiz end"
  );
  assert(
    closedAttempt2.status === "COMPLETED" && closedAttempt2.completedAt !== null,
    "Student 2 attempt automatically finalized to COMPLETED on admin quiz end"
  );

  // Verification: Join room code on ENDED quiz is rejected
  let endedRejected = false;
  try {
    await validateRoomCodeForEntry(roomCode);
  } catch (err: any) {
    if (err.message?.includes("QUIZ_CLOSED")) {
      endedRejected = true;
    }
  }
  assert(endedRejected, "validateRoomCodeForEntry rejects ENDED quiz");

  // 5. Leaderboard Qualified Candidates Only
  console.log("\n[TEST SECTION 4] Leaderboard Filtering (Qualified Candidates Only)");

  // Enable leaderboard visibility on testQuiz
  await db
    .update(quizzes)
    .set({ showLeaderboard: true })
    .where(eq(quizzes.id, testQuiz.id));

  // Qualify Student 1, leave Student 2 unqualified
  await toggleAttemptQualification(attempt1.attemptId, true, admin1Session);

  const resultsForStudent1 = await getParticipantResults(attempt1.attemptId, student1Session);
  assert(
    Boolean(resultsForStudent1.leaderboard && resultsForStudent1.leaderboard.length === 1),
    "Leaderboard contains only qualified candidates (1 of 2)",
    `Leaderboard count: ${resultsForStudent1.leaderboard?.length}`
  );
  assert(
    resultsForStudent1.leaderboard?.[0]?.userName === student1User.name,
    "Qualified Student 1 appears on leaderboard"
  );
  assert(
    !resultsForStudent1.leaderboard?.some((entry) => entry.userName === student2User.name),
    "Unqualified Student 2 does NOT appear on leaderboard"
  );

  // Verification 4b: Two-condition sorting: Primary score (desc), Secondary time (asc)
  // [#example: A(2000, 8 min), B(2000, 6 min), C(1900, 3 min) -> Order: B, A, C]
  const userA = await getOrCreateUser("arena.candA@test.com", "Candidate A", "PARTICIPANT");
  const userB = await getOrCreateUser("arena.candB@test.com", "Candidate B", "PARTICIPANT");
  const userC = await getOrCreateUser("arena.candC@test.com", "Candidate C", "PARTICIPANT");

  const baseDate = new Date("2026-11-01T10:00:00Z");
  const [attA] = await db
    .insert(participantAttempts)
    .values({
      quizId: testQuiz.id,
      userId: userA.id,
      totalScore: 2000,
      startedAt: baseDate,
      completedAt: new Date(baseDate.getTime() + 8 * 60 * 1000), // 8 min
      status: "COMPLETED",
      qualifiedForNextRound: true,
      currentQuestionIndex: 3,
    })
    .returning();

  const [attB] = await db
    .insert(participantAttempts)
    .values({
      quizId: testQuiz.id,
      userId: userB.id,
      totalScore: 2000,
      startedAt: baseDate,
      completedAt: new Date(baseDate.getTime() + 6 * 60 * 1000), // 6 min
      status: "COMPLETED",
      qualifiedForNextRound: true,
      currentQuestionIndex: 3,
    })
    .returning();

  const [attC] = await db
    .insert(participantAttempts)
    .values({
      quizId: testQuiz.id,
      userId: userC.id,
      totalScore: 1900,
      startedAt: baseDate,
      completedAt: new Date(baseDate.getTime() + 3 * 60 * 1000), // 3 min
      status: "COMPLETED",
      qualifiedForNextRound: true,
      currentQuestionIndex: 3,
    })
    .returning();

  const sortResults = await getParticipantResults(attA.id, {
    userId: userA.id,
    name: userA.name,
    email: userA.email,
    role: "PARTICIPANT",
    expiresAt: new Date(Date.now() + 3600000),
  });

  const top3Names = sortResults.leaderboard?.slice(0, 3).map((item) => item.userName);
  assert(
    top3Names?.[0] === "Candidate B" &&
      top3Names?.[1] === "Candidate A" &&
      top3Names?.[2] === "Candidate C",
    "Leaderboard two-condition sort: Primary score (desc), Secondary time (asc) -> B, A, C",
    `Expected [Candidate B, Candidate A, Candidate C], got: ${JSON.stringify(top3Names)}`
  );

  // 6. Admin-to-Admin Full Control Request System
  console.log("\n[TEST SECTION 5] Admin-to-Admin Access Request & Delegation");

  // Create another quiz owned by Admin 1
  const quiz2 = await createQuiz(
    {
      title: "Cross-Admin Delegation Test",
      description: "Testing full-control grant workflow",
      defaultTimePerQuestionSec: 30,
      isSharedWithAdmins: true,
    },
    admin1Session
  );

  // Admin 2 initially does NOT have approved access
  const hasAccessInitially = await hasApprovedQuizAccess(quiz2.id, admin2User.id);
  assert(!hasAccessInitially, "Admin 2 does not have access initially");

  // Admin 2 requesting full control creates a PENDING request
  const requestResult = await requestQuizFullAccess(quiz2.id, admin2Session, "Co-organizing round 2");
  assert(requestResult.success, "Full access request created successfully");

  const [pendingReq] = await db
    .select()
    .from(quizAccessRequests)
    .where(
      and(
        eq(quizAccessRequests.quizId, quiz2.id),
        eq(quizAccessRequests.requestingAdminId, admin2User.id)
      )
    );
  assert(
    Boolean(pendingReq && pendingReq.status === "PENDING"),
    "Access request stored with PENDING status"
  );

  // Admin 1 (Owner) approves the request
  const approveResult = await respondToQuizAccessRequest(pendingReq.id, "APPROVED", admin1Session);
  assert(approveResult.success, "Owner successfully approves access request");

  const hasAccessAfterApproval = await hasApprovedQuizAccess(quiz2.id, admin2User.id);
  assert(hasAccessAfterApproval, "hasApprovedQuizAccess returns true after approval");

  // Admin 2 can now create a question on Admin 1's quiz
  const qCreatedByAdmin2 = await createQuestion(
    quiz2.id,
    {
      questionText: "Question added by approved Admin 2",
      questionType: "MULTIPLE_CHOICE",
      options: [
        { id: "o1", text: "Yes" },
        { id: "o2", text: "No" },
      ],
      correctOptionIds: ["o1"],
      points: 50,
      timeLimitSeconds: 20,
    },
    admin2Session
  );
  assert(
    qCreatedByAdmin2.questionText === "Question added by approved Admin 2",
    "Approved Admin 2 can successfully create questions on shared quiz"
  );

  // Admin 2 can toggle Arena visibility
  const arenaToggleResult = await toggleQuizArenaVisibility(quiz2.id, false, admin2Session);
  assert(arenaToggleResult.showInArena === false, "Approved Admin 2 can toggle Arena visibility");

  // 7. Cleanup Test Records
  console.log("\n[CLEANUP] Cleaning up test data...");
  try {
    await db.delete(quizAccessRequests).where(eq(quizAccessRequests.quizId, quiz2.id));
    await db.delete(participantAnswers).where(eq(participantAnswers.attemptId, attempt1.attemptId));
    await db.delete(participantAnswers).where(eq(participantAnswers.attemptId, attempt2.attemptId));
    await db.delete(participantAttempts).where(eq(participantAttempts.quizId, testQuiz.id));
    await db.delete(participantAttempts).where(eq(participantAttempts.quizId, quiz2.id));
    await db.delete(questions).where(eq(questions.quizId, testQuiz.id));
    await db.delete(questions).where(eq(questions.quizId, quiz2.id));
    await db.delete(quizzes).where(eq(quizzes.id, testQuiz.id));
    await db.delete(quizzes).where(eq(quizzes.id, quiz2.id));
    console.log("Cleanup completed.");
  } catch (cleanErr) {
    console.error("Cleanup notice:", cleanErr);
  }

  // Summary
  console.log("\n==================================================================");
  console.log(`TEST SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log("==================================================================");

  if (failedTests > 0) {
    process.exit(1);
  }
}

runEnhancementTests().catch((err) => {
  console.error("❌ Test suite encountered unhandled error:", err);
  process.exit(1);
});
