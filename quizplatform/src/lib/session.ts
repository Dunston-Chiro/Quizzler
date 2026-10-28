import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { SessionPayload, UserRole } from "@/types/auth";

const SESSION_COOKIE_NAME = "quiz_session";
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function getSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET || "fallback-secret-at-least-32-chars-long-for-dev";
  return new TextEncoder().encode(secret);
}

/**
 * Sign a new JWT session token
 */
export async function signSessionToken(
  payload: Omit<SessionPayload, "expiresAt"> & { expiresAt?: Date | string }
): Promise<string> {
  const expiresAt =
    payload.expiresAt || new Date(Date.now() + SESSION_DURATION_MS);

  return new SignJWT({
    userId: payload.userId,
    name: payload.name,
    teamName: payload.teamName,
    email: payload.email,
    role: payload.role,
    collegeName: payload.collegeName,
    rollNumber: payload.rollNumber,
    expiresAt: expiresAt instanceof Date ? expiresAt.toISOString() : expiresAt,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecretKey());
}

/**
 * Verify and decode a JWT session token
 */
export async function verifySessionToken(
  token: string | undefined | null
): Promise<SessionPayload | null> {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      algorithms: ["HS256"],
    });

    return {
      userId: payload.userId as string,
      name: payload.name as string,
      teamName: payload.teamName as string | undefined,
      email: payload.email as string,
      role: payload.role as UserRole,
      collegeName: payload.collegeName as string | undefined,
      rollNumber: payload.rollNumber as string | undefined,
      expiresAt: (payload.expiresAt as string) || (payload.exp ? new Date(payload.exp * 1000).toISOString() : new Date().toISOString()),
    };
  } catch {
    return null;
  }
}

/**
 * Create and attach the HTTP-only session cookie (Server Actions / Route Handlers)
 */
export async function createSession(
  user: Omit<SessionPayload, "expiresAt">
): Promise<string> {
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  const token = await signSessionToken({ ...user, expiresAt });

  try {
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      expires: expiresAt,
      sameSite: "lax",
      path: "/",
    });
  } catch {
    // Gracefully handle execution outside active Next.js request store (e.g. CLI scripts / tests)
  }

  return token;
}

/**
 * Read and verify the active session from cookies
 */
export async function getSession(): Promise<SessionPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}

/**
 * Delete the session cookie (Logout)
 */
export async function deleteSession(): Promise<void> {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(SESSION_COOKIE_NAME);
  } catch {
    // Cookie store might be unavailable if called outside server context
  }
}

export { SESSION_COOKIE_NAME };
