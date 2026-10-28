"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import db from "@/db";
import { users } from "@/db/schema";
import { createSession, deleteSession, getSession } from "@/lib/session";
import { logActivity } from "@/lib/activity-log-service";

export interface AuthActionState {
  success?: boolean;
  error?: string;
  fieldErrors?: {
    teamName?: string;
    email?: string;
    password?: string;
  };
  redirectTo?: string;
}

/**
 * Server Action for Team / Participant Registration
 * Collects Team Name, Email, Password. Institution is strictly enforced as BIMTECH.
 * Display name is automatically derived from the email prefix.
 */
export async function registerAction(
  prevState: AuthActionState | undefined,
  formData: FormData
): Promise<AuthActionState> {
  const teamName = (formData.get("teamName") as string)?.trim() || "";
  const email = (formData.get("email") as string)?.trim().toLowerCase() || "";
  const password = (formData.get("password") as string) || "";

  const fieldErrors: AuthActionState["fieldErrors"] = {};

  if (!teamName || teamName.length < 2) {
    fieldErrors.teamName = "Team name must be at least 2 characters long.";
  } else if (teamName.length > 100) {
    fieldErrors.teamName = "Team name cannot exceed 100 characters.";
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    fieldErrors.email = "Please enter a valid team leader email address.";
  }

  if (!password || password.length < 6) {
    fieldErrors.password = "Password must be at least 6 characters long.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { success: false, fieldErrors };
  }

  // Derive display name from email prefix (characters before first '@')
  const emailPrefix = email.split("@")[0].trim();
  const derivedName = emailPrefix.length > 0 ? emailPrefix : teamName;

  // Server-authoritative institution: always set to BIMTECH
  const collegeName = "BIMTECH";

  try {
    // Check if user already exists
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing) {
      return {
        success: false,
        error: "An account with this email already exists. Please log in instead.",
      };
    }

    // Hash password securely
    const passwordHash = await bcrypt.hash(password, 10);

    // Create participant user with separate teamName and derived display name
    const [newUser] = await db
      .insert(users)
      .values({
        teamName,
        name: derivedName,
        email,
        passwordHash,
        role: "PARTICIPANT",
        collegeName,
        rollNumber: null,
        isActive: true,
      })
      .returning();

    // Create session cookie
    await createSession({
      userId: newUser.id,
      name: newUser.name,
      teamName: newUser.teamName || undefined,
      email: newUser.email,
      role: newUser.role,
      collegeName: newUser.collegeName || undefined,
      rollNumber: newUser.rollNumber || undefined,
    });

    return {
      success: true,
      redirectTo: "/participant/dashboard",
    };
  } catch (err: unknown) {
    console.error("Registration error:", err);
    return {
      success: false,
      error: "Registration failed due to a database error. Please try again.",
    };
  }
}

/**
 * Server Action for User Login
 */
export async function loginAction(
  prevState: AuthActionState | undefined,
  formData: FormData
): Promise<AuthActionState> {
  const email = (formData.get("email") as string)?.trim().toLowerCase() || "";
  const password = (formData.get("password") as string) || "";
  const redirectUrl = (formData.get("redirectUrl") as string)?.trim() || "";

  if (!email || !password) {
    return {
      success: false,
      error: "Please enter both email and password.",
    };
  }

  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) {
      await logActivity({
        actorRole: "ANONYMOUS",
        action: "AUTH_LOGIN_FAILED",
        category: "AUTHENTICATION",
        targetEntity: "USER",
        targetLabel: email,
        metadata: { reason: "User not found" },
      });
      return {
        success: false,
        error: "Invalid email or password.",
      };
    }

    if (user.isBlocked) {
      await logActivity({
        actorId: user.id,
        actorRole: user.role,
        action: "AUTH_LOGIN_FAILED",
        category: "SECURITY",
        targetEntity: "USER",
        targetId: user.id,
        targetLabel: user.email,
        metadata: {
          reason: "Blocked account attempted login",
          blockedReason: user.blockedReason,
        },
      });
      return {
        success: false,
        error: `This account has been blocked by an administrator. Reason: ${
          user.blockedReason || "Suspicious activity detected."
        }`,
      };
    }

    if (!user.isActive) {
      await logActivity({
        actorId: user.id,
        actorRole: user.role,
        action: "AUTH_LOGIN_FAILED",
        category: "AUTHENTICATION",
        targetEntity: "USER",
        targetId: user.id,
        targetLabel: user.email,
        metadata: { reason: "Deactivated account" },
      });
      return {
        success: false,
        error: "This account has been deactivated. Contact an administrator.",
      };
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      await logActivity({
        actorId: user.id,
        actorRole: user.role,
        action: "AUTH_LOGIN_FAILED",
        category: "AUTHENTICATION",
        targetEntity: "USER",
        targetId: user.id,
        targetLabel: user.email,
        metadata: { reason: "Invalid password" },
      });
      return {
        success: false,
        error: "Invalid email or password.",
      };
    }

    // Attach session
    await createSession({
      userId: user.id,
      name: user.name,
      teamName: user.teamName || undefined,
      email: user.email,
      role: user.role,
      collegeName: user.collegeName || undefined,
      rollNumber: user.rollNumber || undefined,
    });

    // Record login success activity log
    await logActivity({
      actorId: user.id,
      actorRole: user.role,
      action: "AUTH_LOGIN_SUCCESS",
      category: "AUTHENTICATION",
      targetEntity: "USER",
      targetId: user.id,
      targetLabel: user.name,
      metadata: { email: user.email },
    });

    // Resolve landing destination based on role or return redirect
    let destination = "/participant/dashboard";
    if (user.role === "SUPER_ADMIN") {
      destination = "/super-admin/dashboard";
    } else if (user.role === "ADMIN") {
      destination = "/admin/dashboard";
    }

    if (redirectUrl && redirectUrl.startsWith("/")) {
      destination = redirectUrl;
    }

    return {
      success: true,
      redirectTo: destination,
    };
  } catch (err: unknown) {
    console.error("Login error:", err);
    return {
      success: false,
      error: "Login failed due to a database error. Please try again.",
    };
  }
}

/**
 * Server Action for User Logout
 */
export async function logoutAction(): Promise<void> {
  const session = await getSession();
  if (session) {
    await logActivity({
      actorId: session.userId,
      actorRole: session.role,
      action: "AUTH_LOGOUT",
      category: "AUTHENTICATION",
      targetEntity: "USER",
      targetId: session.userId,
      targetLabel: session.name,
    });
  }
  await deleteSession();
  redirect("/login");
}
