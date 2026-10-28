"use server";

import { getSession } from "@/lib/session";
import {
  getActivityLogs,
  getActivityLogStats,
  ActivityLogFilter,
  ActivityLogResult,
} from "@/lib/activity-log-service";

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

async function getRequiredSuperAdminSession() {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") {
    throw new Error("UNAUTHORIZED: Super-Admin clearance required.");
  }
  return session;
}

export async function fetchActivityLogsAction(
  filter: ActivityLogFilter
): Promise<ActionResult<ActivityLogResult>> {
  try {
    const session = await getRequiredSuperAdminSession();
    const result = await getActivityLogs(filter, session);
    return { success: true, data: result };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to fetch activity logs.";
    return { success: false, error: msg };
  }
}

export async function fetchActivityLogStatsAction(): Promise<
  ActionResult<Awaited<ReturnType<typeof getActivityLogStats>>>
> {
  try {
    const session = await getRequiredSuperAdminSession();
    const stats = await getActivityLogStats(session);
    return { success: true, data: stats };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to fetch activity stats.";
    return { success: false, error: msg };
  }
}
