import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { updateUserRole } from "@/lib/user-management-service";
import { UserRole } from "@/types/auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session || session.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Super-Admin clearance required." },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await req.json();
    const { role } = body as { role: UserRole };

    if (!role) {
      return NextResponse.json(
        { error: "Missing required 'role' field." },
        { status: 400 }
      );
    }

    const updatedUser = await updateUserRole(id, role, session);
    return NextResponse.json({
      message: "User role updated successfully.",
      user: updatedUser,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update role.";
    let status = 500;
    if (msg.includes("UNAUTHORIZED")) status = 403;
    else if (msg.includes("NOT_FOUND")) status = 404;
    else if (
      msg.includes("INVALID_ROLE") ||
      msg.includes("SELF_DEMOTION_DENIED") ||
      msg.includes("LAST_SUPERADMIN_PROTECTION")
    ) {
      status = 400;
    }
    return NextResponse.json({ error: msg }, { status });
  }
}
