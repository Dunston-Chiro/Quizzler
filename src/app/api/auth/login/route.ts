import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import db from "@/db";
import { users } from "@/db/schema";
import { createSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (!user) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: "This account has been deactivated. Please contact support." },
        { status: 403 }
      );
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    await createSession({
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      collegeName: user.collegeName || undefined,
      rollNumber: user.rollNumber || undefined,
    });

    let redirectTo = "/participant/dashboard";
    if (user.role === "SUPER_ADMIN") {
      redirectTo = "/super-admin/dashboard";
    } else if (user.role === "ADMIN") {
      redirectTo = "/admin/dashboard";
    }

    return NextResponse.json({
      message: "Authentication successful",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        collegeName: user.collegeName,
        rollNumber: user.rollNumber,
      },
      redirectTo,
    });
  } catch (error: unknown) {
    console.error("API login error:", error);
    return NextResponse.json(
      { error: "Internal server error during authentication" },
      { status: 500 }
    );
  }
}
