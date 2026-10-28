import { requireRole } from "@/lib/auth-guard";
import { getAdminQuizzes } from "@/lib/quiz-service";
import QuizManagerClient from "@/components/admin/QuizManagerClient";

export default async function AdminQuizzesPage() {
  const session = await requireRole(["ADMIN", "SUPER_ADMIN"], "/login");
  const rawQuizzes = await getAdminQuizzes(session);

  // Serialize dates for client components
  const quizzes = rawQuizzes.map((q) => ({
    ...q,
    createdAt: q.createdAt.toISOString(),
    updatedAt: q.updatedAt.toISOString(),
  }));

  return (
    <QuizManagerClient
      initialQuizzes={quizzes}
      currentUserId={session.userId}
      currentUserRole={session.role}
    />
  );
}
