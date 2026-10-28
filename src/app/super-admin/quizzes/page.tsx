import { requireRole } from "@/lib/auth-guard";
import {
  getAllQuizzesForSuperAdmin,
  getSuperAdminQuizInspection,
} from "@/lib/superadmin-quiz-service";
import QuestionVaultClient from "@/components/super-admin/QuestionVaultClient";

export default async function SuperAdminQuizzesPage() {
  const session = await requireRole(["SUPER_ADMIN"], "/login");

  const quizzes = await getAllQuizzesForSuperAdmin(session);
  let initialInspection = null;

  if (quizzes.length > 0) {
    initialInspection = await getSuperAdminQuizInspection(quizzes[0].id, session);
  }

  return (
    <QuestionVaultClient
      initialQuizzes={quizzes}
      initialInspection={initialInspection}
    />
  );
}
