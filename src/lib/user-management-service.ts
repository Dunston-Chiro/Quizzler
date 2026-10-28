import { eq, and, or, ilike, sql, desc } from "drizzle-orm";
import db from "@/db";
import { users, auditLogs } from "@/db/schema";
import { SessionPayload, UserRole } from "@/types/auth";

export interface UserSummary {
  id: string;
  teamName: string | null;
  name: string;
  email: string;
  role: UserRole;
  collegeName: string | null;
  isActive: boolean;
  isBlocked: boolean;
  blockedReason: string | null;
  blockedAt: Date | null;
  tabStrikes?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserListFilter {
  search?: string;
  role?: string;
  isBlocked?: boolean;
  page?: number;
  limit?: number;
}

export interface UserListResult {
  users: UserSummary[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Asserts that the caller is a verified active SUPER_ADMIN in PostgreSQL
 */
export async function assertSuperAdminRole(
  session: SessionPayload
): Promise<{ id: string; name: string; email: string; role: UserRole }> {
  if (!session || session.role !== "SUPER_ADMIN") {
    throw new Error(
      "UNAUTHORIZED: Super-Admin clearance required."
    );
  }

  // Database verification to avoid stale session privileges
  const [freshUser] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      isActive: users.isActive,
    })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  if (!freshUser || !freshUser.isActive || freshUser.role !== "SUPER_ADMIN") {
    throw new Error(
      "UNAUTHORIZED: Verified active Super-Admin clearance required."
    );
  }

  return freshUser;
}

/**
 * Get paginated, searchable list of users for Super-Admin
 * NEVER returns password hashes or plaintext passwords
 */
export async function getSuperAdminUsers(
  filter: UserListFilter,
  session: SessionPayload
): Promise<UserListResult> {
  await assertSuperAdminRole(session);

  const page = Math.max(1, filter.page || 1);
  const limit = Math.min(50, Math.max(1, filter.limit || 15));
  const offset = (page - 1) * limit;

  // Build filter conditions
  const conditions = [];

  if (filter.search && filter.search.trim().length > 0) {
    const term = `%${filter.search.trim()}%`;
    conditions.push(
      or(
        ilike(users.email, term),
        ilike(users.name, term),
        ilike(users.teamName, term),
        ilike(users.collegeName, term)
      )
    );
  }

  if (
    filter.role &&
    filter.role !== "ALL" &&
    ["PARTICIPANT", "ADMIN", "SUPER_ADMIN"].includes(filter.role)
  ) {
    conditions.push(eq(users.role, filter.role as UserRole));
  }

  if (filter.isBlocked !== undefined) {
    conditions.push(eq(users.isBlocked, filter.isBlocked));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Execute count query
  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(whereClause);

  const totalCount = countResult?.count ?? 0;
  const totalPages = Math.ceil(totalCount / limit) || 1;

  // Query users - selecting strictly safe non-sensitive columns
  const rawUsers = await db
    .select({
      id: users.id,
      teamName: users.teamName,
      name: users.name,
      email: users.email,
      role: users.role,
      collegeName: users.collegeName,
      isActive: users.isActive,
      isBlocked: users.isBlocked,
      blockedReason: users.blockedReason,
      blockedAt: users.blockedAt,
      tabStrikes: sql<number>`COALESCE((SELECT SUM(tab_switch_count) FROM participant_attempts WHERE user_id = ${users.id}), 0)::int`,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .where(whereClause)
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    users: rawUsers,
    totalCount,
    page,
    limit,
    totalPages,
  };
}

/**
 * Update user role with safety guards:
 * 1. Role must be valid enum
 * 2. Prevent self-demotion
 * 3. Prevent demotion of the last active super-admin
 * 4. Record audit log
 */
export async function updateUserRole(
  targetUserId: string,
  newRole: UserRole,
  session: SessionPayload
): Promise<UserSummary> {
  const actingSuperAdmin = await assertSuperAdminRole(session);

  // 1. Validate role enum
  const validRoles: UserRole[] = ["PARTICIPANT", "ADMIN", "SUPER_ADMIN"];
  if (!validRoles.includes(newRole)) {
    throw new Error(
      `INVALID_ROLE: Role must be one of: ${validRoles.join(", ")}.`
    );
  }

  // 2. Fetch target user
  const [targetUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1);

  if (!targetUser) {
    throw new Error("NOT_FOUND: User does not exist.");
  }

  const previousRole = targetUser.role;

  // If role is unchanged, return current user
  if (previousRole === newRole) {
    return {
      id: targetUser.id,
      teamName: targetUser.teamName,
      name: targetUser.name,
      email: targetUser.email,
      role: targetUser.role,
      collegeName: targetUser.collegeName,
      isActive: targetUser.isActive,
      isBlocked: targetUser.isBlocked,
      blockedReason: targetUser.blockedReason,
      blockedAt: targetUser.blockedAt,
      createdAt: targetUser.createdAt,
      updatedAt: targetUser.updatedAt,
    };
  }

  // 3. Self-demotion guard
  if (targetUserId === session.userId && newRole !== "SUPER_ADMIN") {
    throw new Error(
      "SELF_DEMOTION_DENIED: You cannot demote your own account. Another Super-Admin must make this change."
    );
  }

  // 4. Last active Super-Admin protection guard
  if (previousRole === "SUPER_ADMIN" && newRole !== "SUPER_ADMIN") {
    const [superAdminCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(and(eq(users.role, "SUPER_ADMIN"), eq(users.isActive, true)));

    if ((superAdminCount?.count ?? 0) <= 1) {
      throw new Error(
        "LAST_SUPERADMIN_PROTECTION: Cannot demote the last remaining active Super-Admin. The platform requires at least one Super-Admin."
      );
    }
  }

  // 5. Update user role
  const [updated] = await db
    .update(users)
    .set({
      role: newRole,
      updatedAt: new Date(),
    })
    .where(eq(users.id, targetUserId))
    .returning({
      id: users.id,
      teamName: users.teamName,
      name: users.name,
      email: users.email,
      role: users.role,
      collegeName: users.collegeName,
      isActive: users.isActive,
      isBlocked: users.isBlocked,
      blockedReason: users.blockedReason,
      blockedAt: users.blockedAt,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    });

  // Determine specific role action
  let roleMutation = "USER_ROLE_UPDATED";
  if (previousRole === "PARTICIPANT" && newRole === "ADMIN") {
    roleMutation = "USER_PROMOTED_ADMIN";
  } else if (newRole === "SUPER_ADMIN") {
    roleMutation = "ADMIN_PROMOTED_SUPERADMIN";
  } else if (previousRole === "SUPER_ADMIN" || previousRole === "ADMIN") {
    roleMutation = "PRIVILEGE_DEMOTED";
  }

  // 6. Record audit log
  await db.insert(auditLogs).values({
    actorId: actingSuperAdmin.id,
    actorRole: actingSuperAdmin.role,
    action: "USER_ROLE_UPDATED",
    category: "USER_MANAGEMENT",
    targetEntity: "USER",
    targetId: targetUserId,
    targetLabel: targetUser.email,
    metadata: {
      previousRole,
      newRole,
      roleMutation,
      targetEmail: targetUser.email,
    },
    payloadBefore: {
      role: previousRole,
      email: targetUser.email,
      name: targetUser.name,
      teamName: targetUser.teamName,
    },
    payloadAfter: {
      role: newRole,
      email: targetUser.email,
      name: targetUser.name,
      teamName: targetUser.teamName,
    },
  });

  return updated;
}

/**
 * Toggle user active/deactivated status
 */
export async function toggleUserStatus(
  targetUserId: string,
  isActive: boolean,
  session: SessionPayload
): Promise<UserSummary> {
  const actingSuperAdmin = await assertSuperAdminRole(session);

  const [targetUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1);

  if (!targetUser) {
    throw new Error("NOT_FOUND: User does not exist.");
  }

  // Self-deactivation guard
  if (targetUserId === session.userId && !isActive) {
    throw new Error("SELF_DEACTIVATION_DENIED: You cannot deactivate your own account.");
  }

  // Last super-admin guard
  if (targetUser.role === "SUPER_ADMIN" && !isActive) {
    const [superAdminCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(and(eq(users.role, "SUPER_ADMIN"), eq(users.isActive, true)));

    if ((superAdminCount?.count ?? 0) <= 1) {
      throw new Error(
        "LAST_SUPERADMIN_PROTECTION: Cannot deactivate the last remaining active Super-Admin."
      );
    }
  }

  const [updated] = await db
    .update(users)
    .set({
      isActive,
      updatedAt: new Date(),
    })
    .where(eq(users.id, targetUserId))
    .returning({
      id: users.id,
      teamName: users.teamName,
      name: users.name,
      email: users.email,
      role: users.role,
      collegeName: users.collegeName,
      isActive: users.isActive,
      isBlocked: users.isBlocked,
      blockedReason: users.blockedReason,
      blockedAt: users.blockedAt,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    });

  // Record audit log
  await db.insert(auditLogs).values({
    actorId: actingSuperAdmin.id,
    actorRole: actingSuperAdmin.role,
    action: isActive ? "USER_ACTIVATED" : "USER_DEACTIVATED",
    category: "USER_MANAGEMENT",
    targetEntity: "USER",
    targetId: targetUserId,
    targetLabel: targetUser.email,
    payloadBefore: { isActive: targetUser.isActive },
    payloadAfter: { isActive },
  });

  return updated;
}

/**
 * Block a user or admin account with reason and timestamp.
 * Strictly prevents self-blocking and blocking Superadmins.
 */
export async function blockUser(
  targetUserId: string,
  reason: string | undefined,
  session: SessionPayload
): Promise<UserSummary> {
  const actingSuperAdmin = await assertSuperAdminRole(session);

  const [targetUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1);

  if (!targetUser) {
    throw new Error("NOT_FOUND: User does not exist.");
  }

  // Self-block guard
  if (targetUserId === session.userId) {
    throw new Error("SELF_BLOCK_DENIED: You cannot block your own account.");
  }

  // Super-Admin protection guard: Superadmins cannot be blocked via standard user blocking
  if (targetUser.role === "SUPER_ADMIN") {
    throw new Error(
      "SUPERADMIN_BLOCK_DENIED: Super-Admin accounts cannot be blocked. Use role demotion governance first."
    );
  }

  const blockReason = reason?.trim() || "Suspicious activity detected by Super-Admin";
  const now = new Date();

  const [updated] = await db
    .update(users)
    .set({
      isBlocked: true,
      blockedReason: blockReason,
      blockedAt: now,
      isActive: false, // Deactivate access alongside blocking
      updatedAt: now,
    })
    .where(eq(users.id, targetUserId))
    .returning({
      id: users.id,
      teamName: users.teamName,
      name: users.name,
      email: users.email,
      role: users.role,
      collegeName: users.collegeName,
      isActive: users.isActive,
      isBlocked: users.isBlocked,
      blockedReason: users.blockedReason,
      blockedAt: users.blockedAt,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    });

  // Record audit log
  await db.insert(auditLogs).values({
    actorId: actingSuperAdmin.id,
    actorRole: actingSuperAdmin.role,
    action: "USER_BLOCKED",
    category: "USER_MANAGEMENT",
    targetEntity: "USER",
    targetId: targetUserId,
    targetLabel: targetUser.email,
    metadata: { reason: blockReason, targetRole: targetUser.role },
    payloadBefore: { isBlocked: targetUser.isBlocked, isActive: targetUser.isActive },
    payloadAfter: { isBlocked: true, isActive: false, blockedReason: blockReason },
  });

  return updated;
}

/**
 * Unblock a previously blocked user or admin account.
 */
export async function unblockUser(
  targetUserId: string,
  session: SessionPayload
): Promise<UserSummary> {
  const actingSuperAdmin = await assertSuperAdminRole(session);

  const [targetUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1);

  if (!targetUser) {
    throw new Error("NOT_FOUND: User does not exist.");
  }

  const now = new Date();

  const [updated] = await db
    .update(users)
    .set({
      isBlocked: false,
      blockedReason: null,
      blockedAt: null,
      isActive: true, // Restore active access
      updatedAt: now,
    })
    .where(eq(users.id, targetUserId))
    .returning({
      id: users.id,
      teamName: users.teamName,
      name: users.name,
      email: users.email,
      role: users.role,
      collegeName: users.collegeName,
      isActive: users.isActive,
      isBlocked: users.isBlocked,
      blockedReason: users.blockedReason,
      blockedAt: users.blockedAt,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    });

  // Record audit log
  await db.insert(auditLogs).values({
    actorId: actingSuperAdmin.id,
    actorRole: actingSuperAdmin.role,
    action: "USER_UNBLOCKED",
    category: "USER_MANAGEMENT",
    targetEntity: "USER",
    targetId: targetUserId,
    targetLabel: targetUser.email,
    metadata: { targetRole: targetUser.role },
    payloadBefore: { isBlocked: targetUser.isBlocked, blockedReason: targetUser.blockedReason },
    payloadAfter: { isBlocked: false, blockedReason: null },
  });

  return updated;
}
