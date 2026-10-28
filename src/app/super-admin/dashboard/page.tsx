import { requireRole } from "@/lib/auth-guard";
import db from "@/db";
import { users, quizzes, auditLogs, participantAttempts } from "@/db/schema";
import { sql, eq } from "drizzle-orm";
import OverviewClient from "@/components/super-admin/OverviewClient";
import {
  getAllQuizzesForSuperAdmin,
  getSuperAdminQuizInspection,
  InspectedQuestion,
} from "@/lib/superadmin-quiz-service";
import { getActivityLogs } from "@/lib/activity-log-service";
import { getSuperAdminUsers } from "@/lib/user-management-service";

export default async function SuperAdminDashboard() {
  const session = await requireRole(["SUPER_ADMIN"], "/super-admin/dashboard");

  // Fetch real system-wide metrics in parallel
  const [
    totalUsersRes,
    totalAdminsRes,
    totalSuperAdminsRes,
    totalQuizzesRes,
    totalAuditsRes,
    strikesRes,
    allQuizzes,
    usersResult,
    logsResult,
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(users).where(eq(users.role, "PARTICIPANT")),
    db.select({ count: sql<number>`count(*)::int` }).from(users).where(eq(users.role, "ADMIN")),
    db.select({ count: sql<number>`count(*)::int` }).from(users).where(eq(users.role, "SUPER_ADMIN")),
    db.select({ count: sql<number>`count(*)::int` }).from(quizzes),
    db.select({ count: sql<number>`count(*)::int` }).from(auditLogs),
    db.select({ sum: sql<number>`COALESCE(sum(tab_switch_count), 0)::int` }).from(participantAttempts),
    getAllQuizzesForSuperAdmin(session),
    getSuperAdminUsers({ page: 1, limit: 5 }, session),
    getActivityLogs({ page: 1, limit: 6 }, session),
  ]);

  let sampleQuestions: InspectedQuestion[] = [];
  if (allQuizzes.length > 0) {
    const inspection = await getSuperAdminQuizInspection(allQuizzes[0].id, session);
    sampleQuestions = inspection?.questions || [];
  }

  return (
    <OverviewClient
      metrics={{
        totalUsers: totalUsersRes[0]?.count ?? 0,
        totalAdmins: totalAdminsRes[0]?.count ?? 0,
        totalSuperAdmins: totalSuperAdminsRes[0]?.count ?? 0,
        totalQuizzes: totalQuizzesRes[0]?.count ?? 0,
        totalAudits: totalAuditsRes[0]?.count ?? 0,
        activeDefocusStrikes: strikesRes[0]?.sum ?? 0,
      }}
      sampleQuestions={sampleQuestions}
      recentUsers={usersResult.users}
      recentLogs={logsResult.logs}
      currentAdminName={session.name}
    />
  );
}
