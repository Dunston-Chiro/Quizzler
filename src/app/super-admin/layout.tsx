import { requireRole } from "@/lib/auth-guard";
import db from "@/db";
import { users, quizzes } from "@/db/schema";
import { sql, eq } from "drizzle-orm";
import SuperAdminShell from "@/components/super-admin/SuperAdminShell";

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireRole(["SUPER_ADMIN"], "/login");

  // Query live metrics for sidebar badges
  const [userCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(eq(users.role, "PARTICIPANT"));

  const [adminCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(eq(users.role, "ADMIN"));

  const [superAdminCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(eq(users.role, "SUPER_ADMIN"));

  const [quizCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(quizzes);

  return (
    <SuperAdminShell
      user={{
        id: session.userId,
        name: session.name,
        email: session.email,
        role: session.role,
      }}
      metrics={{
        totalUsers: userCount?.count ?? 0,
        totalAdmins: adminCount?.count ?? 0,
        totalSuperAdmins: superAdminCount?.count ?? 0,
        totalQuizzes: quizCount?.count ?? 0,
      }}
    >
      {children}
    </SuperAdminShell>
  );
}
