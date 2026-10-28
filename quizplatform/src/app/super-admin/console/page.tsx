import { requireRole } from "@/lib/auth-guard";

export default async function SuperAdminConsolePage() {
  await requireRole(["SUPER_ADMIN"], "/login");

  return (
    <div className="p-4 lg:p-6 space-y-6 font-mono">
      {/* Console Header */}
      <div className="bg-[#111726] border border-[#1E293B] rounded-xl p-5 shadow-lg">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="px-2 py-0.5 rounded bg-[#8B5CF6]/20 border border-[#8B5CF6]/40 text-[#A855F7] text-[10px] font-bold uppercase tracking-wider">
            KERNEL ENVIRONMENT
          </span>
          <span className="text-slate-500 text-xs">&bull; Operational CLI Reserved</span>
        </div>
        <h1 className="text-xl font-bold text-white tracking-tight">
          Superadmin Engine Console
        </h1>
        <p className="text-xs text-slate-400 mt-1 max-w-2xl">
          Reserved interface for future cluster maintenance, log compaction, heuristic analysis, and cache management. Command interpretation is disabled in the current milestone.
        </p>
      </div>

      {/* Terminal Visual Mockup */}
      <div className="bg-[#0A0E17] border border-[#1E293B] rounded-xl overflow-hidden shadow-2xl">
        {/* Terminal Header Bar */}
        <div className="px-4 py-2.5 bg-[#070A10] border-b border-[#1E293B] flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
            <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
            <span className="ml-2 font-bold text-slate-300">quizzler-root-terminal &bull; bash (restricted)</span>
          </div>
          <span className="text-[11px] px-2 py-0.5 rounded bg-[#111827] border border-[#1E293B] text-[#00F59B]">
            STATUS: SECURE / READ-ONLY
          </span>
        </div>

        {/* Terminal Output */}
        <div className="p-5 text-xs text-slate-300 space-y-2 leading-relaxed font-mono">
          <div className="text-slate-500">
            [+] Initializing Quizzler Dev-Ops Kernel Console v4.19...
          </div>
          <div className="text-slate-500">
            [+] PostgreSQL Connection Pool: Active (Neon Serverless PgBouncer)
          </div>
          <div className="text-slate-500">
            [+] Audit Logging Daemon: Persistent (Table: audit_logs)
          </div>
          <div className="text-[#00E5FF]">
            [*] Operational Sandbox: Command execution interpreter is currently INACTIVE by design.
          </div>
          <div className="text-amber-400">
            [!] Direct shell execution, arbitrary SQL input, and remote code execution are disabled to preserve database integrity and zero-trust security invariants.
          </div>
          <div className="pt-2 text-slate-400">
            Type commands below to view operational CLI parameters in a future milestone.
          </div>

          <div className="pt-4 flex items-center gap-2 text-white">
            <span className="text-[#00F59B] font-bold">root@quizzler-ops:~$</span>
            <input
              type="text"
              disabled
              readOnly
              placeholder="Console inactive — Command interpreter disabled [OPERATIONAL CLI RESERVED]"
              className="flex-1 bg-transparent border-none text-slate-500 placeholder-slate-600 focus:outline-none cursor-not-allowed"
            />
          </div>
        </div>

        {/* Disabled Command Bar */}
        <div className="px-4 py-3 bg-[#070A10] border-t border-[#1E293B] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-500 text-[11px]">
            <span>Supported Future Ops:</span>
            <span className="px-1.5 py-0.5 rounded bg-[#111827] border border-[#1E293B]">--dump-audit-json</span>
            <span className="px-1.5 py-0.5 rounded bg-[#111827] border border-[#1E293B]">--reindex-leaderboard</span>
            <span className="px-1.5 py-0.5 rounded bg-[#111827] border border-[#1E293B]">--vacuum-attempts</span>
          </div>

          <button
            type="button"
            disabled
            className="px-4 py-1.5 rounded bg-[#1E293B] text-slate-500 font-bold border border-[#334155] cursor-not-allowed text-xs"
          >
            EXEC DISABLED
          </button>
        </div>
      </div>
    </div>
  );
}
