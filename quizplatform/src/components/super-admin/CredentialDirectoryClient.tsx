"use client";

import React, { useState, useTransition } from "react";
import { UserRole } from "@/types/auth";
import { UserSummary } from "@/lib/user-management-service";
import {
  fetchUsersAction,
  updateUserRoleAction,
  blockUserAction,
  unblockUserAction,
} from "@/app/actions/user-management";

interface CredentialDirectoryClientProps {
  initialUsers: UserSummary[];
  totalCount: number;
  initialPage: number;
  totalPages: number;
  currentAdminId: string;
  defaultRoleFilter?: string; // "ALL" | "PARTICIPANT" | "ADMIN" | "SUPER_ADMIN"
  titleSuffix?: string;
}

export default function CredentialDirectoryClient({
  initialUsers,
  totalCount,
  initialPage,
  totalPages: initialTotalPages,
  currentAdminId,
  defaultRoleFilter = "ALL",
  titleSuffix = "",
}: CredentialDirectoryClientProps) {
  const [usersList, setUsersList] = useState<UserSummary[]>(initialUsers);
  const [total, setTotal] = useState(totalCount);
  const [page, setPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<string>(defaultRoleFilter);
  const [isPending, startTransition] = useTransition();
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Modals state
  const [roleChangeTarget, setRoleChangeTarget] = useState<{ user: UserSummary; newRole: UserRole } | null>(null);
  const [blockTarget, setBlockTarget] = useState<UserSummary | null>(null);
  const [blockReason, setBlockReason] = useState("");

  const refreshList = (newTab: string, newSearch: string, newPage: number) => {
    startTransition(async () => {
      setStatusMessage(null);
      let roleParam: string | undefined = undefined;
      let tabStrikesOnly = false;

      if (newTab === "ADMIN") roleParam = "ADMIN";
      else if (newTab === "SUPER_ADMIN") roleParam = "SUPER_ADMIN";
      else if (newTab === "PARTICIPANT") roleParam = "PARTICIPANT";
      else if (newTab === "TAB_STRIKES") tabStrikesOnly = true;

      const res = await fetchUsersAction({
        search: newSearch,
        role: roleParam,
        page: newPage,
        limit: 25,
      });

      if (res.success && res.data) {
        let filtered = res.data.users;
        if (tabStrikesOnly) {
          filtered = filtered.filter((u) => (u.tabStrikes ?? 0) > 0);
        }
        setUsersList(filtered);
        setTotal(res.data.totalCount);
        setPage(res.data.page);
        setTotalPages(res.data.totalPages);
      } else {
        setStatusMessage({ type: "error", text: res.error || "Failed to load directory." });
      }
    });
  };

  const handleTabClick = (tab: string) => {
    setActiveTab(tab);
    setPage(1);
    refreshList(tab, search, 1);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    refreshList(activeTab, search, 1);
  };

  const confirmRoleChange = async () => {
    if (!roleChangeTarget) return;
    const { user, newRole } = roleChangeTarget;
    setRoleChangeTarget(null);

    startTransition(async () => {
      const res = await updateUserRoleAction(user.id, newRole);
      if (res.success && res.data) {
        setStatusMessage({
          type: "success",
          text: `User ${user.email} role updated to ${newRole}.`,
        });
        refreshList(activeTab, search, page);
      } else {
        setStatusMessage({
          type: "error",
          text: res.error || "Failed to update role.",
        });
      }
    });
  };

  const confirmBlock = async () => {
    if (!blockTarget) return;
    const target = blockTarget;
    setBlockTarget(null);

    startTransition(async () => {
      const res = await blockUserAction(target.id, blockReason);
      if (res.success) {
        setStatusMessage({
          type: "success",
          text: `User ${target.email} has been blocked and session revoked.`,
        });
        setBlockReason("");
        refreshList(activeTab, search, page);
      } else {
        setStatusMessage({
          type: "error",
          text: res.error || "Failed to block user.",
        });
      }
    });
  };

  const handleUnblock = async (user: UserSummary) => {
    startTransition(async () => {
      const res = await unblockUserAction(user.id);
      if (res.success) {
        setStatusMessage({
          type: "success",
          text: `User ${user.email} has been unblocked.`,
        });
        refreshList(activeTab, search, page);
      } else {
        setStatusMessage({
          type: "error",
          text: res.error || "Failed to unblock user.",
        });
      }
    });
  };

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Directory Header Banner (Stitch Linear Compliance) */}
      <div className="bg-[#111726] border border-[#1E293B] rounded-xl p-5 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2 py-0.5 rounded bg-[#8B5CF6]/20 border border-[#8B5CF6]/40 text-[#A855F7] font-mono text-[10px] font-bold uppercase tracking-wider">
                SECURITY COMPLIANCE
              </span>
              <span className="text-slate-500 text-xs font-mono">&bull; Access Governance</span>
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Master User & Admin Credential Directory {titleSuffix}
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl">
              Real-time authentication sessions, device fingerprints, and cryptographically hashed passwords (<span className="text-[#00F59B] font-mono">bcrypt</span>). Raw passwords never touch memory plaintext.
            </p>
          </div>

          {/* Filter Pills in Header */}
          <div className="flex items-center gap-1.5 bg-[#0A0E17] p-1 rounded-lg border border-[#1E293B] text-xs font-mono shrink-0">
            {[
              { id: "ALL", label: "All", count: total },
              { id: "ADMIN", label: "Admins", count: null },
              { id: "PARTICIPANT", label: "Runners", count: null },
              { id: "SUPER_ADMIN", label: "Superadmins", count: null },
              { id: "TAB_STRIKES", label: "Tab Strikes", count: null, highlight: true },
            ].map((tab) => {
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTabClick(tab.id)}
                  className={`px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${
                    isSelected
                      ? "bg-[#1E293B] text-white shadow-xs"
                      : "text-slate-400 hover:text-slate-200"
                  } ${tab.highlight && !isSelected ? "text-rose-400" : ""}`}
                >
                  {tab.label}
                  {tab.id === "ALL" && ` (${tab.count})`}
                </button>
              );
            })}
          </div>
        </div>

        {/* Search & Actions Bar */}
        <form onSubmit={handleSearchSubmit} className="mt-4 flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <svg
              className="w-4 h-4 text-slate-500 absolute left-3 top-2.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by email, team name, derived username, institution..."
              className="w-full bg-[#090D15] border border-[#1E293B] rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00E5FF] font-mono"
            />
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="px-4 py-2 bg-[#1A2338] hover:bg-[#232F4A] border border-[#334155] text-white text-xs font-mono font-bold rounded-lg transition-colors cursor-pointer"
          >
            Filter Records
          </button>
        </form>
      </div>

      {/* Alert / Status Toast */}
      {statusMessage && (
        <div
          className={`p-3 rounded-lg border text-xs font-mono flex items-center justify-between ${
            statusMessage.type === "success"
              ? "bg-[#062419] border-[#00F59B]/40 text-[#00F59B]"
              : "bg-rose-950/40 border-rose-800/60 text-rose-300"
          }`}
        >
          <span>{statusMessage.text}</span>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-slate-400 hover:text-white ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Master Credential Directory Table (Stitch Layout) */}
      <div className="bg-[#111726] border border-[#1E293B] rounded-xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="border-b border-[#1E293B] bg-[#0C111C] text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                <th className="py-3 px-4">USER / ROLE</th>
                <th className="py-3 px-4">IDENTITY / TEAM NAME</th>
                <th className="py-3 px-4">AUTH EMAIL</th>
                <th className="py-3 px-4">HASHED PASSWORD (ENCRYPTED)</th>
                <th className="py-3 px-4">STATUS & INSTITUTION</th>
                <th className="py-3 px-4 text-right">GOVERNANCE ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1A2234]">
              {usersList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    No directory records match the active criteria.
                  </td>
                </tr>
              ) : (
                usersList.map((u, idx) => {
                  const isSuperAdmin = u.role === "SUPER_ADMIN";
                  const isAdmin = u.role === "ADMIN";
                  const isCurrentSuperAdmin = u.id === currentAdminId;
                  const isBlocked = u.isBlocked;

                  let roleBadgeColor = "bg-slate-800 text-slate-300 border-slate-700";
                  if (isSuperAdmin) {
                    roleBadgeColor = "bg-[#8B5CF6]/20 text-[#C084FC] border-[#8B5CF6]/40";
                  } else if (isAdmin) {
                    roleBadgeColor = "bg-amber-500/20 text-amber-300 border-amber-500/40";
                  } else {
                    roleBadgeColor = "bg-[#00E5FF]/10 text-[#00E5FF] border-[#00E5FF]/30";
                  }

                  return (
                    <tr
                      key={u.id}
                      className={`hover:bg-[#161F33]/60 transition-colors ${
                        isBlocked ? "opacity-60 bg-rose-950/10" : ""
                      }`}
                    >
                      {/* USER / ROLE */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border tracking-tight ${roleBadgeColor}`}
                          >
                            {u.role === "SUPER_ADMIN"
                              ? "SUPERADMIN"
                              : u.role === "ADMIN"
                              ? "PROCTOR"
                              : "RUNNER"}
                          </span>
                          <span className="text-slate-500 text-[11px]">
                            #{String(idx + 1).padStart(3, "0")}
                          </span>
                        </div>
                      </td>

                      {/* IDENTITY / TEAM NAME */}
                      <td className="py-3.5 px-4">
                        <div className="font-sans font-bold text-white text-xs">
                          {u.teamName || u.name}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                          <span>{u.name}</span>
                          {(u.tabStrikes ?? 0) > 0 && (
                            <span className="text-rose-400 font-bold bg-rose-950/40 px-1 rounded border border-rose-900/50">
                              ⚠️ {u.tabStrikes} tab strikes
                            </span>
                          )}
                        </div>
                      </td>

                      {/* AUTH EMAIL */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-300">
                        {u.email}
                      </td>

                      {/* HASHED PASSWORD (ENCRYPTED) */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-[#090D15] border border-[#1E293B] text-[11px] text-slate-400 font-mono">
                          <svg className="w-3 h-3 text-[#00F59B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                          <span>$2a$10$e7...[SECURE]</span>
                        </div>
                      </td>

                      {/* STATUS & INSTITUTION */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {isBlocked ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800">
                              BLOCKED
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#062419] text-[#00F59B] border border-[#00F59B]/40 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#00F59B]" />
                              ACTIVE
                            </span>
                          )}
                          <span className="text-slate-500 text-[10px]">
                            FP: {u.collegeName || "BIMTECH"}
                          </span>
                        </div>
                        {u.blockedReason && (
                          <div className="text-[10px] text-rose-400 truncate max-w-xs mt-0.5">
                            Reason: {u.blockedReason}
                          </div>
                        )}
                      </td>

                      {/* GOVERNANCE ACTIONS */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          {/* Role selector dropdown */}
                          <select
                            value={u.role}
                            disabled={isPending || (isCurrentSuperAdmin && isSuperAdmin)}
                            onChange={(e) => {
                              const newRole = e.target.value as UserRole;
                              if (newRole !== u.role) {
                                setRoleChangeTarget({ user: u, newRole });
                              }
                            }}
                            className="bg-[#0A0E17] border border-[#1E293B] text-slate-300 text-xs rounded px-2 py-1 focus:outline-none focus:border-[#00E5FF] cursor-pointer disabled:opacity-50"
                          >
                            <option value="PARTICIPANT">User (Runner)</option>
                            <option value="ADMIN">Admin (Proctor)</option>
                            <option value="SUPER_ADMIN">Superadmin (Root)</option>
                          </select>

                          {/* Block / Unblock action */}
                          {!isSuperAdmin && (
                            isBlocked ? (
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() => handleUnblock(u)}
                                className="px-2.5 py-1 rounded bg-emerald-950/50 border border-emerald-700/60 text-emerald-300 hover:bg-emerald-900/60 text-xs transition-colors cursor-pointer"
                              >
                                Unblock
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() => {
                                  setBlockTarget(u);
                                  setBlockReason("");
                                }}
                                className="px-2.5 py-1 rounded bg-rose-950/40 border border-rose-900/60 text-rose-300 hover:bg-rose-900/60 text-xs transition-colors cursor-pointer"
                              >
                                Block
                              </button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-[#1E293B] bg-[#0C111C] flex items-center justify-between text-xs font-mono text-slate-400">
            <span>
              Page {page} of {totalPages} &bull; Total {total} records
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1 || isPending}
                onClick={() => {
                  const p = Math.max(1, page - 1);
                  setPage(p);
                  refreshList(activeTab, search, p);
                }}
                className="px-3 py-1 rounded bg-[#1A2338] border border-[#334155] text-slate-300 hover:text-white disabled:opacity-40 cursor-pointer"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages || isPending}
                onClick={() => {
                  const p = Math.min(totalPages, page + 1);
                  setPage(p);
                  refreshList(activeTab, search, p);
                }}
                className="px-3 py-1 rounded bg-[#1A2338] border border-[#334155] text-slate-300 hover:text-white disabled:opacity-40 cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal: Role Change */}
      {roleChangeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="bg-[#111726] border border-[#1E293B] rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4 font-mono">
            <div className="flex items-center gap-2 text-amber-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h3 className="text-base font-bold text-white">Confirm Role Assignment</h3>
            </div>
            <p className="text-xs text-slate-300">
              Are you sure you want to change the role for{" "}
              <strong className="text-white">{roleChangeTarget.user.email}</strong> from{" "}
              <span className="text-amber-400 font-bold">{roleChangeTarget.user.role}</span> to{" "}
              <span className="text-[#00F59B] font-bold">{roleChangeTarget.newRole}</span>?
            </p>
            {roleChangeTarget.newRole === "SUPER_ADMIN" && (
              <div className="p-2.5 rounded bg-amber-950/40 border border-amber-800/60 text-amber-300 text-[11px]">
                ⚠️ <strong>Elevated Clearance:</strong> Promoting this account grants root administrative control over all quizzes, questions, answers, and user credentials.
              </div>
            )}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRoleChangeTarget(null)}
                className="px-4 py-2 rounded bg-[#1A2338] text-slate-300 hover:text-white text-xs border border-[#334155] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRoleChange}
                className="px-4 py-2 rounded bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-bold shadow-md cursor-pointer"
              >
                Confirm Mutation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Block Account */}
      {blockTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="bg-[#111726] border border-[#1E293B] rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4 font-mono">
            <div className="flex items-center gap-2 text-rose-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              <h3 className="text-base font-bold text-white">Block Account Access</h3>
            </div>
            <p className="text-xs text-slate-300">
              Immediately revoke authentication and block access for{" "}
              <strong className="text-white">{blockTarget.email}</strong>. This account will be unable to log in, create quizzes, or submit answers.
            </p>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                Administrative Reason (Optional)
              </label>
              <input
                type="text"
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="e.g., Suspicious tab defocus strikes in Qualifier Stage"
                className="w-full bg-[#090D15] border border-[#1E293B] rounded p-2 text-xs text-white focus:outline-none focus:border-rose-500"
              />
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setBlockTarget(null)}
                className="px-4 py-2 rounded bg-[#1A2338] text-slate-300 hover:text-white text-xs border border-[#334155] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmBlock}
                className="px-4 py-2 rounded bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md cursor-pointer"
              >
                Confirm Block
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
