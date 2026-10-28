import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getLiveStageTelemetry } from "@/lib/quiz-service";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN")) {
    return NextResponse.json(
      { error: "Unauthorized: Admin access required." },
      { status: 401 }
    );
  }

  const { id } = await params;

  try {
    const data = await getLiveStageTelemetry(id, session);
    if (!data) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to fetch telemetry.";
    const status = msg.startsWith("ACCESS_DENIED") ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
