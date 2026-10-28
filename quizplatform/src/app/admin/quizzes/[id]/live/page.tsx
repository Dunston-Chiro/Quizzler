import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth-guard";
import { getLiveStageTelemetry } from "@/lib/quiz-service";
import LiveStageClient from "@/components/admin/LiveStageClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminQuizLivePage({ params }: PageProps) {
  const session = await requireRole(["ADMIN", "SUPER_ADMIN"], "/login");
  const { id } = await params;

  const telemetry = await getLiveStageTelemetry(id, session);

  if (!telemetry) {
    notFound();
  }

  return <LiveStageClient quizId={id} initialData={telemetry} />;
}
