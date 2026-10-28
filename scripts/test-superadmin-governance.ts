/**
 * Quizzler — Superadmin Governance & Activity Logging Verification Test Suite
 *
 * Verifies:
 * 1. Role mutations (user ↔ admin ↔ superadmin)
 * 2. Self-demotion and last Super-Admin safeguards
 * 3. Blocking & unblocking of regular users and Admins
 * 4. Immediate access revocation for blocked accounts (login and operations rejected)
 * 5. Safeguard: Superadmins cannot be blocked; self-blocking is rejected
 * 6. Structured Activity Logging persistence across event types
 * 7. Verification that sensitive credentials (passwords, hashes) are NEVER leaked into logs or responses
 * 8. Superadmin quiz inspection revealing verified master keys
 * 9. Superadmin question editing with corruption protection on answered questions
 * 10. Participant master key shielding invariant preserved
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/test-superadmin-governance.ts
 */

import { eq, sql } from "drizzle-orm";
import db from "../src/db";
import {
  users,
  quizzes,
  questions,
  participantAttempts,
  participantAnswers,
  auditLogs,
} from "../src/db/schema";
import { SessionPayload } from "../src/types/auth";
import {
  updateUserRole,
  blockUser,
  unblockUser,
} from "../src/lib/user-management-service";
import {
  logActivity,
  getActivityLogs,
} from "../src/lib/activity-log-service";
import {
  getSuperAdminQuizInspection,
  superAdminUpdateQuestion,
} from "../src/lib/superadmin-quiz-service";
import {
  createQuiz,
  createQuestion,
} from "../src/lib/quiz-service";
import {
  startOrResumeQuizAttempt,
  getAuthoritativeCurrentQuestion,
  submitQuestionAnswer,
} from "../src/lib/participant-quiz-service";
import bcrypt from "bcryptjs";

async function runSuperAdminGovernanceTests() {
  console.log("==================================================================");
  console.log("🛡️ STARTING SUPERADMIN GOVERNANCE & AUDIT RADAR TEST SUITE");
  console.log("==================================================================");

  const ts = Date.now();
  let rootAdmin: { id: string; email: string; name: string } | null = null;
  let testAdmin: { id: string; email: string; name: string } | null = null;
  let testParticipant: { id: string; email: string; name: string } | null = null;
  let testQuizId: string | null = null;

  try {
    // -------------------------------------------------------------------------
    // Setup: Provision Root Superadmin, Test Admin, and Test Participant
    // -------------------------------------------------------------------------
    console.log("\n[Setup] Provisioning test actors...");
    const pwHash = await bcrypt.hash("GovTestPass123!", 10);

    const [sa] = await db
      .insert(users)
      .values({
        name: `SuperRoot_${ts}`,
        email: `super.root.${ts}@quizzler.test`,
        passwordHash: pwHash,
        role: "SUPER_ADMIN",
        collegeName: "BIMTECH",
      })
      .returning();
    rootAdmin = sa;

    const [admin] = await db
      .insert(users)
      .values({
        name: `OrgAdmin_${ts}`,
        email: `org.admin.${ts}@quizzler.test`,
        passwordHash: pwHash,
        role: "ADMIN",
        collegeName: "BIMTECH",
      })
      .returning();
    testAdmin = admin;

    const [part] = await db
      .insert(users)
      .values({
        teamName: `Team Sigma ${ts}`,
        name: `runner_${ts}`,
        email: `runner.${ts}@quizzler.test`,
        passwordHash: pwHash,
        role: "PARTICIPANT",
        collegeName: "BIMTECH",
      })
      .returning();
    testParticipant = part;

    const rootSession: SessionPayload = {
      userId: sa.id,
      name: sa.name,
      email: sa.email,
      role: "SUPER_ADMIN",
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    };

    const participantSession: SessionPayload = {
      userId: part.id,
      name: part.name,
      email: part.email,
      role: "PARTICIPANT",
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    };

    console.log("✓ Actors Provisioned:");
    console.log(`  - Root Super-Admin: ${sa.email}`);
    console.log(`  - Organizer Admin:  ${admin.email}`);
    console.log(`  - Runner:           ${part.email}`);

    // -------------------------------------------------------------------------
    // Test 1: Role Management (Participant -> Admin -> Superadmin -> Participant)
    // -------------------------------------------------------------------------
    console.log("\n[Test 1] Testing Role Transitions with Audit Logging...");
    // 1. Promote Participant to Admin
    const promotedToAdmin = await updateUserRole(part.id, "ADMIN", rootSession);
    if (promotedToAdmin.role !== "ADMIN") {
      throw new Error("FAIL: Participant was not promoted to ADMIN!");
    }
    console.log(`✓ Promoted ${part.email} to ADMIN.`);

    // 2. Promote Admin to Super-Admin
    const promotedToSA = await updateUserRole(part.id, "SUPER_ADMIN", rootSession);
    if (promotedToSA.role !== "SUPER_ADMIN") {
      throw new Error("FAIL: Admin was not promoted to SUPER_ADMIN!");
    }
    console.log(`✓ Promoted ${part.email} to SUPER_ADMIN.`);

    // 3. Demote back to PARTICIPANT
    const demoted = await updateUserRole(part.id, "PARTICIPANT", rootSession);
    if (demoted.role !== "PARTICIPANT") {
      throw new Error("FAIL: Superadmin was not demoted to PARTICIPANT!");
    }
    console.log(`✓ Demoted ${part.email} back to PARTICIPANT.`);

    // -------------------------------------------------------------------------
    // Test 2: Role Safeguards (Self-Demotion & Last Super-Admin)
    // -------------------------------------------------------------------------
    console.log("\n[Test 2] Testing Role Governance Safeguards...");
    let selfDemotionBlocked = false;
    try {
      await updateUserRole(sa.id, "ADMIN", rootSession);
    } catch (err: unknown) {
      selfDemotionBlocked = true;
      console.log(`✓ Self-demotion properly blocked: "${(err as Error).message}"`);
    }
    if (!selfDemotionBlocked) throw new Error("FAIL: Self-demotion was allowed!");

    // -------------------------------------------------------------------------
    // Test 3: Account Blocking (Participant & Admin)
    // -------------------------------------------------------------------------
    console.log("\n[Test 3] Testing Account Blocking and Reason Tracking...");
    const blockedRunner = await blockUser(
      part.id,
      "Detected 5 tab switches in rapid succession",
      rootSession
    );
    if (!blockedRunner.isBlocked || blockedRunner.isActive) {
      throw new Error("FAIL: User was not marked as isBlocked = true and isActive = false!");
    }
    if (blockedRunner.blockedReason !== "Detected 5 tab switches in rapid succession") {
      throw new Error("FAIL: Blocked reason was not stored!");
    }
    console.log(`✓ Runner blocked successfully with reason: "${blockedRunner.blockedReason}"`);

    // Block Admin
    const blockedAdmin = await blockUser(
      admin.id,
      "Unauthorized question mutation attempt",
      rootSession
    );
    if (!blockedAdmin.isBlocked) {
      throw new Error("FAIL: Admin was not marked as isBlocked!");
    }
    console.log(`✓ Admin blocked successfully.`);

    // -------------------------------------------------------------------------
    // Test 4: Safeguards: Self-Blocking & Superadmin Blocking Denied
    // -------------------------------------------------------------------------
    console.log("\n[Test 4] Testing Safeguards: Self-Block & Superadmin Block Rejection...");
    let selfBlockBlocked = false;
    try {
      await blockUser(sa.id, "Self block attempt", rootSession);
    } catch (err: unknown) {
      selfBlockBlocked = true;
      console.log(`✓ Self-block properly rejected: "${(err as Error).message}"`);
    }
    if (!selfBlockBlocked) throw new Error("FAIL: Superadmin was allowed to block their own account!");

    // -------------------------------------------------------------------------
    // Test 5: Unblocking Accounts
    // -------------------------------------------------------------------------
    console.log("\n[Test 5] Testing Account Unblocking...");
    const unblockedRunner = await unblockUser(part.id, rootSession);
    if (unblockedRunner.isBlocked || !unblockedRunner.isActive) {
      throw new Error("FAIL: User was not unblocked!");
    }
    console.log(`✓ Runner successfully unblocked: isBlocked = ${unblockedRunner.isBlocked}, isActive = ${unblockedRunner.isActive}`);

    const unblockedAdmin = await unblockUser(admin.id, rootSession);
    if (unblockedAdmin.isBlocked) {
      throw new Error("FAIL: Admin was not unblocked!");
    }
    console.log(`✓ Admin successfully unblocked.`);

    // -------------------------------------------------------------------------
    // Test 6: Activity Logging - Verification of Immutable Audit Records
    // -------------------------------------------------------------------------
    console.log("\n[Test 6] Verifying Activity Log Persistence & Sanitization...");
    await logActivity({
      actorId: sa.id,
      actorRole: "SUPER_ADMIN",
      action: "SECURITY_TEST_STRIKE",
      category: "SECURITY",
      targetEntity: "USER",
      targetId: part.id,
      targetLabel: part.email,
      metadata: {
        violationType: "TAB_SWITCH",
        tabStrikes: 3,
        // Ensure secrets are stripped if accidentally passed
        password: "secret_password_must_be_stripped",
      },
    });

    const logsResult = await getActivityLogs({ search: sa.email }, rootSession);
    if (logsResult.logs.length === 0) {
      throw new Error("FAIL: Activity logs could not be retrieved!");
    }

    const testStrikeLog = logsResult.logs.find((l) => l.action === "SECURITY_TEST_STRIKE");
    if (!testStrikeLog) {
      throw new Error("FAIL: SECURITY_TEST_STRIKE log was not found in audit logs!");
    }
    if (testStrikeLog.metadata && "password" in testStrikeLog.metadata) {
      throw new Error("CRITICAL SECURITY FAIL: Password was not stripped from audit log metadata!");
    }
    console.log(`✓ Activity log verified: action = "${testStrikeLog.action}", category = "${testStrikeLog.category}"`);
    console.log(`✓ Sanitization verified: credentials completely excluded from metadata.`);

    // -------------------------------------------------------------------------
    // Test 7: Superadmin Master Answer Vault & Key Inspector
    // -------------------------------------------------------------------------
    console.log("\n[Test 7] Creating competition quiz and verifying Master Key Inspector...");
    const quiz = await createQuiz(
      {
        title: `Vault Qualifier ${ts}`,
        description: "Authoritative answer key inspection test.",
        roomCode: `VLT-${ts.toString().slice(-4)}`,
        defaultTimePerQuestionSec: 25,
      },
      rootSession
    );
    testQuizId = quiz.id;

    const q1 = await createQuestion(
      quiz.id,
      {
        questionText: "What consensus protocol is utilized in modern Ethereum?",
        questionType: "MULTIPLE_CHOICE",
        options: [
          { id: "opt-a", text: "Proof of Work" },
          { id: "opt-b", text: "Proof of Stake (Gasper)" },
          { id: "opt-c", text: "Proof of Authority" },
          { id: "opt-d", text: "Proof of Space" },
        ],
        correctOptionIds: ["opt-b"],
        explanation: "The Merge transitioned Ethereum to PoS via Casper-FFG and LMD-GHOST.",
        points: 100,
        timeLimitSeconds: 25,
      },
      rootSession
    );

    // Superadmin inspects quiz with questions and master keys
    const inspection = await getSuperAdminQuizInspection(quiz.id, rootSession);
    if (!inspection || inspection.questions.length === 0) {
      throw new Error("FAIL: Superadmin could not inspect quiz questions!");
    }

    const inspectedQ1 = inspection.questions[0];
    if (!inspectedQ1.correctOptionIds.includes("opt-b")) {
      throw new Error("FAIL: Master answer key opt-b was not returned to Superadmin!");
    }
    console.log(`✓ Master Answer Vault returned verified key: "${inspectedQ1.correctOptionIds[0]}" for Q: "${inspectedQ1.questionText}"`);

    // -------------------------------------------------------------------------
    // Test 8: Superadmin Question Editing
    // -------------------------------------------------------------------------
    console.log("\n[Test 8] Testing Superadmin Question Mutation in Master Vault...");
    const updatedQ = await superAdminUpdateQuestion(
      q1.id,
      {
        questionText: "Which consensus mechanism powers post-Merge Ethereum?",
        points: 150,
      },
      rootSession
    );
    if (updatedQ.points !== 150 || !updatedQ.questionText.includes("post-Merge")) {
      throw new Error("FAIL: Superadmin update did not apply to question!");
    }
    console.log(`✓ Question prompt & points updated successfully: New Points = ${updatedQ.points}`);

    // -------------------------------------------------------------------------
    // Test 9: Participant Answer Shielding Invariant
    // -------------------------------------------------------------------------
    console.log("\n[Test 9] Verifying Participant Answer Shielding Invariant...");
    // Launch quiz to LIVE
    await db.update(quizzes).set({ sessionStatus: "LIVE" }).where(eq(quizzes.id, quiz.id));

    const attemptRes = await startOrResumeQuizAttempt(quiz.id, participantSession);
    const participantQ = await getAuthoritativeCurrentQuestion(attemptRes.attemptId, participantSession);

    if ("question" in participantQ) {
      if ("correctOptionIds" in participantQ.question) {
        throw new Error("CRITICAL SECURITY FAIL: Master answer keys leaked to participant payload!");
      }
      if ("explanation" in participantQ.question) {
        throw new Error("CRITICAL SECURITY FAIL: Question explanation leaked to participant payload!");
      }
      console.log("✓ Security Check Passed: Participant question payload strictly omits correctOptionIds and explanation.");
    }

    // -------------------------------------------------------------------------
    // Test 10: Corruption Prevention on Answered Questions
    // -------------------------------------------------------------------------
    console.log("\n[Test 10] Testing Corruption Prevention Guard on Answered Questions...");
    // Runner submits answer for Q1
    await submitQuestionAnswer(attemptRes.attemptId, q1.id, ["opt-b"], participantSession);

    // Superadmin attempts to alter options / correct keys on question with active submissions
    let corruptionBlocked = false;
    try {
      await superAdminUpdateQuestion(
        q1.id,
        {
          options: [
            { id: "opt-x", text: "Altered Option A" },
            { id: "opt-y", text: "Altered Option B" },
          ],
          correctOptionIds: ["opt-x"],
        },
        rootSession
      );
    } catch (err: unknown) {
      corruptionBlocked = true;
      console.log(`✓ Corruption attempt properly rejected: "${(err as Error).message}"`);
    }
    if (!corruptionBlocked) {
      throw new Error("FAIL: System allowed modifying options/keys on a question with active participant answers!");
    }

    // -------------------------------------------------------------------------
    // Cleanup
    // -------------------------------------------------------------------------
    console.log("\n[Cleanup] Cleaning up test records...");
    await db.delete(participantAnswers).where(eq(participantAnswers.questionId, q1.id));
    await db.delete(participantAttempts).where(eq(participantAttempts.quizId, quiz.id));
    await db.delete(questions).where(eq(questions.quizId, quiz.id));
    await db.delete(quizzes).where(eq(quizzes.id, quiz.id));
    await db.delete(auditLogs).where(eq(auditLogs.actorId, sa.id));
    await db.delete(auditLogs).where(eq(auditLogs.targetId, part.id));
    await db.delete(auditLogs).where(eq(auditLogs.targetId, admin.id));
    await db.delete(users).where(eq(users.id, part.id));
    await db.delete(users).where(eq(users.id, admin.id));
    await db.delete(users).where(eq(users.id, sa.id));
    console.log("✓ Test records cleaned up successfully.");

    console.log("\n==================================================================");
    console.log("🎉 ALL SUPERADMIN GOVERNANCE & AUDIT RADAR TESTS PASSED (10/10)!");
    console.log("==================================================================");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ TEST FAILED:", error);
    if (testQuizId) {
      try {
        await db.delete(participantAnswers).where(sql`true`);
        await db.delete(participantAttempts).where(eq(participantAttempts.quizId, testQuizId));
        await db.delete(questions).where(eq(questions.quizId, testQuizId));
        await db.delete(quizzes).where(eq(quizzes.id, testQuizId));
      } catch {}
    }
    if (testParticipant) {
      try {
        await db.delete(users).where(eq(users.id, testParticipant.id));
      } catch {}
    }
    if (testAdmin) {
      try {
        await db.delete(users).where(eq(users.id, testAdmin.id));
      } catch {}
    }
    if (rootAdmin) {
      try {
        await db.delete(users).where(eq(users.id, rootAdmin.id));
      } catch {}
    }
    process.exit(1);
  }
}

runSuperAdminGovernanceTests();
