"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/actions/auth";

interface SuperAdminShellProps {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  metrics?: {
    totalUsers: number;
    totalAdmins: number;
    totalSuperAdmins: number;
    totalQuizzes: number;
  };
  children: React.ReactNode;
}

export default function SuperAdminShell({
  user,
  metrics,
  children,
}: SuperAdminShellProps) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const navItems = [
    {
      label: "Overview",
      href: "/super-admin/dashboard",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      ),
      badge: null,
    },
    {
      label: "Live Stage Engine",
      href: "/admin/live",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      badge: "LIVE",
      badgeColor: "bg-[#00F59B] text-black font-black",
    },
    {
      label: "Question Vault",
      href: "/super-admin/quizzes",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      ),
      badge: "PROD",
      badgeColor: "bg-[#8B5CF6]/20 text-[#A855F7] border border-[#8B5CF6]/40",
    },
    {
      label: "Runner Directory",
      href: "/super-admin/users",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      badge: metrics?.totalUsers ? String(metrics.totalUsers) : null,
      badgeColor: "bg-[#1E293B] text-[#94A3B8]",
    },
    {
      label: "Admins",
      href: "/super-admin/admins",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
      badge: metrics?.totalAdmins ? String(metrics.totalAdmins) : null,
      badgeColor: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
    },
    {
      label: "Superadmins",
      href: "/super-admin/superadmins",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
      ),
      badge: metrics?.totalSuperAdmins ? String(metrics.totalSuperAdmins) : null,
      badgeColor: "bg-[#8B5CF6]/20 text-[#C084FC] border border-[#8B5CF6]/30",
    },
    {
      label: "Telemetry & Audit",
      href: "/super-admin/audit-logs",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      badge: null,
    },
    {
      label: "Engine Console",
      href: "/super-admin/console",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      badge: "RESERVED",
      badgeColor: "bg-slate-800 text-slate-400 text-[9px]",
    },
  ];

  return (
    <div className="min-h-screen bg-[#0A0D14] text-[#E2E8F0] font-sans antialiased flex flex-col selection:bg-[#00E5FF] selection:text-black">
      {/* 1. TOP STATUS & NAVIGATION BAR (Linear Cyber Aesthetic) */}
      <header className="h-14 bg-[#0F141F] border-b border-[#1B2433] px-4 flex items-center justify-between gap-4 sticky top-0 z-50 shrink-0">
        {/* Brand & Status Pills */}
        <div className="flex items-center gap-3">
          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="md:hidden p-1.5 rounded text-slate-400 hover:text-white hover:bg-[#1A2234]"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <Link href="/super-admin/dashboard" className="flex items-center gap-2 group">
            <div className="w-7 h-7 rounded bg-[#8B5CF6] text-white font-black text-xs flex items-center justify-center shadow-[0_0_12px_rgba(139,92,246,0.5)] group-hover:bg-[#7C3AED] transition-colors">
              Q
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-xs font-black tracking-wider text-white uppercase">
                QUIZZLER
              </span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-[#1A2234] text-[#00E5FF] border border-[#00E5FF]/30 tracking-tight">
                DEV-CONSOLE
              </span>
            </div>
          </Link>

          {/* Environment & Latency Pills */}
          <div className="hidden lg:flex items-center gap-2 font-mono text-[11px]">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#111827] border border-[#1E293B] text-[#94A3B8]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00F59B] animate-pulse" />
              PROD - AP-SOUTH-1A
            </span>
            <span className="px-2 py-0.5 rounded bg-[#111827] border border-[#1E293B] text-[#00E5FF]">
              18ms Latency
            </span>
          </div>
        </div>

        {/* Quick Jump Bar */}
        <div className="hidden sm:flex items-center gap-2">
          <div className="relative">
            <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-[#0A0D14] border border-[#1E293B] text-slate-400 text-xs w-56 lg:w-72">
              <svg className="w-3.5 h-3.5 text-slate-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="text-[11px] text-slate-500 font-mono">Quick jump...</span>
              <kbd className="ml-auto text-[10px] font-mono px-1 rounded bg-[#1E293B] text-slate-400">⌘K</kbd>
            </div>
          </div>

          <div className="px-2 py-1 rounded bg-[#1E293B]/70 border border-[#334155] text-[11px] font-mono text-[#00E5FF] font-bold">
            #STG2-BIM
          </div>
        </div>

        {/* Profile & Sign Out */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex flex-col text-right">
            <span className="text-xs font-semibold text-white leading-tight">
              {user.name}
            </span>
            <span className="text-[10px] font-mono text-[#00F59B] flex items-center justify-end gap-1">
              <span className="w-1 h-1 rounded-full bg-[#00F59B]" />
              Chief Proctor &bull; ROOT
            </span>
          </div>

          <div className="w-8 h-8 rounded-full bg-[#1E293B] border border-[#334155] text-[#00E5FF] font-mono font-bold text-xs flex items-center justify-center">
            {user.name.charAt(0).toUpperCase()}
          </div>

          <form action={logoutAction}>
            <button
              type="submit"
              title="Sign Out"
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 rounded border border-transparent hover:border-rose-900/50 transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </form>
        </div>
      </header>

      {/* 2. BODY LAYOUT (Left Sidebar + Main Content) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <aside
          className={`w-64 bg-[#0D121D] border-r border-[#1B2433] flex flex-col shrink-0 transition-transform md:translate-x-0 ${
            isSidebarOpen
              ? "fixed inset-y-0 left-0 z-40 translate-x-0 shadow-2xl"
              : "hidden md:flex"
          }`}
        >
          {/* Active Stage Indicator */}
          <div className="p-3.5 border-b border-[#1B2433] bg-[#0A0E17]/60">
            <div className="flex items-center justify-between text-[11px] font-mono mb-1">
              <span className="text-slate-400 uppercase tracking-wider text-[10px] font-bold">
                ACTIVE STAGE
              </span>
              <span className="inline-flex items-center gap-1 text-[#00F59B] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00F59B] animate-pulse" />
                ONLINE
              </span>
            </div>
            <div className="font-mono text-sm font-black text-white">
              OPS STAGE #02
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mt-1">
              <span>RUNNERS: <strong className="text-[#00E5FF]">{metrics?.totalUsers ?? 250}</strong> / 250</span>
              <span className="text-slate-500">v4.19</span>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="flex-1 py-3 px-2 overflow-y-auto space-y-0.5">
            <div className="px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
              CONSOLE ENGINE
            </div>

            {navItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/super-admin/dashboard" &&
                  pathname.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsSidebarOpen(false)}
                  className={`flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-medium transition-all ${
                    isActive
                      ? "bg-[#1A2338] text-white font-semibold border-l-2 border-[#00E5FF] pl-2"
                      : "text-slate-400 hover:text-slate-200 hover:bg-[#131A29]"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className={isActive ? "text-[#00E5FF]" : "text-slate-500"}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </div>

                  {item.badge && (
                    <span
                      className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded ${
                        item.badgeColor || "bg-[#1E293B] text-slate-300"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          {/* Cluster Status Box */}
          <div className="p-3 border-t border-[#1B2433] bg-[#0A0E17]/40 text-[10px] font-mono space-y-1.5">
            <div className="text-slate-500 font-bold uppercase tracking-wider text-[9px]">
              CLUSTER STATUS
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span>DATABASE</span>
              <span className="text-[#00F59B] font-bold">R/W NOMINAL</span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span>SOCKET HEALTH</span>
              <span className="text-[#00E5FF] font-bold">99.96%</span>
            </div>
          </div>

          {/* Emergency Killswitch (Inactive Safeguard Pill) */}
          <div className="p-2.5 border-t border-[#1B2433] bg-[#12080B]">
            <div className="flex items-center justify-between text-[10px] font-mono text-rose-400 mb-1">
              <span>SYS LOCKDOWN</span>
              <span className="px-1.5 py-0.2 rounded bg-rose-950/80 text-rose-300 border border-rose-800/60 font-bold text-[9px]">
                ARMED
              </span>
            </div>
            <button
              type="button"
              disabled
              title="System lockdown inactive in standard session"
              className="w-full py-1.5 px-2 rounded bg-rose-950/40 border border-rose-900/60 text-rose-300 font-mono text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-not-allowed opacity-80"
            >
              <span>🚨</span> Emergency Killswitch
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-[#0A0D14]">
          {children}
        </main>
      </div>

      {/* 3. PERSISTENT INACTIVE BOTTOM CONSOLE BAR (Stitch reference compliance) */}
      <footer className="h-12 bg-[#090D15] border-t border-[#1B2433] px-4 flex items-center justify-between gap-3 shrink-0 text-xs font-mono">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#8B5CF6]/20 border border-[#8B5CF6]/40 text-[#A855F7] text-[10px] font-bold shrink-0">
            KERNEL CLI
          </div>
          <span className="hidden sm:inline text-slate-500 text-[11px]">
            quizzler@ops-engine:~$ interactive shell
          </span>

          <div className="hidden xl:flex items-center gap-1.5 text-[10px] text-slate-500">
            <span className="px-1.5 py-0.2 rounded bg-[#111827] border border-[#1E293B]">--dump-logs</span>
            <span className="px-1.5 py-0.2 rounded bg-[#111827] border border-[#1E293B]">--reset-bans</span>
            <span className="px-1.5 py-0.2 rounded bg-[#111827] border border-[#1E293B]">--simulate-traffic</span>
          </div>

          <div className="flex items-center gap-1 text-slate-300 min-w-0">
            <span className="text-[#00F59B] font-bold shrink-0">root@quizzler:~$</span>
            <input
              type="text"
              readOnly
              disabled
              value=""
              placeholder="Type command or SQL query (e.g., --show-keys, VACUUM ANALYZE)... [OPERATIONAL CLI RESERVED — INACTIVE]"
              className="bg-transparent text-[11px] text-slate-500 placeholder-slate-600 focus:outline-none w-64 md:w-96 lg:w-[480px] cursor-not-allowed truncate"
            />
          </div>
        </div>

        <button
          type="button"
          disabled
          title="Console inactive in production"
          className="px-2.5 py-1 rounded bg-[#1E293B] text-slate-500 font-mono text-[10px] font-bold border border-[#334155] cursor-not-allowed shrink-0"
        >
          EXEC
        </button>
      </footer>
    </div>
  );
}
