"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import {
  getSuperAdminUsers,
  updateUserRole,
  toggleUserStatus,
  blockUser,
  unblockUser,
  UserListFilter,
  UserSummary,
  UserListResult,
} from "@/lib/user-management-service";
import { UserRole } from "@/types/auth";

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

async function getRequiredSuperAdminSession() {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") {
    throw new Error("UNAUTHORIZED: Super-Admin credentials required.");
  }
  return session;
}

export async function fetchUsersAction(
  filter: UserListFilter
): Promise<ActionResult<UserListResult>> {
  try {
    const session = await getRequiredSuperAdminSession();
    const result = await getSuperAdminUsers(filter, session);
    return { success: true, data: result };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to fetch users.";
    return { success: false, error: msg };
  }
}

export async function updateUserRoleAction(
  targetUserId: string,
  newRole: UserRole
): Promise<ActionResult<UserSummary>> {
  try {
    const session = await getRequiredSuperAdminSession();
    const updated = await updateUserRole(targetUserId, newRole, session);
    revalidatePath("/super-admin/users");
    revalidatePath("/super-admin/dashboard");
    return { success: true, data: updated };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update user role.";
    return { success: false, error: msg };
  }
}

export async function toggleUserStatusAction(
  targetUserId: string,
  isActive: boolean
): Promise<ActionResult<UserSummary>> {
  try {
    const session = await getRequiredSuperAdminSession();
    const updated = await toggleUserStatus(targetUserId, isActive, session);
    revalidatePath("/super-admin/users");
    revalidatePath("/super-admin/admins");
    revalidatePath("/super-admin/superadmins");
    revalidatePath("/super-admin/dashboard");
    return { success: true, data: updated };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to toggle user status.";
    return { success: false, error: msg };
  }
}

export async function blockUserAction(
  targetUserId: string,
  reason?: string
): Promise<ActionResult<UserSummary>> {
  try {
    const session = await getRequiredSuperAdminSession();
    const updated = await blockUser(targetUserId, reason, session);
    revalidatePath("/super-admin/users");
    revalidatePath("/super-admin/admins");
    revalidatePath("/super-admin/superadmins");
    revalidatePath("/super-admin/dashboard");
    return { success: true, data: updated };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to block user.";
    return { success: false, error: msg };
  }
}

export async function unblockUserAction(
  targetUserId: string
): Promise<ActionResult<UserSummary>> {
  try {
    const session = await getRequiredSuperAdminSession();
    const updated = await unblockUser(targetUserId, session);
    revalidatePath("/super-admin/users");
    revalidatePath("/super-admin/admins");
    revalidatePath("/super-admin/superadmins");
    revalidatePath("/super-admin/dashboard");
    return { success: true, data: updated };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to unblock user.";
    return { success: false, error: msg };
  }
}
