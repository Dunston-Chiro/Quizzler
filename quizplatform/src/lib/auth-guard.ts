import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { SessionPayload, UserRole } from "@/types/auth";
import db from "@/db";
import { users, User } from "@/db/schema";

/**
 * Asserts that a valid session exists. If not, redirects to /login.
 */
export async function requireAuth(returnUrl?: string): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    const loginTarget = returnUrl
      ? `/login?redirect=${encodeURIComponent(returnUrl)}`
      : "/login";
    redirect(loginTarget);
  }
  return session;
}

/**
 * Asserts that the current session has one of the allowed roles.
 * Verifies against PostgreSQL to guarantee immediate privilege updates and prevent stale session retention.
 * If unauthorized, redirects to /unauthorized.
 */
export async function requireRole(
  allowedRoles: UserRole[],
  returnUrl?: string
): Promise<SessionPayload> {
  const session = await requireAuth(returnUrl);

  try {
    const [freshUser] = await db
      .select({
        role: users.role,
        isActive: users.isActive,
        isBlocked: users.isBlocked,
      })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);

    if (
      !freshUser ||
      !freshUser.isActive ||
      freshUser.isBlocked ||
      !allowedRoles.includes(freshUser.role)
    ) {
      redirect("/unauthorized");
    }

    session.role = freshUser.role;
  } catch (err: unknown) {
    // Next.js redirect throws a special internal error that must be re-thrown
    if (
      err &&
      typeof err === "object" &&
      "digest" in err &&
      typeof (err as { digest: string }).digest === "string" &&
      (err as { digest: string }).digest.startsWith("NEXT_REDIRECT")
    ) {
      throw err;
    }
    redirect("/unauthorized");
  }

  return session;
}

/**
 * Fetches the fresh User record from PostgreSQL for the current session.
 */
export async function getCurrentUser(): Promise<User | null> {
  const session = await getSession();
  if (!session) return null;

  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);

    if (!user || !user.isActive || user.isBlocked) return null;
    return user;
  } catch {
    return null;
  }
}
