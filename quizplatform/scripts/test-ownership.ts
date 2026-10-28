/**
 * Automated Test: Admin Question Ownership & Permission Enforcement
 * Tests cross-admin access denial, owner access, and super-admin access.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/test-ownership.ts
 */

import { Pool } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import {
  createQuiz,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  getQuizWithQuestions,
} from "@/lib/quiz-service";
import { SessionPayload } from "@/types/auth";

async function runOwnershipTests() {
  console.log("==================================================================");
  console.log("🧪 STARTING QUESTION OWNERSHIP & ADMIN PERMISSIONS TESTS");
  console.log("==================================================================");

  const pool = new Pool({
    connectionString:
      process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL,
  });

  // 1. Ensure test users exist: admin1, admin2, superadmin
  const passwordHash = await bcrypt.hash("Password123!", 10);

  async function getOrCreateUser(email: string, name: string, role: string) {
    const existing = await pool.query(
      "SELECT id, name, email, role FROM users WHERE email = $1",
      [email]
    );
    if (existing.rows.length > 0) return existing.rows[0];

    const inserted = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, true, NOW(), NOW())
       RETURNING id, name, email, role`,
      [name, email, passwordHash, role]
    );
    return inserted.rows[0];
  }

  const userAdmin1 = await getOrCreateUser(
    "test.admin1@quizzler.local",
    "Admin Alpha",
    "ADMIN"
  );
  const userAdmin2 = await getOrCreateUser(
    "test.admin2@quizzler.local",
    "Admin Beta",
    "ADMIN"
  );
  const userSuper = await getOrCreateUser(
    "test.super@quizzler.local",
    "Super Chief",
    "SUPER_ADMIN"
  );

  console.log(`✓ Test Users Ready:`);
  console.log(`  - Admin 1: ${userAdmin1.email} (${userAdmin1.id})`);
  console.log(`  - Admin 2: ${userAdmin2.email} (${userAdmin2.id})`);
  console.log(`  - SuperAdmin: ${userSuper.email} (${userSuper.id})`);

  const sessionAdmin1: SessionPayload = {
    userId: userAdmin1.id,
    name: userAdmin1.name,
    email: userAdmin1.email,
    role: "ADMIN",
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  };

  const sessionAdmin2: SessionPayload = {
    userId: userAdmin2.id,
    name: userAdmin2.name,
    email: userAdmin2.email,
    role: "ADMIN",
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  };

  const sessionSuper: SessionPayload = {
    userId: userSuper.id,
    name: userSuper.name,
    email: userSuper.email,
    role: "SUPER_ADMIN",
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  };

  // 2. Admin 1 creates Quiz A
  console.log("\n[Step 1] Admin 1 creates Quiz A...");
  const quizA = await createQuiz(
    {
      title: "Distributed Consensus Protocols",
      description: "Test Quiz by Admin 1",
    },
    sessionAdmin1
  );
  console.log(`✓ Quiz A created: ${quizA.id} (Owner: ${quizA.createdBy})`);

  // 3. Admin 1 creates Question A1 in Quiz A
  console.log("\n[Step 2] Admin 1 adds Question A1 to Quiz A...");
  const questionA1 = await createQuestion(
    quizA.id,
    {
      questionText: "Which consensus mechanism does Ethereum 2.0 utilize?",
      questionType: "MULTIPLE_CHOICE",
      options: [
        { id: "opt1", text: "Proof-of-Stake (PoS)" },
        { id: "opt2", text: "Proof-of-Work (PoW)" },
        { id: "opt3", text: "Delegated Proof-of-Capacity" },
      ],
      correctOptionIds: ["opt1"],
      points: 100,
      timeLimitSeconds: 30,
    },
    sessionAdmin1
  );
  console.log(
    `✓ Question A1 created: ${questionA1.id} (Owner: ${questionA1.createdBy})`
  );

  // 4. CROSS-ADMIN DENIAL: Admin 2 attempts to read Quiz A with questions
  console.log(
    "\n[Step 3] Cross-Admin: Admin 2 attempts to view Quiz A and its questions..."
  );
  try {
    await getQuizWithQuestions(quizA.id, sessionAdmin2);
    throw new Error(
      "SECURITY FAILURE: Admin 2 was allowed to read Admin 1's quiz!"
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("ACCESS_DENIED")) {
      console.log(`✓ Access properly denied to Admin 2: "${msg}"`);
    } else {
      throw err;
    }
  }

  // 5. CROSS-ADMIN DENIAL: Admin 2 attempts to add question to Admin 1's Quiz A
  console.log(
    "\n[Step 4] Cross-Admin: Admin 2 attempts to inject a question into Admin 1's Quiz A..."
  );
  try {
    await createQuestion(
      quizA.id,
      {
        questionText: "Injected question by rogue admin?",
        options: [
          { id: "1", text: "Yes" },
          { id: "2", text: "No" },
        ],
        correctOptionIds: ["1"],
      },
      sessionAdmin2
    );
    throw new Error(
      "SECURITY FAILURE: Admin 2 was allowed to inject questions into Admin 1's quiz!"
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("ACCESS_DENIED")) {
      console.log(`✓ Injection properly blocked for Admin 2: "${msg}"`);
    } else {
      throw err;
    }
  }

  // 6. CROSS-ADMIN DENIAL: Admin 2 attempts to modify Question A1
  console.log(
    "\n[Step 5] Cross-Admin: Admin 2 attempts to modify Question A1 prompt..."
  );
  try {
    await updateQuestion(
      questionA1.id,
      { questionText: "Tampered question prompt!" },
      sessionAdmin2
    );
    throw new Error(
      "SECURITY FAILURE: Admin 2 was allowed to update Admin 1's question!"
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("ACCESS_DENIED")) {
      console.log(`✓ Modification properly blocked for Admin 2: "${msg}"`);
    } else {
      throw err;
    }
  }

  // 7. CROSS-ADMIN DENIAL: Admin 2 attempts to delete Question A1
  console.log(
    "\n[Step 6] Cross-Admin: Admin 2 attempts to delete Question A1..."
  );
  try {
    await deleteQuestion(questionA1.id, sessionAdmin2);
    throw new Error(
      "SECURITY FAILURE: Admin 2 was allowed to delete Admin 1's question!"
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("ACCESS_DENIED")) {
      console.log(`✓ Deletion properly blocked for Admin 2: "${msg}"`);
    } else {
      throw err;
    }
  }

  // 8. OWNER ACCESS: Admin 1 modifies their own question
  console.log(
    "\n[Step 7] Owner Access: Admin 1 updates Question A1 points to 150..."
  );
  const updatedQ = await updateQuestion(
    questionA1.id,
    { points: 150 },
    sessionAdmin1
  );
  if (updatedQ.points !== 150)
    throw new Error("Owner update failed to save points.");
  console.log(
    `✓ Owner successfully updated Question A1 (New points: ${updatedQ.points})`
  );

  // 9. SUPER-ADMIN ACCESS: Super-Admin reads and updates Question A1
  console.log(
    "\n[Step 8] Super-Admin Oversight: Super-Admin reads and manages Question A1..."
  );
  const superView = await getQuizWithQuestions(quizA.id, sessionSuper);
  if (!superView || superView.questions.length === 0) {
    throw new Error("Super-admin failed to view Admin 1's quiz questions.");
  }
  console.log(
    `✓ Super-Admin successfully accessed Admin 1's quiz (${superView.questions.length} questions).`
  );

  const superUpdated = await updateQuestion(
    questionA1.id,
    { explanation: "Proof-of-Stake replaced PoW in the Paris upgrade." },
    sessionSuper
  );
  console.log(
    `✓ Super-Admin successfully modified explanation: "${superUpdated.explanation}"`
  );

  // Clean up test quiz
  console.log("\n[Step 9] Cleaning up test data...");
  await pool.query("DELETE FROM questions WHERE quiz_id = $1", [quizA.id]);
  await pool.query("DELETE FROM quizzes WHERE id = $1", [quizA.id]);
  console.log("✓ Test Quiz and Question cleaned up successfully.");

  await pool.end();

  console.log(
    "\n=================================================================="
  );
  console.log("🎉 ALL QUESTION OWNERSHIP & ROLE PERMISSION TESTS PASSED!");
  console.log(
    "=================================================================="
  );
}

runOwnershipTests().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
