import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { updateQuestion, deleteQuestion } from "@/lib/quiz-service";

export async function PATCH(
  req: NextRequest,
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
    const body = await req.json();
    const updated = await updateQuestion(id, body, session);
    return NextResponse.json({ question: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update question.";
    const status = msg.startsWith("ACCESS_DENIED") ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function DELETE(
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
    await deleteQuestion(id, session);
    return NextResponse.json({ message: "Question deleted successfully." });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to delete question.";
    const status = msg.startsWith("ACCESS_DENIED") ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
