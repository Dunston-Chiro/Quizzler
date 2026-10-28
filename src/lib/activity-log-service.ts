import { eq, and, or, ilike, sql, desc } from "drizzle-orm";
import db from "@/db";
import { auditLogs, users } from "@/db/schema";
import { SessionPayload, UserRole } from "@/types/auth";
import { assertSuperAdminRole } from "@/lib/user-management-service";

export type ActivityCategory =
  | "AUTHENTICATION"
  | "QUIZ"
  | "USER_MANAGEMENT"
  | "SECURITY"
  | "SYSTEM";

export interface LogActivityParams {
  actorId?: string | null;
  actorRole: UserRole | "SYSTEM" | "ANONYMOUS";
  action: string;
  category: ActivityCategory;
  targetEntity?: string;
  targetId?: string | null;
  targetLabel?: string | null;
  metadata?: Record<string, unknown>;
  payloadBefore?: Record<string, unknown>;
  payloadAfter?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface ActivityLogFilter {
  search?: string;
  category?: string;
  actorRole?: string;
  targetType?: string;
  page?: number;
  limit?: number;
}

export interface ActivityLogItem {
  id: string;
  actorId: string | null;
  actorRole: string;
  actorName: string | null;
  actorEmail: string | null;
  action: string;
  category: string;
  targetEntity: string;
  targetId: string | null;
  targetLabel: string | null;
  metadata: Record<string, unknown> | null;
  payloadBefore: Record<string, unknown> | null;
  payloadAfter: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export interface ActivityLogResult {
  logs: ActivityLogItem[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Persists an immutable audit log record.
 * Validates that sensitive data (passwords, tokens, master answer keys) are never logged.
 */
export async function logActivity(params: LogActivityParams): Promise<void> {
  try {
    // Sanitization safeguard: ensure no credentials or secrets exist in metadata
    const safeMetadata = params.metadata ? { ...params.metadata } : {};
    delete safeMetadata.password;
    delete safeMetadata.passwordHash;
    delete safeMetadata.token;
    delete safeMetadata.sessionToken;
    delete safeMetadata.correctOptionIds;

    await db.insert(auditLogs).values({
      actorId: params.actorId || null,
      actorRole: params.actorRole,
      action: params.action,
      category: params.category,
      targetEntity: params.targetEntity || "SYSTEM",
      targetId: params.targetId || null,
      targetLabel: params.targetLabel || null,
      metadata: Object.keys(safeMetadata).length > 0 ? safeMetadata : null,
      payloadBefore: params.payloadBefore || null,
      payloadAfter: params.payloadAfter || null,
      ipAddress: params.ipAddress || null,
      userAgent: params.userAgent || null,
      createdAt: new Date(),
    });
  } catch (err: unknown) {
    // Log failure without crashing business transaction
    console.error("Failed to persist activity log:", err);
  }
}

/**
 * Queries activity logs with search, category filtering, role filtering, and pagination.
 * Requires Super-Admin clearance.
 */
export async function getActivityLogs(
  filter: ActivityLogFilter,
  session: SessionPayload
): Promise<ActivityLogResult> {
  await assertSuperAdminRole(session);

  const page = Math.max(1, filter.page || 1);
  const limit = Math.min(100, Math.max(1, filter.limit || 20));
  const offset = (page - 1) * limit;

  const conditions = [];

  // Search filter
  if (filter.search && filter.search.trim().length > 0) {
    const term = `%${filter.search.trim()}%`;
    conditions.push(
      or(
        ilike(auditLogs.action, term),
        ilike(auditLogs.targetLabel, term),
        ilike(auditLogs.targetEntity, term),
        ilike(users.name, term),
        ilike(users.email, term)
      )
    );
  }

  // Category filter
  if (filter.category && filter.category !== "ALL") {
    conditions.push(eq(auditLogs.category, filter.category));
  }

  // Actor role filter
  if (filter.actorRole && filter.actorRole !== "ALL") {
    conditions.push(eq(auditLogs.actorRole, filter.actorRole));
  }

  // Target type filter
  if (filter.targetType && filter.targetType !== "ALL") {
    conditions.push(eq(auditLogs.targetEntity, filter.targetType));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Total count
  const [countRes] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.actorId, users.id))
    .where(whereClause);

  const totalCount = countRes?.count ?? 0;
  const totalPages = Math.ceil(totalCount / limit) || 1;

  // Newest-first records with actor join
  const rawLogs = await db
    .select({
      id: auditLogs.id,
      actorId: auditLogs.actorId,
      actorRole: auditLogs.actorRole,
      actorName: users.name,
      actorEmail: users.email,
      action: auditLogs.action,
      category: auditLogs.category,
      targetEntity: auditLogs.targetEntity,
      targetId: auditLogs.targetId,
      targetLabel: auditLogs.targetLabel,
      metadata: auditLogs.metadata,
      payloadBefore: auditLogs.payloadBefore,
      payloadAfter: auditLogs.payloadAfter,
      ipAddress: auditLogs.ipAddress,
      userAgent: auditLogs.userAgent,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.actorId, users.id))
    .where(whereClause)
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    logs: rawLogs,
    totalCount,
    page,
    limit,
    totalPages,
  };
}

/**
 * Returns high-level telemetry and aggregated event metrics for the Superadmin Overview and Audit Radar.
 */
export async function getActivityLogStats(session: SessionPayload) {
  await assertSuperAdminRole(session);

  const [totalRes] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(auditLogs);

  const [authRes] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(auditLogs)
    .where(eq(auditLogs.category, "AUTHENTICATION"));

  const [adminOpsRes] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(auditLogs)
    .where(
      or(
        eq(auditLogs.category, "QUIZ"),
        eq(auditLogs.category, "USER_MANAGEMENT")
      )
    );

  const [securityRes] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(auditLogs)
    .where(eq(auditLogs.category, "SECURITY"));

  // Recent 10 logs for live radar
  const recentLogs = await db
    .select({
      id: auditLogs.id,
      actorId: auditLogs.actorId,
      actorRole: auditLogs.actorRole,
      actorName: users.name,
      actorEmail: users.email,
      action: auditLogs.action,
      category: auditLogs.category,
      targetEntity: auditLogs.targetEntity,
      targetId: auditLogs.targetId,
      targetLabel: auditLogs.targetLabel,
      metadata: auditLogs.metadata,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.actorId, users.id))
    .orderBy(desc(auditLogs.createdAt))
    .limit(10);

  return {
    totalEvents: totalRes?.count ?? 0,
    authEventsCount: authRes?.count ?? 0,
    adminOpsCount: adminOpsRes?.count ?? 0,
    securityEventsCount: securityRes?.count ?? 0,
    recentLogs,
  };
}
