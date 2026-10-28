import { requireRole } from "@/lib/auth-guard";
import AdminHeader from "@/components/admin/AdminHeader";
import db from "@/db";
import { quizzes } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireRole(["ADMIN", "SUPER_ADMIN"], "/login");

  // Fetch the latest or currently live quiz for room code indicator
  const [activeQuiz] = await db
    .select({ roomCode: quizzes.roomCode })
    .from(quizzes)
    .where(eq(quizzes.createdBy, session.userId))
    .orderBy(desc(quizzes.updatedAt))
    .limit(1);

  return (
    <div className="min-h-screen bg-[#0f172a]/95 text-slate-900 flex flex-col font-sans">
      <AdminHeader
        user={{
          name: session.name,
          email: session.email,
          role: session.role,
        }}
        activeRoomCode={activeQuiz?.roomCode || "STG2-BIM"}
      />
      <div className="flex-1 w-full max-w-[1560px] mx-auto p-3 sm:p-5 lg:p-6 flex flex-col">
        {/* Main Card Canvas matching the Stitch reference */}
        <div className="flex-1 bg-white rounded-2xl border border-slate-200/90 shadow-xl overflow-hidden flex flex-col">
          {children}
        </div>
      </div>
    </div>
  );
}
