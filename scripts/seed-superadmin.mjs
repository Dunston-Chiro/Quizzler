/**
 * College Quiz Platform - Super-Admin Initializer Script
 * PostgreSQL &bull; Neon Serverless &bull; $0 Budget Stack
 *
 * Usage:
 *   node --env-file=.env.local scripts/seed-superadmin.mjs
 *   or: npm run seed:superadmin
 */

import { Pool } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";

async function main() {
  const connectionString =
    process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

  if (!connectionString) {
    console.error("❌ Error: DATABASE_URL environment variable is missing.");
    console.error(
      "Ensure .env.local is populated with your Neon PostgreSQL connection string."
    );
    process.exit(1);
  }

  const email = (
    process.env.SUPERADMIN_EMAIL || "superadmin@quizzler.local"
  )
    .toLowerCase()
    .trim();
  const password = process.env.SUPERADMIN_PASSWORD || "AdminPass123!Secure";
  const name = process.env.SUPERADMIN_NAME || "Platform Super Administrator";

  console.log("Connecting to Neon PostgreSQL...");
  const pool = new Pool({ connectionString });

  try {
    // 1. Ensure table exists or check if super-admin already exists
    const checkTable = await pool.query(`
      SELECT to_regclass('public.users') as table_exists;
    `);

    if (!checkTable.rows[0].table_exists) {
      console.error(
        "❌ The 'users' table does not exist yet. Please run 'npm run db:push' first to apply the Drizzle schema."
      );
      await pool.end();
      process.exit(1);
    }

    const existingSuperAdminRes = await pool.query(
      "SELECT id, email FROM users WHERE role = $1 LIMIT 1",
      ["SUPER_ADMIN"]
    );

    if (existingSuperAdminRes.rows.length > 0) {
      console.log(
        `⚠️ A Super-Admin already exists in this database (${existingSuperAdminRes.rows[0].email}). Initialization skipped.`
      );
      await pool.end();
      process.exit(0);
    }

    // 2. Check if email exists with another role
    const existingUserRes = await pool.query(
      "SELECT id FROM users WHERE email = $1 LIMIT 1",
      [email]
    );

    if (existingUserRes.rows.length > 0) {
      console.log(`Promoting existing user (${email}) to SUPER_ADMIN...`);
      await pool.query(
        "UPDATE users SET role = $1, updated_at = NOW() WHERE email = $2",
        ["SUPER_ADMIN", email]
      );
      console.log(`✅ User ${email} has been promoted to SUPER_ADMIN.`);
      await pool.end();
      process.exit(0);
    }

    // 3. Insert new Super-Admin
    console.log(`Creating initial Super-Admin account: ${email}...`);
    const passwordHash = await bcrypt.hash(password, 10);

    await pool.query(
      `INSERT INTO users (name, email, password_hash, role, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
      [name, email, passwordHash, "SUPER_ADMIN", true]
    );

    console.log("=================================================");
    console.log("✅ Super-Admin initialized successfully!");
    console.log(`   Email: ${email}`);
    console.log(`   Role:  SUPER_ADMIN`);
    console.log("=================================================");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
