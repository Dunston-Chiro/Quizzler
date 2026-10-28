import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { blockUser, unblockUser } from "@/lib/user-management-service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session || session.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Super-Admin clearance required." },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { action, reason } = body as { action?: string; reason?: string };

    if (action === "unblock") {
      const updated = await unblockUser(id, session);
      return NextResponse.json({
        message: "User unblocked successfully.",
        user: updated,
      });
    }

    const updated = await blockUser(id, reason, session);
    return NextResponse.json({
      message: "User blocked successfully.",
      user: updated,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to toggle block status.";
    let status = 500;
    if (msg.includes("UNAUTHORIZED")) status = 403;
    else if (msg.includes("NOT_FOUND")) status = 404;
    else if (
      msg.includes("SELF_BLOCK_DENIED") ||
      msg.includes("SUPERADMIN_BLOCK_DENIED")
    ) {
      status = 400;
    }
    return NextResponse.json({ error: msg }, { status });
  }
}
