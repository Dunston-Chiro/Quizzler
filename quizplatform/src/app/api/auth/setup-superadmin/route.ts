import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import db from "@/db";
import { users } from "@/db/schema";

export async function POST(req: NextRequest) {
  try {
    // Check if a superadmin already exists
    const [existingSuperAdmin] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, "SUPER_ADMIN"))
      .limit(1);

    if (existingSuperAdmin) {
      return NextResponse.json(
        {
          error:
            "A Super-Admin is already registered. Initial setup is permanently locked.",
        },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const email = (
      body.email ||
      process.env.SUPERADMIN_EMAIL ||
      "superadmin@quizplatform.local"
    )
      .trim()
      .toLowerCase();
    const password =
      body.password ||
      process.env.SUPERADMIN_PASSWORD ||
      "AdminPass123!Secure";
    const name =
      body.name ||
      process.env.SUPERADMIN_NAME ||
      "Platform Super Administrator";

    if (!email || !password || password.length < 8) {
      return NextResponse.json(
        {
          error:
            "Valid email and a secure password (min 8 characters) are required for superadmin setup.",
        },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const [superAdmin] = await db
      .insert(users)
      .values({
        name,
        email,
        passwordHash,
        role: "SUPER_ADMIN",
        isActive: true,
      })
      .returning();

    return NextResponse.json(
      {
        message: "Initial Super-Admin account provisioned successfully.",
        user: {
          id: superAdmin.id,
          email: superAdmin.email,
          role: superAdmin.role,
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("Superadmin initialization error:", error);
    return NextResponse.json(
      { error: "Internal server error during superadmin setup" },
      { status: 500 }
    );
  }
}
