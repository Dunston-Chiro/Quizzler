import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getAdminQuizzes, createQuiz } from "@/lib/quiz-service";

export async function GET() {
  const session = await getSession();
  if (!session || (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN")) {
    return NextResponse.json(
      { error: "Unauthorized: Admin access required." },
      { status: 401 }
    );
  }

  try {
    const list = await getAdminQuizzes(session);
    return NextResponse.json({ quizzes: list });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to fetch quizzes.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN")) {
    return NextResponse.json(
      { error: "Unauthorized: Admin access required." },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const quiz = await createQuiz(body, session);
    return NextResponse.json({ quiz }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to create quiz.";
    const status = msg.startsWith("ACCESS_DENIED") ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
