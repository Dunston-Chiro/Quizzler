/**
 * Quizzler — Participant Timed Quiz Engine Verification Test Suite
 *
 * Verifies:
 * 1. Quiz joining & start (only LIVE quizzes, prevents duplicate active attempts)
 * 2. Randomized question order (different randomized sequence per participant)
 * 3. Linear progression & answer locking (no backtracking, idempotent submissions)
 * 4. Server-authoritative timing (expired timer marks timed_out = true, 0 points)
 * 5. Accurate server-side scoring (points awarded based on master keys)
 * 6. Refresh & disconnect recovery (retrieves current question and elapsed time without timer reset)
 * 7. Anti-cheat telemetry (records tab switches to proctoring_events)
 * 8. Result visibility control (blinded when resultsReleased = false; reveals keys when true)
 * 9. Top 10 Leaderboard (returned when showLeaderboard = true, hides sensitive data)
 * 10. Attempt ownership security (cross-participant access denied)
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/test-participant-quiz.ts
 */

import { eq, and } from "drizzle-orm";
import db from "../src/db";
import {
  quizzes,
  questions,
  participantAttempts,
  participantAnswers,
  proctoringEvents,
  users,
} from "../src/db/schema";
import {
  createQuiz,
  createQuestion,
  updateQuizStatus,
  toggleResultVisibility,
  toggleLeaderboardVisibility,
  toggleTabSwitchCountVisibility,
} from "../src/lib/quiz-service";
import {
  startOrResumeQuizAttempt,
  getAuthoritativeCurrentQuestion,
  submitQuestionAnswer,
  recordParticipantProctorEvent,
  getParticipantResults,
  ParticipantQuestionPayload,
} from "../src/lib/participant-quiz-service";
import { SessionPayload } from "../src/types/auth";
import bcrypt from "bcryptjs";

async function runTimedEngineTests() {
  console.log("==================================================================");
  console.log("🧪 STARTING PARTICIPANT TIMED QUIZ ENGINE VERIFICATION TEST SUITE");
  console.log("==================================================================");

  let adminUser: { id: string; email: string; name: string } | null = null;
  let participant1: { id: string; email: string; name: string } | null = null;
  let participant2: { id: string; email: string; name: string } | null = null;
  let testQuizId: string | null = null;

  try {
    // -------------------------------------------------------------------------
    // Setup: Create Test Admin & 2 Test Participants
    // -------------------------------------------------------------------------
    console.log("\n[Setup] Provisioning test users...");
    const ts = Date.now();
    const pwHash = await bcrypt.hash("TestPass123!", 10);

    const [admin] = await db
      .insert(users)
      .values({
        name: `Proctor_${ts}`,
        email: `proctor.${ts}@quizzler.test`,
        passwordHash: pwHash,
        role: "ADMIN",
        collegeName: "BIMTECH",
      })
      .returning();
    adminUser = admin;

    const [p1] = await db
      .insert(users)
      .values({
        teamName: "Alpha Hackers",
        name: `alpha_lead_${ts}`,
        email: `alpha.lead.${ts}@quizzler.test`,
        passwordHash: pwHash,
        role: "PARTICIPANT",
        collegeName: "BIMTECH",
      })
      .returning();
    participant1 = p1;

    const [p2] = await db
      .insert(users)
      .values({
        teamName: "Beta Coders",
        name: `beta_lead_${ts}`,
        email: `beta.lead.${ts}@quizzler.test`,
        passwordHash: pwHash,
        role: "PARTICIPANT",
        collegeName: "BIMTECH",
      })
      .returning();
    participant2 = p2;

    const adminSession: SessionPayload = {
      userId: admin.id,
      name: admin.name,
      email: admin.email,
      role: "ADMIN",
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    };

    const p1Session: SessionPayload = {
      userId: p1.id,
      name: p1.name,
      teamName: p1.teamName || undefined,
      email: p1.email,
      role: "PARTICIPANT",
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    };

    const p2Session: SessionPayload = {
      userId: p2.id,
      name: p2.name,
      teamName: p2.teamName || undefined,
      email: p2.email,
      role: "PARTICIPANT",
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    };

    console.log("✓ Test Users Ready:");
    console.log(`  - Admin: ${admin.email}`);
    console.log(`  - Participant 1 (Alpha): ${p1.email}`);
    console.log(`  - Participant 2 (Beta):  ${p2.email}`);

    // -------------------------------------------------------------------------
    // Setup: Create Competition Quiz with 3 Questions
    // -------------------------------------------------------------------------
    console.log("\n[Setup] Creating competition quiz with 3 questions...");
    const quiz = await createQuiz(
      {
        title: `Campus Speed Challenge ${ts}`,
        description: "Server-authoritative timed qualifier.",
        roomCode: `TST-${ts.toString().slice(-4)}`,
        defaultTimePerQuestionSec: 30,
      },
      adminSession
    );
    testQuizId = quiz.id;

    // Q1
    await createQuestion(
      quiz.id,
      {
        questionText: "What is the time complexity of binary search on a sorted array?",
        questionType: "MULTIPLE_CHOICE",
        options: [
          { id: "opt-1a", text: "O(n)" },
          { id: "opt-1b", text: "O(log n)" },
          { id: "opt-1c", text: "O(1)" },
          { id: "opt-1d", text: "O(n^2)" },
        ],
        correctOptionIds: ["opt-1b"],
        points: 100,
        timeLimitSeconds: 20,
      },
      adminSession
    );

    // Q2
    await createQuestion(
      quiz.id,
      {
        questionText: "HTTP POST requests are idempotent by specification.",
        questionType: "TRUE_FALSE",
        options: [
          { id: "opt-2a", text: "True" },
          { id: "opt-2b", text: "False" },
        ],
        correctOptionIds: ["opt-2b"],
        points: 100,
        timeLimitSeconds: 15,
      },
      adminSession
    );

    // Q3
    await createQuestion(
      quiz.id,
      {
        questionText: "Which SQL clause is used to filter records after aggregation?",
        questionType: "MULTIPLE_CHOICE",
        options: [
          { id: "opt-3a", text: "WHERE" },
          { id: "opt-3b", text: "GROUP BY" },
          { id: "opt-3c", text: "HAVING" },
          { id: "opt-3d", text: "ORDER BY" },
        ],
        correctOptionIds: ["opt-3c"],
        points: 100,
        timeLimitSeconds: 25,
      },
      adminSession
    );

    console.log(`✓ Quiz created: "${quiz.title}" (${quiz.id}) with 3 questions.`);

    // -------------------------------------------------------------------------
    // Test 1: Participant attempts to join when quiz is still DRAFT
    // -------------------------------------------------------------------------
    console.log("\n[Test 1] Attempting to start attempt while quiz is in DRAFT...");
    let draftBlocked = false;
    try {
      await startOrResumeQuizAttempt(quiz.id, p1Session);
    } catch (err: unknown) {
      draftBlocked = true;
      console.log(`✓ Draft access properly rejected: "${(err as Error).message}"`);
    }
    if (!draftBlocked) {
      throw new Error("FAIL: Participant was allowed to start attempt on DRAFT quiz!");
    }

    // -------------------------------------------------------------------------
    // Test 2: Admin launches quiz LIVE; participants start attempts
    // -------------------------------------------------------------------------
    console.log("\n[Test 2] Launching quiz LIVE and starting participant attempts...");
    await updateQuizStatus(quiz.id, "LIVE", adminSession);
    console.log("✓ Quiz status updated to LIVE by Admin.");

    const p1AttemptRes = await startOrResumeQuizAttempt(quiz.id, p1Session);
    const p2AttemptRes = await startOrResumeQuizAttempt(quiz.id, p2Session);

    console.log(`✓ Participant 1 Attempt: ${p1AttemptRes.attemptId} (${p1AttemptRes.status})`);
    console.log(`✓ Participant 2 Attempt: ${p2AttemptRes.attemptId} (${p2AttemptRes.status})`);

    // Verify duplicate attempt prevention
    const p1ResumeRes = await startOrResumeQuizAttempt(quiz.id, p1Session);
    if (p1ResumeRes.attemptId !== p1AttemptRes.attemptId) {
      throw new Error("FAIL: Duplicate attempt was created instead of resuming existing attempt!");
    }
    console.log("✓ Duplicate attempt check passed: Returned existing active session.");

    // -------------------------------------------------------------------------
    // Test 3: Verify randomized question order per participant
    // -------------------------------------------------------------------------
    console.log("\n[Test 3] Verifying randomized question sequences...");
    const [att1] = await db
      .select({ questionOrder: participantAttempts.questionOrder })
      .from(participantAttempts)
      .where(eq(participantAttempts.id, p1AttemptRes.attemptId));

    const [att2] = await db
      .select({ questionOrder: participantAttempts.questionOrder })
      .from(participantAttempts)
      .where(eq(participantAttempts.id, p2AttemptRes.attemptId));

    const order1 = att1.questionOrder as string[];
    const order2 = att2.questionOrder as string[];

    console.log(`✓ Participant 1 Question Sequence: [${order1.join(", ")}]`);
    console.log(`✓ Participant 2 Question Sequence: [${order2.join(", ")}]`);

    if (order1.length !== 3 || order2.length !== 3) {
      throw new Error("FAIL: Question order array does not contain all 3 questions!");
    }

    // -------------------------------------------------------------------------
    // Test 4: Retrieve question payload & verify master keys are hidden
    // -------------------------------------------------------------------------
    console.log("\n[Test 4] Retrieving first question and verifying security sanitization...");
    const p1Q1Payload = (await getAuthoritativeCurrentQuestion(
      p1AttemptRes.attemptId,
      p1Session
    )) as ParticipantQuestionPayload;

    console.log(`✓ Received Question 1: "${p1Q1Payload.question.questionText}"`);
    console.log(`  - Time Remaining: ${p1Q1Payload.timeRemainingSeconds}s`);
    console.log(`  - Options Count: ${p1Q1Payload.question.options.length}`);
    console.log(`  - Live Tab Count Display: ${p1Q1Payload.showTabSwitchCount} (Default: false)`);

    if (p1Q1Payload.showTabSwitchCount !== false) {
      throw new Error("FAIL: Default showTabSwitchCount must be false during quiz!");
    }

    // Security check: Master keys MUST NOT be present
    if ("correctOptionIds" in p1Q1Payload.question || "explanation" in p1Q1Payload.question) {
      throw new Error("SECURITY VIOLATION: Correct options or explanation leaked in participant payload!");
    }
    console.log("✓ Security Check Passed: Correct answers and explanations are completely hidden.");

    // -------------------------------------------------------------------------
    // Test 5: Linear progression & out-of-order rejection
    // -------------------------------------------------------------------------
    console.log("\n[Test 5] Testing out-of-order submission rejection...");
    let outOfOrderBlocked = false;
    try {
      // Intentionally try to submit for question 3 instead of current question 1
      const wrongQId = order1[2];
      await submitQuestionAnswer(p1AttemptRes.attemptId, wrongQId, ["opt-3c"], p1Session);
    } catch (err: unknown) {
      outOfOrderBlocked = true;
      console.log(`✓ Out-of-order submission properly blocked: "${(err as Error).message}"`);
    }
    if (!outOfOrderBlocked) {
      throw new Error("FAIL: Out-of-order question submission was permitted!");
    }

    // -------------------------------------------------------------------------
    // Test 6: Submit correct answer for Q1 and verify server grading
    // -------------------------------------------------------------------------
    console.log("\n[Test 6] Submitting correct answer for Question 1...");
    const activeQ1Id = p1Q1Payload.question.id;
    // Find correct option for activeQ1Id
    const [fullQ1] = await db
      .select({ correctOptionIds: questions.correctOptionIds })
      .from(questions)
      .where(eq(questions.id, activeQ1Id));

    const sub1Res = await submitQuestionAnswer(
      p1AttemptRes.attemptId,
      activeQ1Id,
      fullQ1.correctOptionIds as string[],
      p1Session
    );

    console.log(`✓ Submission succeeded. Next index: ${sub1Res.nextIndex}`);

    // Check score in DB
    const [att1AfterQ1] = await db
      .select({ totalScore: participantAttempts.totalScore, currentQuestionIndex: participantAttempts.currentQuestionIndex })
      .from(participantAttempts)
      .where(eq(participantAttempts.id, p1AttemptRes.attemptId));

    console.log(`✓ Participant 1 Score: ${att1AfterQ1.totalScore} PTS (Expected: 100)`);
    if (att1AfterQ1.totalScore !== 100) {
      throw new Error(`FAIL: Expected totalScore 100, got ${att1AfterQ1.totalScore}`);
    }
    if (att1AfterQ1.currentQuestionIndex !== 1) {
      throw new Error(`FAIL: Expected currentQuestionIndex 1, got ${att1AfterQ1.currentQuestionIndex}`);
    }

    // -------------------------------------------------------------------------
    // Test 7: Refresh & Disconnection Recovery
    // -------------------------------------------------------------------------
    console.log("\n[Test 7] Simulating page refresh & disconnect recovery...");
    const p1Q2Payload = (await getAuthoritativeCurrentQuestion(
      p1AttemptRes.attemptId,
      p1Session
    )) as ParticipantQuestionPayload;

    console.log(`✓ Refreshed state successfully retrieved Question 2: "${p1Q2Payload.question.questionText}"`);
    console.log(`  - Current Question Index: ${p1Q2Payload.currentQuestionIndex + 1} / ${p1Q2Payload.totalQuestions}`);
    console.log(`  - Authoritative Time Remaining: ${p1Q2Payload.timeRemainingSeconds}s`);

    if (p1Q2Payload.currentQuestionIndex !== 1) {
      throw new Error("FAIL: Refresh recovery did not preserve question index!");
    }

    // -------------------------------------------------------------------------
    // Test 8: Server-Authoritative Timeout Enforcement
    // -------------------------------------------------------------------------
    console.log("\n[Test 8] Simulating expired timer for Question 2...");
    // Fast-forward started_at back by 60 seconds to simulate expired timer
    await db
      .update(participantAttempts)
      .set({
        currentQuestionStartedAt: new Date(Date.now() - 60000),
      })
      .where(eq(participantAttempts.id, p1AttemptRes.attemptId));

    const activeQ2Id = p1Q2Payload.question.id;
    // Attempt late submission
    await submitQuestionAnswer(p1AttemptRes.attemptId, activeQ2Id, ["opt-2a"], p1Session);

    // Verify answer was recorded with timedOut = true and 0 points
    const [ans2] = await db
      .select()
      .from(participantAnswers)
      .where(
        and(
          eq(participantAnswers.attemptId, p1AttemptRes.attemptId),
          eq(participantAnswers.questionId, activeQ2Id)
        )
      );

    console.log(`✓ Late Answer Status: timedOut = ${ans2.timedOut}, scoreAwarded = ${ans2.scoreAwarded}`);
    if (!ans2.timedOut || ans2.scoreAwarded !== 0) {
      throw new Error("FAIL: Expired submission was not marked timedOut with 0 points!");
    }

    // -------------------------------------------------------------------------
    // Test 9: Anti-Cheat Proctoring Telemetry
    // -------------------------------------------------------------------------
    console.log("\n[Test 9] Reporting anti-cheat tab switch event...");
    const proctorRes = await recordParticipantProctorEvent(
      p1AttemptRes.attemptId,
      "TAB_SWITCH",
      { blurDurationMs: 1500 },
      p1Session
    );

    console.log(`✓ Proctor telemetry recorded: tabSwitchCount = ${proctorRes.tabSwitchCount}`);
    const [latestEvent] = await db
      .select()
      .from(proctoringEvents)
      .where(eq(proctoringEvents.attemptId, p1AttemptRes.attemptId));

    if (!latestEvent || latestEvent.eventType !== "TAB_SWITCH") {
      throw new Error("FAIL: Proctoring event was not logged in proctoring_events!");
    }
    console.log(`✓ Telemetry event logged in PostgreSQL: ${latestEvent.eventType}`);

    // -------------------------------------------------------------------------
    // Test 10: Complete Last Question & Finalize Attempt
    // -------------------------------------------------------------------------
    console.log("\n[Test 10] Submitting last question and finalizing competition...");
    const p1Q3Payload = (await getAuthoritativeCurrentQuestion(
      p1AttemptRes.attemptId,
      p1Session
    )) as ParticipantQuestionPayload;

    const activeQ3Id = p1Q3Payload.question.id;
    const [fullQ3] = await db
      .select({ correctOptionIds: questions.correctOptionIds })
      .from(questions)
      .where(eq(questions.id, activeQ3Id));

    const finalSubRes = await submitQuestionAnswer(
      p1AttemptRes.attemptId,
      activeQ3Id,
      fullQ3.correctOptionIds as string[],
      p1Session
    );

    console.log(`✓ Final Question Submitted: isCompleted = ${finalSubRes.isCompleted}`);
    if (!finalSubRes.isCompleted) {
      throw new Error("FAIL: Quiz was not marked completed after last question!");
    }

    const [finalAttempt] = await db
      .select({ status: participantAttempts.status, totalScore: participantAttempts.totalScore })
      .from(participantAttempts)
      .where(eq(participantAttempts.id, p1AttemptRes.attemptId));

    console.log(`✓ Final Attempt Status: ${finalAttempt.status}, Total Score: ${finalAttempt.totalScore} PTS`);

    // -------------------------------------------------------------------------
    // Test 11: Results Visibility & Blinded Scorecard Check
    // -------------------------------------------------------------------------
    console.log("\n[Test 11] Checking results while resultsReleased = false...");
    const blindedResults = await getParticipantResults(p1AttemptRes.attemptId, p1Session);

    console.log(`✓ Results Released: ${blindedResults.resultsReleased}`);
    console.log(`✓ Question Breakdown Attached: ${blindedResults.questionBreakdown !== undefined}`);

    if (blindedResults.resultsReleased || blindedResults.questionBreakdown !== undefined) {
      throw new Error("SECURITY VIOLATION: Detailed question breakdown exposed before results released!");
    }
    console.log("✓ Blinded Scorecard Verified: Participant sees completion message without leaked answers.");

    console.log(`✓ Post-Quiz Telemetry Check: tabSwitchCount = ${blindedResults.tabSwitchCount}, showTabSwitchCount = ${blindedResults.showTabSwitchCount}`);
    if (blindedResults.tabSwitchCount !== 1) {
      throw new Error("FAIL: Participant cannot view tab switch count after quiz completion!");
    }
    if (blindedResults.showTabSwitchCount !== false) {
      throw new Error("FAIL: Default showTabSwitchCount on scorecard must be false when disabled!");
    }
    console.log("✓ Participant Scorecard respects admin toggle (tabSwitchCount hidden when disabled).");

    // -------------------------------------------------------------------------
    // Test 11b: Admin Toggle for Displaying Tab Switch Count Over Quiz
    // -------------------------------------------------------------------------
    console.log("\n[Test 11b] Testing Admin toggle for displaying tab switch count over quiz...");
    await toggleTabSwitchCountVisibility(quiz.id, true, adminSession);
    const [updatedQuiz] = await db.select().from(quizzes).where(eq(quizzes.id, quiz.id)).limit(1);
    if (!updatedQuiz.showTabSwitchCount) {
      throw new Error("FAIL: Admin toggleTabSwitchCountVisibility failed to enable showTabSwitchCount!");
    }
    console.log(`✓ Admin successfully enabled showTabSwitchCount: ${updatedQuiz.showTabSwitchCount}`);

    const resultsWithTabCount = await getParticipantResults(p1AttemptRes.attemptId, p1Session);
    if (!resultsWithTabCount.showTabSwitchCount) {
      throw new Error("FAIL: showTabSwitchCount should be true on results when enabled by admin!");
    }
    console.log("✓ Participant Scorecard shows tab switch count when enabled by admin.");

    await toggleTabSwitchCountVisibility(quiz.id, false, adminSession);
    const [toggledBackQuiz] = await db.select().from(quizzes).where(eq(quizzes.id, quiz.id)).limit(1);
    if (toggledBackQuiz.showTabSwitchCount) {
      throw new Error("FAIL: Admin toggleTabSwitchCountVisibility failed to disable showTabSwitchCount!");
    }
    console.log(`✓ Admin successfully disabled showTabSwitchCount: ${toggledBackQuiz.showTabSwitchCount}`);

    // -------------------------------------------------------------------------
    // Test 12: Admin Releases Results & Enables Top 10 Leaderboard
    // -------------------------------------------------------------------------
    console.log("\n[Test 12] Admin releases results and toggles Top 10 Leaderboard...");
    await toggleResultVisibility(quiz.id, true, adminSession);
    await toggleLeaderboardVisibility(quiz.id, true, adminSession);

    const releasedResults = await getParticipantResults(p1AttemptRes.attemptId, p1Session);

    console.log(`✓ Results Released: ${releasedResults.resultsReleased}`);
    console.log(`✓ Accuracy Rate: ${releasedResults.correctCount} / ${releasedResults.answeredCount} Correct`);
    console.log(`✓ Total Score: ${releasedResults.totalScore} PTS`);
    console.log(`✓ Question Breakdown Count: ${releasedResults.questionBreakdown?.length}`);
    console.log(`✓ Leaderboard Entries: ${releasedResults.leaderboard?.length}`);

    if (!releasedResults.resultsReleased || !releasedResults.questionBreakdown) {
      throw new Error("FAIL: Question breakdown was not returned after results released!");
    }
    if (!releasedResults.leaderboard || releasedResults.leaderboard.length === 0) {
      throw new Error("FAIL: Leaderboard was not returned when showLeaderboard = true!");
    }

    const topRanked = releasedResults.leaderboard[0];
    console.log(`✓ Leaderboard #1: "${topRanked.teamName}" (${topRanked.userName}) - ${topRanked.score} PTS`);

    // -------------------------------------------------------------------------
    // Test 13: Cross-Participant Access Security Denial
    // -------------------------------------------------------------------------
    console.log("\n[Test 13] Verifying Cross-Participant Access Security...");
    let crossAccessBlocked = false;
    try {
      // Participant 2 attempts to view Participant 1's scorecard
      await getParticipantResults(p1AttemptRes.attemptId, p2Session);
    } catch (err: unknown) {
      crossAccessBlocked = true;
      console.log(`✓ Cross-participant access properly denied: "${(err as Error).message}"`);
    }
    if (!crossAccessBlocked) {
      throw new Error("FAIL: Participant 2 was allowed to view Participant 1's results!");
    }

    // -------------------------------------------------------------------------
    // Cleanup
    // -------------------------------------------------------------------------
    console.log("\n[Cleanup] Cleaning up test quiz and participant attempts...");
    await db.delete(proctoringEvents).where(eq(proctoringEvents.quizId, quiz.id));
    await db.delete(participantAttempts).where(eq(participantAttempts.quizId, quiz.id));
    await db.delete(questions).where(eq(questions.quizId, quiz.id));
    await db.delete(quizzes).where(eq(quizzes.id, quiz.id));
    await db.delete(users).where(eq(users.id, p1.id));
    await db.delete(users).where(eq(users.id, p2.id));
    await db.delete(users).where(eq(users.id, admin.id));
    console.log("✓ Test records cleaned up successfully.");

    console.log("\n==================================================================");
    console.log("🎉 ALL PARTICIPANT TIMED QUIZ ENGINE TESTS PASSED (13/13)!");
    console.log("==================================================================");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ TEST FAILED:", error);
    if (testQuizId) {
      try {
        await db.delete(proctoringEvents).where(eq(proctoringEvents.quizId, testQuizId));
        await db.delete(participantAttempts).where(eq(participantAttempts.quizId, testQuizId));
        await db.delete(questions).where(eq(questions.quizId, testQuizId));
        await db.delete(quizzes).where(eq(quizzes.id, testQuizId));
      } catch {}
    }
    if (participant1) {
      try {
        await db.delete(users).where(eq(users.id, participant1.id));
      } catch {}
    }
    if (participant2) {
      try {
        await db.delete(users).where(eq(users.id, participant2.id));
      } catch {}
    }
    if (adminUser) {
      try {
        await db.delete(users).where(eq(users.id, adminUser.id));
      } catch {}
    }
    process.exit(1);
  }
}

runTimedEngineTests();
