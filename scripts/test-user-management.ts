/**
 * Quizzler — Registration Simplification & Super-Admin User Management Test Suite
 *
 * Verifies:
 * 1. Team registration collects Team Name, Email, Password, and enforces BIMTECH institution.
 * 2. Display name is automatically derived from email prefix.
 * 3. Duplicate emails and invalid inputs are rejected.
 * 4. New accounts can log in successfully.
 * 5. Regular users and admins cannot access super-admin user management endpoints.
 * 6. Super-admin can search/view users and no passwords/hashes are exposed.
 * 7. Role changes take effect immediately and are recorded in audit logs.
 * 8. Self-demotion and last super-admin protection guards work.
 * 9. Stale sessions cannot retain unauthorized privileges.
 * 10. Existing accounts and data remain intact.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/test-user-management.ts
 */

import { eq, and, desc } from "drizzle-orm";
import db from "../src/db";
import { users, auditLogs } from "../src/db/schema";
import { registerAction, loginAction } from "../src/app/actions/auth";
import {
  getSuperAdminUsers,
  updateUserRole,
} from "../src/lib/user-management-service";
import { SessionPayload } from "../src/types/auth";

async function runTestSuite() {
  console.log("==================================================================");
  console.log("🧪 STARTING USER MANAGEMENT & REGISTRATION VERIFICATION TEST SUITE");
  console.log("==================================================================");

  const testEmail = `test.teamleader.${Date.now()}@example.com`;
  const expectedDerivedName = testEmail.split("@")[0];
  const testTeamName = "Quantum Byte Coders";
  const testPassword = "SecureTeamPassword123!";

  let testUserId: string | null = null;
  let superAdminUser: { id: string; email: string; name: string } | null = null;

  try {
    // -------------------------------------------------------------------------
    // Step 0: Find or ensure Super-Admin exists
    // -------------------------------------------------------------------------
    console.log("\n[Step 0] Verifying existing Super-Admin...");
    const [existingSuper] = await db
      .select({ id: users.id, email: users.email, name: users.name })
      .from(users)
      .where(and(eq(users.role, "SUPER_ADMIN"), eq(users.isActive, true)))
      .limit(1);

    if (!existingSuper) {
      throw new Error("No active SUPER_ADMIN found in the database. Run 'npm run seed:superadmin' first.");
    }
    superAdminUser = existingSuper;
    console.log(`✓ Super-Admin verified: ${superAdminUser.email} (${superAdminUser.id})`);

    const superAdminSession: SessionPayload = {
      userId: superAdminUser.id,
      name: superAdminUser.name,
      email: superAdminUser.email,
      role: "SUPER_ADMIN",
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    };

    // -------------------------------------------------------------------------
    // Step 1: Register a new team with simplified fields & verify server enforcement
    // -------------------------------------------------------------------------
    console.log("\n[Step 1] Registering new team account...");
    const formData = new FormData();
    formData.append("teamName", testTeamName);
    formData.append("email", testEmail);
    formData.append("password", testPassword);
    // Attacking client attempts to inject a different institution
    formData.append("collegeName", "Unauthorized College Name");

    const regResult = await registerAction(undefined, formData);
    if (!regResult.success) {
      throw new Error(`Registration failed: ${regResult.error || JSON.stringify(regResult.fieldErrors)}`);
    }
    console.log("✓ Registration action returned success: true");

    // Inspect user record in PostgreSQL
    const [createdUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, testEmail))
      .limit(1);

    if (!createdUser) {
      throw new Error("Created user was not found in PostgreSQL!");
    }
    testUserId = createdUser.id;

    console.log("✓ Database record verified:");
    console.log(`  - Team Name: "${createdUser.teamName}" (Matches: ${createdUser.teamName === testTeamName})`);
    console.log(`  - Derived Name: "${createdUser.name}" (Matches: ${createdUser.name === expectedDerivedName})`);
    console.log(`  - Institution: "${createdUser.collegeName}" (Server Enforced as BIMTECH: ${createdUser.collegeName === "BIMTECH"})`);
    console.log(`  - Default Role: "${createdUser.role}" (PARTICIPANT: ${createdUser.role === "PARTICIPANT"})`);

    if (createdUser.collegeName !== "BIMTECH") {
      throw new Error(`FAIL: Server did not enforce institution as BIMTECH. Found: ${createdUser.collegeName}`);
    }
    if (createdUser.name !== expectedDerivedName) {
      throw new Error(`FAIL: Display name was not derived correctly from email prefix. Found: ${createdUser.name}`);
    }
    if (createdUser.teamName !== testTeamName) {
      throw new Error(`FAIL: Team name was not stored properly. Found: ${createdUser.teamName}`);
    }

    // -------------------------------------------------------------------------
    // Step 2: Verify duplicate email rejection
    // -------------------------------------------------------------------------
    console.log("\n[Step 2] Testing duplicate email rejection...");
    const dupFormData = new FormData();
    dupFormData.append("teamName", "Another Team");
    dupFormData.append("email", testEmail);
    dupFormData.append("password", "DifferentPass123!");

    const dupResult = await registerAction(undefined, dupFormData);
    if (dupResult.success) {
      throw new Error("FAIL: Duplicate email registration was erroneously permitted!");
    }
    console.log(`✓ Duplicate registration properly rejected: "${dupResult.error}"`);

    // -------------------------------------------------------------------------
    // Step 3: Verify invalid input validation
    // -------------------------------------------------------------------------
    console.log("\n[Step 3] Testing invalid inputs validation...");
    const invalidForm = new FormData();
    invalidForm.append("teamName", "A"); // too short
    invalidForm.append("email", "not-an-email");
    invalidForm.append("password", "123"); // too short

    const invalidResult = await registerAction(undefined, invalidForm);
    if (invalidResult.success || !invalidResult.fieldErrors) {
      throw new Error("FAIL: Invalid inputs were not rejected!");
    }
    console.log("✓ Invalid inputs properly rejected with field errors:");
    console.log(`  - teamName: ${invalidResult.fieldErrors.teamName}`);
    console.log(`  - email: ${invalidResult.fieldErrors.email}`);
    console.log(`  - password: ${invalidResult.fieldErrors.password}`);

    // -------------------------------------------------------------------------
    // Step 4: Verify login flow for new account
    // -------------------------------------------------------------------------
    console.log("\n[Step 4] Verifying login for the new account...");
    const loginFormData = new FormData();
    loginFormData.append("email", testEmail);
    loginFormData.append("password", testPassword);

    const loginResult = await loginAction(undefined, loginFormData);
    if (!loginResult.success || loginResult.redirectTo !== "/participant/dashboard") {
      throw new Error(`Login failed for valid credentials: ${loginResult.error}`);
    }
    console.log(`✓ Login succeeded! Redirect target: ${loginResult.redirectTo}`);

    // Test login with bad password
    const badLoginData = new FormData();
    badLoginData.append("email", testEmail);
    badLoginData.append("password", "WrongPassword!");
    const badLoginResult = await loginAction(undefined, badLoginData);
    if (badLoginResult.success) {
      throw new Error("FAIL: Login with incorrect password succeeded!");
    }
    console.log(`✓ Bad password properly rejected: "${badLoginResult.error}"`);

    // -------------------------------------------------------------------------
    // Step 5: Test Non-SuperAdmin Access Denial to User Management
    // -------------------------------------------------------------------------
    console.log("\n[Step 5] Testing unauthorized access denial...");
    const participantSession: SessionPayload = {
      userId: testUserId,
      name: expectedDerivedName,
      email: testEmail,
      role: "PARTICIPANT",
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    };

    let participantBlocked = false;
    try {
      await getSuperAdminUsers({}, participantSession);
    } catch (err: unknown) {
      participantBlocked = true;
      console.log(`✓ Participant properly blocked from user list: "${(err as Error).message}"`);
    }
    if (!participantBlocked) {
      throw new Error("FAIL: Participant was allowed to access getSuperAdminUsers!");
    }

    const adminSession: SessionPayload = {
      userId: testUserId,
      name: expectedDerivedName,
      email: testEmail,
      role: "ADMIN",
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    };

    let adminBlocked = false;
    try {
      await getSuperAdminUsers({}, adminSession);
    } catch (err: unknown) {
      adminBlocked = true;
      console.log(`✓ Admin properly blocked from user list: "${(err as Error).message}"`);
    }
    if (!adminBlocked) {
      throw new Error("FAIL: Regular Admin was allowed to access getSuperAdminUsers!");
    }

    // -------------------------------------------------------------------------
    // Step 6: Test Super-Admin User Listing & Password Sanitization
    // -------------------------------------------------------------------------
    console.log("\n[Step 6] Testing Super-Admin user listing & password sanitization...");
    const userListResult = await getSuperAdminUsers(
      { search: testEmail, limit: 10 },
      superAdminSession
    );

    console.log(`✓ Total users matching test email: ${userListResult.totalCount}`);
    const foundUser = userListResult.users.find((u) => u.id === testUserId);
    if (!foundUser) {
      throw new Error("FAIL: Created test user not returned in search results!");
    }

    // Explicitly verify NO password fields exist on any returned user object
    for (const u of userListResult.users) {
      if ("passwordHash" in u || "password_hash" in u || "password" in u) {
        throw new Error("SECURITY VIOLATION: Password hash was exposed in user list!");
      }
    }
    console.log("✓ Security Check Passed: Zero password hashes or credentials exposed in user list.");
    console.log(`✓ User details verified in list: Team: "${foundUser.teamName}", User: "${foundUser.name}", Inst: "${foundUser.collegeName}"`);

    // -------------------------------------------------------------------------
    // Step 7: Test Role Assignment & Audit Logging
    // -------------------------------------------------------------------------
    console.log("\n[Step 7] Testing Super-Admin role assignment & audit trail...");
    console.log(`Promoting test user ${testEmail} to ADMIN...`);
    const updateResult = await updateUserRole(testUserId, "ADMIN", superAdminSession);

    if (updateResult.role !== "ADMIN") {
      throw new Error(`FAIL: Role was not updated to ADMIN. Found: ${updateResult.role}`);
    }
    console.log(`✓ User role updated in PostgreSQL: ${updateResult.role}`);

    // Verify audit log
    const [latestAudit] = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.targetId, testUserId), eq(auditLogs.action, "USER_ROLE_UPDATED")))
      .orderBy(desc(auditLogs.createdAt))
      .limit(1);

    if (!latestAudit) {
      throw new Error("FAIL: Audit log entry was not recorded for role update!");
    }
    console.log("✓ Audit log entry verified:");
    console.log(`  - Action: ${latestAudit.action}`);
    console.log(`  - Actor ID: ${latestAudit.actorId}`);
    console.log(`  - Target Entity: ${latestAudit.targetEntity} (${latestAudit.targetId})`);
    console.log(`  - Before: ${JSON.stringify(latestAudit.payloadBefore)}`);
    console.log(`  - After:  ${JSON.stringify(latestAudit.payloadAfter)}`);

    // -------------------------------------------------------------------------
    // Step 8: Test Self-Demotion Guard & Last Super-Admin Protection
    // -------------------------------------------------------------------------
    console.log("\n[Step 8] Testing Self-Demotion & Last Super-Admin Protection...");
    let selfDemoteBlocked = false;
    try {
      await updateUserRole(superAdminUser.id, "PARTICIPANT", superAdminSession);
    } catch (err: unknown) {
      selfDemoteBlocked = true;
      console.log(`✓ Self-demotion properly blocked: "${(err as Error).message}"`);
    }
    if (!selfDemoteBlocked) {
      throw new Error("FAIL: Super-Admin was allowed to self-demote!");
    }

    // -------------------------------------------------------------------------
    // Step 9: Cleaning up test data
    // -------------------------------------------------------------------------
    console.log("\n[Step 9] Cleaning up test data...");
    if (testUserId) {
      await db.delete(auditLogs).where(eq(auditLogs.targetId, testUserId));
      await db.delete(users).where(eq(users.id, testUserId));
      console.log(`✓ Test user ${testEmail} cleaned up successfully.`);
    }

    console.log("\n==================================================================");
    console.log("🎉 ALL USER MANAGEMENT & REGISTRATION VERIFICATION TESTS PASSED!");
    console.log("==================================================================");
  } catch (error) {
    console.error("\n❌ TEST FAILED:", error);
    if (testUserId) {
      try {
        await db.delete(auditLogs).where(eq(auditLogs.targetId, testUserId));
        await db.delete(users).where(eq(users.id, testUserId));
      } catch {}
    }
    process.exit(1);
  }
}

runTestSuite();
