"use client";

import React from "react";
import Link from "next/link";
import { InspectedQuestion } from "@/lib/superadmin-quiz-service";
import { UserSummary } from "@/lib/user-management-service";
import { ActivityLogItem } from "@/lib/activity-log-service";

interface OverviewClientProps {
  metrics: {
    totalUsers: number;
    totalAdmins: number;
    totalSuperAdmins: number;
    totalQuizzes: number;
    totalAudits: number;
    activeDefocusStrikes: number;
  };
  sampleQuestions: InspectedQuestion[];
  recentUsers: UserSummary[];
  recentLogs: ActivityLogItem[];
  currentAdminName: string;
}

export default function OverviewClient({
  metrics,
  sampleQuestions,
  recentUsers,
  recentLogs,
  currentAdminName,
}: OverviewClientProps) {
  return (
    <div className="p-4 lg:p-6 space-y-6 font-sans">
      {/* 1. ROOT BANNER (Dev-Ops Root Access) */}
      <div className="bg-[#111726] border border-[#1E293B] rounded-xl p-5 shadow-lg font-mono">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2 py-0.5 rounded bg-[#8B5CF6]/20 border border-[#8B5CF6]/40 text-[#A855F7] text-[10px] font-bold uppercase tracking-wider">
                ROOT SHELL v4.19
              </span>
              <span className="text-[#00F59B] text-xs font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00F59B] animate-pulse" />
                Dev-Ops Root Access &bull; Elevated Kernel Privileges
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Quizzler Governance Engine — {currentAdminName}
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Cluster: <span className="text-[#00E5FF]">prod.ap-south-1a</span> &bull; Authoritative state over campus competitors, answer keys, and audit radars.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 shrink-0">
            <div className="px-3 py-1.5 rounded-lg bg-[#0A0E17] border border-[#1E293B] text-xs text-slate-300">
              <span className="text-slate-500 text-[10px] block">UPTIME</span>
              <span className="text-[#00F59B] font-bold">99.98%</span>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-[#0A0E17] border border-[#1E293B] text-xs text-slate-300">
              <span className="text-slate-500 text-[10px] block">POSTGRES R/W</span>
              <span className="text-[#00E5FF] font-bold">Online (Pooled)</span>
            </div>
          </div>
        </div>

        {/* Utility Pills */}
        <div className="mt-4 pt-3 border-t border-[#1E293B] flex flex-wrap items-center gap-2 text-xs">
          <Link
            href="/super-admin/quizzes"
            className="px-2.5 py-1 rounded bg-[#1A2338] hover:bg-[#25324D] border border-[#334155] text-white text-[11px] font-bold transition-colors cursor-pointer"
          >
            Export JSON
          </Link>
          <button
            type="button"
            disabled
            className="px-2.5 py-1 rounded bg-[#0A0E17] border border-[#1E293B] text-slate-500 text-[11px] cursor-not-allowed"
          >
            Purge Cache
          </button>
          <button
            type="button"
            disabled
            className="px-2.5 py-1 rounded bg-[#0A0E17] border border-[#1E293B] text-slate-500 text-[11px] cursor-not-allowed"
          >
            Re-index Leaderboard
          </button>
          <button
            type="button"
            disabled
            className="px-2.5 py-1 rounded bg-[#0A0E17] border border-[#1E293B] text-slate-500 text-[11px] cursor-not-allowed"
          >
            Run Heuristic Diff
          </button>
          <span className="ml-auto text-slate-500 text-[11px]">
            {metrics.totalUsers} Runners Synced &bull; Stage #02 Active
          </span>
        </div>
      </div>

      {/* 2. FOUR TELEMETRY METRIC CARDS (Matching Stitch Reference) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
        {/* Card 1: WebSocket / Neon Pool */}
        <div className="bg-[#111726] border border-[#1E293B] rounded-xl p-4 shadow-lg space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-bold uppercase text-[10px]">Neon Pooler Slots</span>
            <span className="px-1.5 py-0.2 rounded bg-[#062419] text-[#00F59B] border border-[#00F59B]/40 text-[9px] font-bold">
              18ms RTT
            </span>
          </div>
          <div className="text-2xl font-black text-white">
            {metrics.totalUsers} <span className="text-xs text-slate-500 font-normal">/ 250 slots</span>
          </div>
          <div className="w-full bg-[#0A0E17] rounded-full h-1.5 border border-[#1E293B] overflow-hidden">
            <div
              className="bg-[#00F59B] h-full rounded-full"
              style={{ width: `${Math.min(100, Math.round((metrics.totalUsers / 250) * 100))}%` }}
            />
          </div>
          <div className="text-[10px] text-slate-500">
            Zero connection starvation detected
          </div>
        </div>

        {/* Card 2: Worker Pod Cluster / Quizzes */}
        <div className="bg-[#111726] border border-[#1E293B] rounded-xl p-4 shadow-lg space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-bold uppercase text-[10px]">Active Competitions</span>
            <span className="px-1.5 py-0.2 rounded bg-[#00E5FF]/10 text-[#00E5FF] border border-[#00E5FF]/30 text-[9px] font-bold">
              Cluster Nominal
            </span>
          </div>
          <div className="text-2xl font-black text-white">
            {metrics.totalQuizzes} <span className="text-xs text-slate-500 font-normal">quizzes</span>
          </div>
          <div className="w-full bg-[#0A0E17] rounded-full h-1.5 border border-[#1E293B] overflow-hidden">
            <div className="bg-[#00E5FF] h-full w-[65%] rounded-full" />
          </div>
          <div className="text-[10px] text-slate-500">
            Serverless PgBouncer pool Q: &lt;2ms
          </div>
        </div>

        {/* Card 3: Anti-Cheat Daemon */}
        <div className="bg-[#111726] border border-[#1E293B] rounded-xl p-4 shadow-lg space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-bold uppercase text-[10px]">Anti-Cheat Daemon</span>
            <span className="px-1.5 py-0.2 rounded bg-rose-950 text-rose-300 border border-rose-800 text-[9px] font-bold">
              Watchdog v2
            </span>
          </div>
          <div className="text-2xl font-black text-white">
            {metrics.activeDefocusStrikes} <span className="text-xs text-rose-400 font-normal">defocus strikes</span>
          </div>
          <div className="w-full bg-[#0A0E17] rounded-full h-1.5 border border-[#1E293B] overflow-hidden">
            <div
              className="bg-rose-500 h-full rounded-full"
              style={{ width: `${Math.min(100, metrics.activeDefocusStrikes * 10)}%` }}
            />
          </div>
          <div className="text-[10px] text-slate-500">
            Tab switch telemetry stream active
          </div>
        </div>

        {/* Card 4: Event Velocity / Audit Logs */}
        <div className="bg-[#111726] border border-[#1E293B] rounded-xl p-4 shadow-lg space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-bold uppercase text-[10px]">Audit Event Velocity</span>
            <span className="px-1.5 py-0.2 rounded bg-[#8B5CF6]/20 text-[#C084FC] border border-[#8B5CF6]/30 text-[9px] font-bold">
              Telemetry
            </span>
          </div>
          <div className="text-2xl font-black text-white">
            {metrics.totalAudits} <span className="text-xs text-slate-500 font-normal">ingested logs</span>
          </div>
          <div className="w-full bg-[#0A0E17] rounded-full h-1.5 border border-[#1E293B] overflow-hidden">
            <div className="bg-[#A855F7] h-full w-[80%] rounded-full" />
          </div>
          <div className="text-[10px] text-slate-500">
            Immutable PostgreSQL audit records
          </div>
        </div>
      </div>

      {/* 3. MASTER ANSWER VAULT PREVIEW */}
      <div className="bg-[#111726] border border-[#1E293B] rounded-xl p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-[#8B5CF6]/20 text-[#A855F7] font-mono text-[10px] font-bold">
              VAULT
            </span>
            <h2 className="text-base font-bold text-white font-mono">
              Master Answer Vault & Key Inspector
            </h2>
          </div>
          <Link
            href="/super-admin/quizzes"
            className="text-xs text-[#00E5FF] hover:underline font-mono font-bold flex items-center gap-1"
          >
            Manage All Quizzes & Keys →
          </Link>
        </div>

        {sampleQuestions.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs font-mono">
            No questions cataloged yet.
          </div>
        ) : (
          <div className="space-y-3 font-mono">
            {sampleQuestions.slice(0, 3).map((q, idx) => {
              const correctOpt = q.options.find((opt) => q.correctOptionIds.includes(opt.id));
              const optLetter = correctOpt
                ? String.fromCharCode(65 + q.options.indexOf(correctOpt))
                : "—";

              return (
                <div
                  key={q.id}
                  className="p-3.5 rounded-lg bg-[#0C111C] border border-[#1E293B] flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-start gap-2.5 flex-1 min-w-0">
                    <span className="w-6 h-6 rounded bg-[#111726] border border-[#1E293B] text-slate-400 font-bold text-[10px] flex items-center justify-center shrink-0">
                      Q{String(idx + 1).padStart(2, "0")}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-sans font-bold leading-snug">
                        {q.questionText}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {q.questionType} &bull; Timed {q.timeLimitSeconds}s &bull; {q.points} PTS
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="p-2 rounded bg-[#062419] border border-[#00F59B]/40 text-[#00F59B] text-[11px] font-bold">
                      [OPT {optLetter}] {correctOpt?.text ? correctOpt.text.slice(0, 24) : "—"}
                    </div>
                    <Link
                      href="/super-admin/quizzes"
                      className="px-2.5 py-1 rounded bg-[#1A2338] border border-[#334155] text-slate-300 hover:text-white text-[11px] font-bold"
                    >
                      Inspect
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. MASTER CREDENTIAL DIRECTORY PREVIEW */}
      <div className="bg-[#111726] border border-[#1E293B] rounded-xl p-5 shadow-lg space-y-4 font-mono">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-[#8B5CF6]/20 text-[#A855F7] text-[10px] font-bold">
              SECURITY
            </span>
            <h2 className="text-base font-bold text-white">
              Master User & Admin Credential Directory
            </h2>
          </div>
          <Link
            href="/super-admin/users"
            className="text-xs text-[#00E5FF] hover:underline font-bold"
          >
            Open Full Directory ({metrics.totalUsers + metrics.totalAdmins + metrics.totalSuperAdmins}) →
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#1E293B] text-[10px] text-slate-500 uppercase">
                <th className="py-2 px-3">ROLE</th>
                <th className="py-2 px-3">IDENTITY</th>
                <th className="py-2 px-3">EMAIL</th>
                <th className="py-2 px-3">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1A2234]">
              {recentUsers.slice(0, 4).map((u) => (
                <tr key={u.id} className="hover:bg-[#151D2E]/60">
                  <td className="py-2 px-3">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        u.role === "SUPER_ADMIN"
                          ? "bg-[#8B5CF6]/20 text-[#C084FC]"
                          : u.role === "ADMIN"
                          ? "bg-amber-500/20 text-amber-300"
                          : "bg-[#00E5FF]/10 text-[#00E5FF]"
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-white font-sans font-bold">
                    {u.teamName || u.name}
                  </td>
                  <td className="py-2 px-3 text-slate-400">{u.email}</td>
                  <td className="py-2 px-3">
                    {u.isBlocked ? (
                      <span className="text-rose-400 font-bold text-[10px]">BLOCKED</span>
                    ) : (
                      <span className="text-[#00F59B] font-bold text-[10px]">ACTIVE</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. LIVE EVENT & AUDIT RADAR PREVIEW */}
      <div className="bg-[#111726] border border-[#1E293B] rounded-xl p-5 shadow-lg space-y-4 font-mono">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#00F59B] animate-pulse" />
            <h2 className="text-base font-bold text-white">
              Live Event & Audit Radar Feed
            </h2>
          </div>
          <Link
            href="/super-admin/audit-logs"
            className="text-xs text-[#00E5FF] hover:underline font-bold"
          >
            Open Live Radar ({metrics.totalAudits} logs) →
          </Link>
        </div>

        <div className="space-y-2">
          {recentLogs.slice(0, 4).map((log) => (
            <div
              key={log.id}
              className="p-2.5 rounded bg-[#0A0E17] border border-[#1E293B] flex items-center justify-between text-xs gap-3"
            >
              <div className="flex items-center gap-2 truncate">
                <span className="text-slate-500 text-[10px]">
                  {typeof log.createdAt === "string"
                    ? new Date(log.createdAt).toLocaleTimeString("en-GB")
                    : log.createdAt.toLocaleTimeString("en-GB")}
                </span>
                <span className="text-[#00E5FF] font-bold">[{log.actorRole}]</span>
                <span className="text-white font-semibold truncate">{log.action}</span>
                {log.targetLabel && (
                  <span className="text-slate-400 truncate">&bull; {log.targetLabel}</span>
                )}
              </div>
              <span className="text-[10px] text-slate-500 shrink-0 uppercase">
                {log.category}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
