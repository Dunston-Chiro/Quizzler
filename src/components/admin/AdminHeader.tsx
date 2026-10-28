"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { logoutAction } from "@/app/actions/auth";

interface AdminHeaderProps {
  user: {
    name: string;
    email: string;
    role: string;
  };
  activeRoomCode?: string;
  connectedCount?: number;
}

export default function AdminHeader({
  user,
  activeRoomCode = "STG2-BIM",
  connectedCount = 0,
}: AdminHeaderProps) {
  const pathname = usePathname();
  const [copied, setCopied] = useState(false);

  const handleCopyRoom = () => {
    navigator.clipboard.writeText(activeRoomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const navItems = [
    { label: "Launch", href: "/admin/dashboard" },
    { label: "Quizzes", href: "/admin/quizzes" },
    { label: "Rooms", href: "/admin/rooms" },
    { label: "Reports", href: "/admin/reports" },
    {
      label: "Results & Live Stage",
      href: "/admin/live",
      isLivePill: true,
    },
  ];

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 px-4 lg:px-8 py-2.5 shadow-xs">
      <div className="max-w-[1560px] mx-auto flex items-center justify-between gap-4">
        {/* Brand & Room Info */}
        <div className="flex items-center gap-3 md:gap-4 shrink-0">
          <Link href="/admin/dashboard" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-lg bg-sky-500 text-white font-black text-lg flex items-center justify-center shadow-xs group-hover:bg-sky-600 transition-colors">
              Q
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5 leading-none">
                <span className="font-bold text-slate-900 text-base tracking-tight">
                  Quizzler
                </span>
                <span className="text-[10px] font-extrabold uppercase bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded tracking-wider">
                  PRO
                </span>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">
                Live Stage Proctor
              </span>
            </div>
          </Link>

          {/* Room Pill */}
          <div className="hidden sm:flex items-center gap-2 bg-slate-100 border border-slate-200/90 rounded-lg px-2.5 py-1 text-xs">
            <span className="text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
              Room:
            </span>
            <span className="font-mono font-bold text-slate-800">
              {activeRoomCode}
            </span>
            <button
              onClick={handleCopyRoom}
              title="Copy Room Code"
              className="text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              {copied ? (
                <span className="text-emerald-600 text-[10px] font-bold">✓</span>
              ) : (
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              )}
            </button>
            <div className="h-3 w-px bg-slate-300 mx-0.5" />
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-bold text-emerald-700 text-[11px]">
                {connectedCount > 0 ? `${connectedCount} Connected` : "Stage Ready"}
              </span>
            </div>
          </div>
        </div>

        {/* Center Navigation Tabs */}
        <nav className="hidden md:flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/60">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href === "/admin/quizzes" && pathname.startsWith("/admin/quizzes")) ||
              (item.href === "/admin/live" && pathname.includes("/live"));

            if (item.isLivePill) {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-white text-sky-700 shadow-xs border border-slate-200 font-bold"
                      : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isActive ? "bg-sky-500" : "bg-slate-400"
                    }`}
                  />
                  {item.label}
                </Link>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? "bg-white text-slate-900 shadow-xs border border-slate-200 font-bold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Right User Controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200/80 rounded-xl px-2.5 py-1">
            <div className="w-7 h-7 rounded-full bg-sky-100 border border-sky-300 text-sky-800 font-bold text-xs flex items-center justify-center">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="hidden lg:flex flex-col text-left">
              <span className="text-xs font-bold text-slate-800 leading-tight">
                {user.name}
              </span>
              <span className="text-[10px] font-medium text-slate-500">
                {user.role === "SUPER_ADMIN" ? "Super Admin" : "Chief Proctor"}
              </span>
            </div>
          </div>

          <form action={logoutAction}>
            <button
              type="submit"
              title="Sign Out"
              className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
