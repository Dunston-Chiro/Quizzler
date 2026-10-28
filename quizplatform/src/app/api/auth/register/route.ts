import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import db from "@/db";
import { users } from "@/db/schema";
import { createSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { teamName, email, password } = body;

    if (!teamName || teamName.trim().length < 2) {
      return NextResponse.json(
        { error: "Team name must be at least 2 characters long" },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return NextResponse.json(
        { error: "A valid email address is required" },
        { status: 400 }
      );
    }

    if (!password || password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters long" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if user already exists
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    // Automatically derive display name from email prefix (before first '@')
    const emailPrefix = normalizedEmail.split("@")[0].trim();
    const derivedName = emailPrefix.length > 0 ? emailPrefix : teamName.trim();

    // Server-authoritative institution: always enforced as BIMTECH
    const collegeName = "BIMTECH";

    const passwordHash = await bcrypt.hash(password, 10);

    const [newUser] = await db
      .insert(users)
      .values({
        teamName: teamName.trim(),
        name: derivedName,
        email: normalizedEmail,
        passwordHash,
        role: "PARTICIPANT",
        collegeName,
        rollNumber: null,
        isActive: true,
      })
      .returning();

    await createSession({
      userId: newUser.id,
      name: newUser.name,
      teamName: newUser.teamName || undefined,
      email: newUser.email,
      role: newUser.role,
      collegeName: newUser.collegeName || undefined,
      rollNumber: newUser.rollNumber || undefined,
    });

    return NextResponse.json(
      {
        message: "User registered successfully",
        user: {
          id: newUser.id,
          teamName: newUser.teamName,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          collegeName: newUser.collegeName,
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("API register error:", error);
    return NextResponse.json(
      { error: "Internal server error during registration" },
      { status: 500 }
    );
  }
}
