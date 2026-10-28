import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getSuperAdminUsers } from "@/lib/user-management-service";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Super-Admin clearance required." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || undefined;
    const role = searchParams.get("role") || undefined;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "15", 10);

    const result = await getSuperAdminUsers(
      { search, role, page, limit },
      session
    );

    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to fetch users.";
    const status = msg.includes("UNAUTHORIZED") ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
