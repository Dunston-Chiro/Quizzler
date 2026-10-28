import { requireRole } from "@/lib/auth-guard";
import { getActivityLogs, getActivityLogStats } from "@/lib/activity-log-service";
import AuditRadarClient from "@/components/super-admin/AuditRadarClient";
import db from "@/db";
import { users } from "@/db/schema";
import { sql } from "drizzle-orm";

export default async function SuperAdminAuditLogsPage() {
  const session = await requireRole(["SUPER_ADMIN"], "/login");

  const [result, stats, totalUsersRes] = await Promise.all([
    getActivityLogs({ page: 1, limit: 25 }, session),
    getActivityLogStats(session),
    db.select({ count: sql<number>`count(*)::int` }).from(users),
  ]);

  return (
    <AuditRadarClient
      initialResult={result}
      stats={stats}
      totalRunners={totalUsersRes[0]?.count ?? 250}
    />
  );
}
