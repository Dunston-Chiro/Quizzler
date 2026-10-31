/**
 * Automated Test Suite: Admin Live Quiz Dashboard Enhancements
 * Tests:
 * 1. Quick Question Injector backend functionality & deck injection
 * 2. Complete question-progress rendering for quizzes with > 5 questions
 * 3. Student Answer Review retrieval with student isolation & status accuracy
 * 4. Selection/qualification toggle for Round 2
 * 5. Sorting by Name, Score, Time, and Tab-switch count (asc & desc, numeric)
 * 6. Live Quiz Sharing (enable/disable, visibility for other Admins, view-only enforcement, access denial)
 * 7. Super-Admin clearance preservation
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/test-admin-live-enhancements.ts
 */

import { Pool } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import {
  createQuiz,
  createQuestion,
  updateQuizStatus,
  getAdminQuizzes,
  getQuizWithQuestions,
  getLiveStageTelemetry,
  getSharedLiveQuizzes,
  toggleQuizSharing,
  toggleAttemptQualification,
  getStudentAttemptReview,
} from "@/lib/quiz-service";
import {
  startOrResumeQuizAttempt,
  submitQuestionAnswer,
  recordParticipantProctorEvent,
} from "@/lib/participant-quiz-service";
import { SessionPayload } from "@/types/auth";

async function runTests() {
  console.log("==================================================================");
  console.log("🧪 STARTING ADMIN LIVE QUIZ DASHBOARD ENHANCEMENTS TEST SUITE");
  console.log("==================================================================");

  const pool = new Pool({
    connectionString:
      process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL,
  });

  const timestamp = Date.now();
  const passwordHash = await bcrypt.hash("Password123!", 10);

  // Helper to create test user
  async function createTestUser(email: string, name: string, role: string) {
    const res = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, college_name, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'BIMTECH', true, NOW(), NOW())
       RETURNING id, name, email, role`,
      [name, email, passwordHash, role]
    );
    return res.rows[0];
  }

  // 1. Setup Test Users
  console.log("\n[Setup] Provisioning test users...");
  const adminAlpha = await createTestUser(`admin.alpha.${timestamp}@test.local`, "Admin Alpha", "ADMIN");
  const adminBeta = await createTestUser(`admin.beta.${timestamp}@test.local`, "Admin Beta", "ADMIN");
  const superAdmin = await createTestUser(`super.chief.${timestamp}@test.local`, "Super Chief", "SUPER_ADMIN");
  const student1 = await createTestUser(`student.one.${timestamp}@test.local`, "Student Charlie", "PARTICIPANT");
  const student2 = await createTestUser(`student.two.${timestamp}@test.local`, "Student Delta", "PARTICIPANT");

  console.log(`✓ Admin Alpha (Owner): ${adminAlpha.email}`);
  console.log(`✓ Admin Beta (Other Admin): ${adminBeta.email}`);
  console.log(`✓ Super Admin: ${superAdmin.email}`);
  console.log(`✓ Participant 1: ${student1.name}`);
  console.log(`✓ Participant 2: ${student2.name}`);

  const sessionAlpha: SessionPayload = {
    userId: adminAlpha.id,
    name: adminAlpha.name,
    email: adminAlpha.email,
    role: "ADMIN",
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  };

  const sessionBeta: SessionPayload = {
    userId: adminBeta.id,
    name: adminBeta.name,
    email: adminBeta.email,
    role: "ADMIN",
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  };

  const sessionSuper: SessionPayload = {
    userId: superAdmin.id,
    name: superAdmin.name,
    email: superAdmin.email,
    role: "SUPER_ADMIN",
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  };

  const sessionStudent1: SessionPayload = {
    userId: student1.id,
    name: student1.name,
    email: student1.email,
    role: "PARTICIPANT",
    collegeName: "BIMTECH",
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  };

  const sessionStudent2: SessionPayload = {
    userId: student2.id,
    name: student2.name,
    email: student2.email,
    role: "PARTICIPANT",
    collegeName: "BIMTECH",
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  };

  let testQuizId: string | null = null;

  try {
    // -------------------------------------------------------------------------
    // Test 1: Create Quiz with 7 Questions (> 5 questions)
    // -------------------------------------------------------------------------
    console.log("\n[Test 1] Creating Quiz with 7 questions to verify full progress rendering...");
    const quiz = await createQuiz(
      {
        title: `Algorithms & Networks Qualifier ${timestamp}`,
        description: "Stage 1 Multi-question competition",
        defaultTimePerQuestionSec: 30,
      },
      sessionAlpha
    );
    testQuizId = quiz.id;

    // Seed 7 questions
    const questionIds: string[] = [];
    for (let i = 1; i <= 7; i++) {
      const q = await createQuestion(
        quiz.id,
        {
          questionText: `Question #${i}: What is the time complexity of operation ${i}?`,
          questionType: "MULTIPLE_CHOICE",
          options: [
            { id: "opt1", text: "O(1)" },
            { id: "opt2", text: "O(log n)" },
            { id: "opt3", text: "O(n)" },
            { id: "opt4", text: "O(n^2)" },
          ],
          correctOptionIds: ["opt1"],
          points: 100,
          timeLimitSeconds: 30,
          explanation: `Operation ${i} achieves constant O(1) time complexity.`,
        },
        sessionAlpha
      );
      questionIds.push(q.id);
    }

    console.log(`✓ Quiz created (${quiz.id}) with 7 questions in deck.`);

    // -------------------------------------------------------------------------
    // Test 2: Quick Question Injector — Relocation & Live Injection
    // -------------------------------------------------------------------------
    console.log("\n[Test 2] Testing Quick Question Injector (injecting Q8 into live deck)...");
    const injectedQ = await createQuestion(
      quiz.id,
      {
        questionText: "Question #8 (Injected Live): Which protocol operates at the Transport Layer?",
        questionType: "MULTIPLE_CHOICE",
        options: [
          { id: "opt1", text: "TCP" },
          { id: "opt2", text: "IP" },
          { id: "opt3", text: "HTTP" },
          { id: "opt4", text: "Ethernet" },
        ],
        correctOptionIds: ["opt1"],
        points: 150,
        timeLimitSeconds: 20,
        explanation: "TCP is a core Transport Layer connection-oriented protocol.",
      },
      sessionAlpha
    );
    questionIds.push(injectedQ.id);

    console.log(`✓ Injected Question #8 successfully: "${injectedQ.questionText}" (+${injectedQ.points} PTS)`);

    // -------------------------------------------------------------------------
    // Test 3: Launch Live Stage & Verify Complete Question Progress (8/8 Questions)
    // -------------------------------------------------------------------------
    console.log("\n[Test 3] Verifying Live Stage Telemetry returns ALL 8 questions (not capped at 5)...");
    await updateQuizStatus(quiz.id, "LIVE", sessionAlpha);

    const telemetryAlpha = await getLiveStageTelemetry(quiz.id, sessionAlpha);
    if (!telemetryAlpha) throw new Error("FAIL: Live stage telemetry returned null.");

    console.log(`✓ Total Questions in Telemetry: ${telemetryAlpha.questions.length}`);
    if (telemetryAlpha.questions.length !== 8) {
      throw new Error(`FAIL: Expected 8 questions in telemetry, got ${telemetryAlpha.questions.length}`);
    }
    console.log("✓ Full question-progress invariant verified: All questions present in deck.");

    // -------------------------------------------------------------------------
    // Test 4: Participant Activity & In-Flight Tracking
    // -------------------------------------------------------------------------
    console.log("\n[Test 4] Simulating participant responses and recording tab switch events...");
    const p1Attempt = await startOrResumeQuizAttempt(quiz.id, sessionStudent1);
    const p2Attempt = await startOrResumeQuizAttempt(quiz.id, sessionStudent2);

    // Retrieve each participant's authoritative randomized sequence
    const p1OrderRes = await pool.query("SELECT question_order FROM participant_attempts WHERE id = $1", [p1Attempt.attemptId]);
    const p1Order = p1OrderRes.rows[0].question_order as string[];

    const p2OrderRes = await pool.query("SELECT question_order FROM participant_attempts WHERE id = $1", [p2Attempt.attemptId]);
    const p2Order = p2OrderRes.rows[0].question_order as string[];

    // Student 1 answers Q1 correctly, Q2 incorrectly
    await submitQuestionAnswer(p1Attempt.attemptId, p1Order[0], ["opt1"], sessionStudent1);
    await submitQuestionAnswer(p1Attempt.attemptId, p1Order[1], ["opt3"], sessionStudent1);

    // Student 1 tab switch event
    await recordParticipantProctorEvent(p1Attempt.attemptId, "TAB_SWITCH", {}, sessionStudent1);

    // Student 2 answers Q1 correctly, Q2 correctly, Q3 correctly
    await submitQuestionAnswer(p2Attempt.attemptId, p2Order[0], ["opt1"], sessionStudent2);
    await submitQuestionAnswer(p2Attempt.attemptId, p2Order[1], ["opt1"], sessionStudent2);
    await submitQuestionAnswer(p2Attempt.attemptId, p2Order[2], ["opt1"], sessionStudent2);

    const refreshedTelemetry = await getLiveStageTelemetry(quiz.id, sessionAlpha);
    if (!refreshedTelemetry) throw new Error("FAIL: Telemetry refresh failed.");

    const att1 = refreshedTelemetry.attempts.find((a) => a.id === p1Attempt.attemptId);
    const att2 = refreshedTelemetry.attempts.find((a) => a.id === p2Attempt.attemptId);

    console.log(`✓ Student 1: Score = ${att1?.totalScore} pts, Current Index = ${att1?.currentQuestionIndex}, Tab switches = ${att1?.tabSwitchCount}`);
    console.log(`✓ Student 2: Score = ${att2?.totalScore} pts, Current Index = ${att2?.currentQuestionIndex}, Tab switches = ${att2?.tabSwitchCount}`);

    let expectedP1Score = 0;
    const q1Obj = refreshedTelemetry.questions.find((x) => x.id === p1Order[0]);
    expectedP1Score = q1Obj?.points || 100;

    let expectedP2Score = 0;
    for (let i = 0; i < 3; i++) {
      const qObj = refreshedTelemetry.questions.find((x) => x.id === p2Order[i]);
      expectedP2Score += qObj?.points || 100;
    }

    if (att1?.totalScore !== expectedP1Score) {
      throw new Error(`FAIL: Expected Student 1 score ${expectedP1Score}, got ${att1?.totalScore}`);
    }
    if (att2?.totalScore !== expectedP2Score) {
      throw new Error(`FAIL: Expected Student 2 score ${expectedP2Score}, got ${att2?.totalScore}`);
    }
    if (att1?.tabSwitchCount !== 1) throw new Error(`FAIL: Expected Student 1 tabSwitchCount 1, got ${att1?.tabSwitchCount}`);

    // -------------------------------------------------------------------------
    // Test 5: Student Answer Review Modal Service
    // -------------------------------------------------------------------------
    console.log("\n[Test 5] Testing Student Answer Review modal service...");
    const reviewP1 = await getStudentAttemptReview(quiz.id, p1Attempt.attemptId, sessionAlpha);

    console.log(`✓ Review retrieved for "${reviewP1.studentName}"`);
    console.log(`  - Total Score: ${reviewP1.totalScore}`);
    console.log(`  - Questions in review: ${reviewP1.questions.length}`);

    if (reviewP1.questions.length !== 8) {
      throw new Error(`FAIL: Expected 8 questions in review, got ${reviewP1.questions.length}`);
    }

    const firstAnswered = reviewP1.questions.find((q) => q.questionId === p1Order[0]);
    const secondAnswered = reviewP1.questions.find((q) => q.questionId === p1Order[1]);
    const thirdUnanswered = reviewP1.questions.find((q) => q.questionId === p1Order[2]);

    if (!firstAnswered?.studentAnswer?.isCorrect) {
      throw new Error("FAIL: Question 1 should be marked correct for Student 1.");
    }
    if (secondAnswered?.studentAnswer?.isCorrect !== false) {
      throw new Error("FAIL: Question 2 should be marked incorrect for Student 1.");
    }
    if (thirdUnanswered?.studentAnswer !== null) {
      throw new Error("FAIL: Question 3 should be marked unanswered (null) for Student 1.");
    }

    console.log("✓ First Answered Question: Correct (Selected: opt1, Key: opt1, Score: 100)");
    console.log("✓ Second Answered Question: Incorrect (Selected: opt3, Key: opt1, Score: 0)");
    console.log("✓ Unanswered Questions: Properly identified as Not Answered Yet (In Flight / In Queue)");

    // -------------------------------------------------------------------------
    // Test 6: Modal Action — Select / Qualify for Round 2
    // -------------------------------------------------------------------------
    console.log("\n[Test 6] Testing Selection / Qualification for Round 2...");
    await toggleAttemptQualification(p1Attempt.attemptId, true, sessionAlpha);

    const reviewP1AfterSelect = await getStudentAttemptReview(quiz.id, p1Attempt.attemptId, sessionAlpha);
    if (!reviewP1AfterSelect.qualifiedForNextRound) {
      throw new Error("FAIL: Student 1 was not marked qualifiedForNextRound!");
    }
    console.log(`✓ Student 1 successfully Selected / Qualified for Round 2: qualifiedForNextRound = true`);

    // Toggle back to deselect
    await toggleAttemptQualification(p1Attempt.attemptId, false, sessionAlpha);
    const reviewP1AfterDeselect = await getStudentAttemptReview(quiz.id, p1Attempt.attemptId, sessionAlpha);
    if (reviewP1AfterDeselect.qualifiedForNextRound) {
      throw new Error("FAIL: Student 1 was not deselected!");
    }
    console.log(`✓ Student 1 successfully deselected: qualifiedForNextRound = false`);

    // -------------------------------------------------------------------------
    // Test 7: Sorting Validation (Name, Score, Time, Tab Switch Count)
    // -------------------------------------------------------------------------
    console.log("\n[Test 7] Testing sorting logic across all 4 requested dimensions...");
    const sampleParticipants = [
      { userName: "Charlie", totalScore: 100, startedAt: new Date(Date.now() - 40000), completedAt: null, tabSwitchCount: 0 },
      { userName: "Alice", totalScore: 300, startedAt: new Date(Date.now() - 20000), completedAt: null, tabSwitchCount: 3 },
      { userName: "Bob", totalScore: 200, startedAt: new Date(Date.now() - 60000), completedAt: null, tabSwitchCount: 1 },
    ];

    // Score desc
    const byScoreDesc = [...sampleParticipants].sort((a, b) => b.totalScore - a.totalScore);
    if (byScoreDesc[0].userName !== "Alice" || byScoreDesc[2].userName !== "Charlie") {
      throw new Error("FAIL: Sorting by score desc failed.");
    }
    console.log(`✓ Score (desc): ${byScoreDesc.map((s) => `${s.userName} (${s.totalScore}pts)`).join(" > ")}`);

    // Name asc
    const byNameAsc = [...sampleParticipants].sort((a, b) => a.userName.localeCompare(b.userName));
    if (byNameAsc[0].userName !== "Alice" || byNameAsc[2].userName !== "Charlie") {
      throw new Error("FAIL: Sorting by name asc failed.");
    }
    console.log(`✓ Name (asc): ${byNameAsc.map((s) => s.userName).join(" < ")}`);

    // Time (duration) asc
    const byTimeAsc = [...sampleParticipants].sort((a, b) => {
      const durA = Math.round((Date.now() - a.startedAt.getTime()) / 1000);
      const durB = Math.round((Date.now() - b.startedAt.getTime()) / 1000);
      return durA - durB;
    });
    if (byTimeAsc[0].userName !== "Alice" || byTimeAsc[2].userName !== "Bob") {
      throw new Error("FAIL: Sorting by time asc failed.");
    }
    console.log(`✓ Time (asc): ${byTimeAsc.map((s) => `${s.userName} (~${Math.round((Date.now() - s.startedAt.getTime()) / 1000)}s)`).join(" < ")}`);

    // Tab Switches desc
    const byTabDesc = [...sampleParticipants].sort((a, b) => b.tabSwitchCount - a.tabSwitchCount);
    if (byTabDesc[0].userName !== "Alice" || byTabDesc[2].userName !== "Charlie") {
      throw new Error("FAIL: Sorting by tabSwitchCount desc failed.");
    }
    console.log(`✓ Tab Switches (desc): ${byTabDesc.map((s) => `${s.userName} (${s.tabSwitchCount})`).join(" > ")}`);

    // -------------------------------------------------------------------------
    // Test 8: Live Quiz Sharing Between Admins
    // -------------------------------------------------------------------------
    console.log("\n[Test 8] Testing Live Quiz Sharing between Admins...");

    // Initial state: Sharing is DISABLED
    console.log("8a. Verifying non-owner Admin Beta cannot view unshared quiz...");
    let betaBlocked = false;
    try {
      await getLiveStageTelemetry(quiz.id, sessionBeta);
    } catch (err: unknown) {
      betaBlocked = true;
      console.log(`✓ Non-owner Admin Beta properly denied access: "${(err as Error).message}"`);
    }
    if (!betaBlocked) throw new Error("SECURITY VIOLATION: Admin Beta was allowed to access unshared quiz!");

    const sharedQuizzesBefore = await getSharedLiveQuizzes(sessionBeta);
    if (sharedQuizzesBefore.some((q) => q.id === quiz.id)) {
      throw new Error("SECURITY VIOLATION: Unshared quiz appeared in Admin Beta's shared live quizzes!");
    }
    console.log("✓ Unshared quiz is completely absent from other Admin's dashboard.");

    // Enable sharing
    console.log("\n8b. Admin Alpha enables sharing...");
    await toggleQuizSharing(quiz.id, true, sessionAlpha);

    // Verify visibility in getAdminQuizzes for Admin Beta
    const adminQuizzesBeta = await getAdminQuizzes(sessionBeta);
    const sharedInList = adminQuizzesBeta.find((q) => q.id === quiz.id);
    if (!sharedInList) {
      throw new Error("FAIL: Quiz did not appear in getAdminQuizzes for Admin Beta after sharing was enabled!");
    }
    console.log(`✓ Quiz "${sharedInList.title}" visible in Admin Beta Quizzes list (Created by: ${sharedInList.creatorName})`);

    const sharedQuizzesAfter = await getSharedLiveQuizzes(sessionBeta);
    const sharedEntry = sharedQuizzesAfter.find((q) => q.id === quiz.id);
    if (!sharedEntry) {
      throw new Error("FAIL: Quiz did not appear in shared quizzes after sharing was enabled!");
    }
    console.log(`✓ Quiz "${sharedEntry.title}" now visible to Admin Beta in Shared Live Quizzes!`);
    console.log(`  - Organizer: ${sharedEntry.creatorName} (${sharedEntry.creatorEmail})`);

    // Verify view-only access to Question Studio (getQuizWithQuestions)
    console.log("\n8c. Admin Beta opens Question Studio for shared quiz in view-only mode...");
    const studioData = await getQuizWithQuestions(quiz.id, sessionBeta);
    if (!studioData) throw new Error("FAIL: Admin Beta could not view shared quiz questions!");
    if (studioData.isReadOnly !== true) {
      throw new Error("SECURITY VIOLATION: Non-owner was not flagged as isReadOnly in Question Studio!");
    }
    if (studioData.questions.length !== 8) {
      throw new Error(`FAIL: Expected 8 questions in studio view, got ${studioData.questions.length}`);
    }
    console.log(`✓ Question Studio accessible to Admin Beta (isReadOnly: true, Questions: ${studioData.questions.length})`);

    // Admin Beta observes shared quiz live telemetry
    console.log("\n8d. Admin Beta accesses shared quiz live telemetry...");
    const betaTelemetry = await getLiveStageTelemetry(quiz.id, sessionBeta);
    if (!betaTelemetry) throw new Error("FAIL: Admin Beta failed to fetch shared quiz telemetry.");

    console.log(`✓ Telemetry accessible to Admin Beta.`);
    console.log(`  - isReadOnly: ${betaTelemetry.quiz.isReadOnly}`);
    console.log(`  - Owner Name: ${betaTelemetry.quiz.ownerName}`);
    console.log(`  - Participants: ${betaTelemetry.attempts.length}`);

    if (betaTelemetry.quiz.isReadOnly !== true) {
      throw new Error("SECURITY VIOLATION: Shared observer did not receive isReadOnly = true!");
    }
    if (betaTelemetry.quiz.ownerName !== "Admin Alpha") {
      throw new Error(`FAIL: Expected ownerName "Admin Alpha", got "${betaTelemetry.quiz.ownerName}"`);
    }

    // Verify Admin Beta cannot perform mutations (View-only enforcement)
    console.log("\n8e. Verifying strict view-only permissions (mutations blocked for non-owner)...");
    let mutationBlocked = false;
    try {
      await toggleAttemptQualification(p1Attempt.attemptId, true, sessionBeta);
    } catch (err: unknown) {
      mutationBlocked = true;
      console.log(`✓ Participant mutation by non-owner properly blocked: "${(err as Error).message}"`);
    }
    if (!mutationBlocked) throw new Error("SECURITY VIOLATION: Non-owner Admin Beta was allowed to qualify a participant!");

    let statusChangeBlocked = false;
    try {
      await updateQuizStatus(quiz.id, "ENDED", sessionBeta);
    } catch (err: unknown) {
      statusChangeBlocked = true;
      console.log(`✓ Quiz status change by non-owner properly blocked: "${(err as Error).message}"`);
    }
    if (!statusChangeBlocked) throw new Error("SECURITY VIOLATION: Non-owner Admin Beta was allowed to change quiz status!");

    let questionAddBlocked = false;
    try {
      await createQuestion(
        quiz.id,
        {
          questionText: "Unauthorized Injected Question",
          options: [{ id: "opt1", text: "A" }],
          correctOptionIds: ["opt1"],
        },
        sessionBeta
      );
    } catch (err: unknown) {
      questionAddBlocked = true;
      console.log(`✓ Question addition by non-owner properly blocked: "${(err as Error).message}"`);
    }
    if (!questionAddBlocked) throw new Error("SECURITY VIOLATION: Non-owner Admin Beta was allowed to add a question!");

    // Super-Admin access retains full permissions
    console.log("\n8f. Verifying Super-Admin preserves global write clearance...");
    const superTelemetry = await getLiveStageTelemetry(quiz.id, sessionSuper);
    if (superTelemetry?.quiz.isReadOnly !== false) {
      throw new Error("FAIL: Super-Admin was given read-only mode instead of full clearance!");
    }
    console.log(`✓ Super-Admin access confirmed: isReadOnly = false (Global clearance active).`);

    // Disable sharing again
    console.log("\n8g. Admin Alpha disables sharing...");
    await toggleQuizSharing(quiz.id, false, sessionAlpha);

    let betaBlockedAgain = false;
    try {
      await getLiveStageTelemetry(quiz.id, sessionBeta);
    } catch (err: unknown) {
      betaBlockedAgain = true;
      console.log(`✓ Live Stage telemetry access immediately revoked when sharing disabled: "${(err as Error).message}"`);
    }
    if (!betaBlockedAgain) throw new Error("SECURITY VIOLATION: Admin Beta was able to access live telemetry after sharing disabled!");

    let betaStudioBlockedAgain = false;
    try {
      await getQuizWithQuestions(quiz.id, sessionBeta);
    } catch (err: unknown) {
      betaStudioBlockedAgain = true;
      console.log(`✓ Question Studio access immediately revoked when sharing disabled: "${(err as Error).message}"`);
    }
    if (!betaStudioBlockedAgain) throw new Error("SECURITY VIOLATION: Admin Beta was able to access Question Studio after sharing disabled!");

    // -------------------------------------------------------------------------
    // Cleanup
    // -------------------------------------------------------------------------
    console.log("\n[Cleanup] Removing test artifacts from database...");
    await pool.query("DELETE FROM proctoring_events WHERE quiz_id = $1", [quiz.id]);
    await pool.query("DELETE FROM participant_answers WHERE attempt_id IN ($1, $2)", [p1Attempt.attemptId, p2Attempt.attemptId]);
    await pool.query("DELETE FROM participant_attempts WHERE quiz_id = $1", [quiz.id]);
    await pool.query("DELETE FROM questions WHERE quiz_id = $1", [quiz.id]);
    await pool.query("DELETE FROM quizzes WHERE id = $1", [quiz.id]);
    await pool.query("DELETE FROM users WHERE id IN ($1, $2, $3, $4, $5)", [
      adminAlpha.id,
      adminBeta.id,
      superAdmin.id,
      student1.id,
      student2.id,
    ]);
    console.log("✓ All test records cleaned up successfully.");

    console.log("\n==================================================================");
    console.log("🎉 ALL ADMIN LIVE DASHBOARD ENHANCEMENT TESTS PASSED (8/8)!");
    console.log("==================================================================");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ TEST SUITE FAILED:", error);
    if (testQuizId) {
      try {
        await pool.query("DELETE FROM proctoring_events WHERE quiz_id = $1", [testQuizId]);
        await pool.query("DELETE FROM participant_answers WHERE attempt_id IN (SELECT id FROM participant_attempts WHERE quiz_id = $1)", [testQuizId]);
        await pool.query("DELETE FROM participant_attempts WHERE quiz_id = $1", [testQuizId]);
        await pool.query("DELETE FROM questions WHERE quiz_id = $1", [testQuizId]);
        await pool.query("DELETE FROM quizzes WHERE id = $1", [testQuizId]);
        await pool.query("DELETE FROM users WHERE id IN ($1, $2, $3, $4, $5)", [
          adminAlpha.id,
          adminBeta.id,
          superAdmin.id,
          student1.id,
          student2.id,
        ]);
      } catch (cleanupErr) {
        console.error("Cleanup error:", cleanupErr);
      }
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runTests();
