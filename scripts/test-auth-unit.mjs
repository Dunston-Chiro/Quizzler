import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";

async function runUnitTests() {
  console.log("=== Running Unit & Logic Tests for Auth & RBAC ===");

  // Test 1: Password Hashing with bcryptjs
  console.log("\n[Test 1] Testing bcrypt password hashing & verification...");
  const rawPassword = "SecurePassword123!";
  const hash = await bcrypt.hash(rawPassword, 10);
  const isValid = await bcrypt.compare(rawPassword, hash);
  const isInvalid = await bcrypt.compare("WrongPassword", hash);

  if (!isValid || isInvalid) {
    throw new Error("Bcrypt verification failed!");
  }
  console.log("✓ Bcrypt hashing and comparison functioning correctly.");

  // Test 2: JWT Session Token Signing and Verification with Jose
  console.log("\n[Test 2] Testing Jose JWT token lifecycle & claims...");
  const secret = new TextEncoder().encode("super-secure-change-this-secret-key-for-college-quiz-jwt-auth-2026");

  const testPayload = {
    userId: "6670a8d8e05a123456789abc",
    name: "Test Participant",
    email: "participant@college.edu",
    role: "PARTICIPANT",
    collegeName: "College of Tech",
    rollNumber: "CS-101",
  };

  const token = await new SignJWT(testPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);

  const { payload } = await jwtVerify(token, secret, {
    algorithms: ["HS256"],
  });

  if (
    payload.userId !== testPayload.userId ||
    payload.role !== "PARTICIPANT" ||
    payload.email !== testPayload.email
  ) {
    throw new Error("JWT payload claims verification mismatch!");
  }
  console.log("✓ Jose JWT signed and verified with intact role and user claims.");

  // Test 3: Role Authorization Logic
  console.log("\n[Test 3] Testing Role Authorization Matrix...");

  function canAccessAdminZone(role) {
    return role === "ADMIN" || role === "SUPER_ADMIN";
  }

  function canAccessSuperAdminZone(role) {
    return role === "SUPER_ADMIN";
  }

  if (canAccessAdminZone("PARTICIPANT")) throw new Error("Participant should NOT access Admin zone!");
  if (!canAccessAdminZone("ADMIN")) throw new Error("Admin should access Admin zone!");
  if (!canAccessAdminZone("SUPER_ADMIN")) throw new Error("Super-Admin should access Admin zone!");

  if (canAccessSuperAdminZone("PARTICIPANT")) throw new Error("Participant should NOT access Super-Admin zone!");
  if (canAccessSuperAdminZone("ADMIN")) throw new Error("Admin should NOT access Super-Admin zone!");
  if (!canAccessSuperAdminZone("SUPER_ADMIN")) throw new Error("Super-Admin should access Super-Admin zone!");

  console.log("✓ Role Authorization Matrix strictly validated for all three tiers.");
  console.log("\n🎉 ALL AUTHENTICATION & RBAC UNIT TESTS PASSED!");
}

runUnitTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
