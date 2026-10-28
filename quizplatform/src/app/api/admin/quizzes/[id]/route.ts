import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  getQuizWithQuestions,
  updateQuiz,
  deleteQuiz,
} from "@/lib/quiz-service";

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
    const data = await getQuizWithQuestions(id, session);
    if (!data) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to fetch quiz.";
    const status = msg.startsWith("ACCESS_DENIED") ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

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
    const updated = await updateQuiz(id, body, session);
    return NextResponse.json({ quiz: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update quiz.";
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
    await deleteQuiz(id, session);
    return NextResponse.json({ message: "Quiz deleted successfully." });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to delete quiz.";
    const status = msg.startsWith("ACCESS_DENIED") ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
