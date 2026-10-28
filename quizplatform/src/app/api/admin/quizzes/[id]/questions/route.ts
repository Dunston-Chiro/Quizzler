import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { createQuestion } from "@/lib/quiz-service";

export async function POST(
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
    const newQuestion = await createQuestion(id, body, session);
    return NextResponse.json({ question: newQuestion }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to add question.";
    const status = msg.startsWith("ACCESS_DENIED") ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
