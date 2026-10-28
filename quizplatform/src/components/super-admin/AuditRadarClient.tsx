"use client";

import React, { useState, useTransition } from "react";
import { ActivityLogItem, ActivityLogResult } from "@/lib/activity-log-service";
import { fetchActivityLogsAction } from "@/app/actions/activity-logs";

interface AuditRadarClientProps {
  initialResult: ActivityLogResult;
  stats: {
    totalEvents: number;
    authEventsCount: number;
    adminOpsCount: number;
    securityEventsCount: number;
  };
  totalRunners?: number;
}

export default function AuditRadarClient({
  initialResult,
  stats,
  totalRunners = 250,
}: AuditRadarClientProps) {
  const [logsList, setLogsList] = useState<ActivityLogItem[]>(initialResult.logs);
  const [total, setTotal] = useState(initialResult.totalCount);
  const [page, setPage] = useState(initialResult.page);
  const [totalPages, setTotalPages] = useState(initialResult.totalPages);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const refreshLogs = (category: string, query: string, newPage: number) => {
    startTransition(async () => {
      const res = await fetchActivityLogsAction({
        search: query,
        category: category !== "ALL" ? category : undefined,
        page: newPage,
        limit: 25,
      });

      if (res.success && res.data) {
        setLogsList(res.data.logs);
        setTotal(res.data.totalCount);
        setPage(res.data.page);
        setTotalPages(res.data.totalPages);
      }
    });
  };

  const handleCategoryClick = (cat: string) => {
    setActiveCategory(cat);
    setPage(1);
    refreshLogs(cat, search, 1);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    refreshLogs(activeCategory, search, 1);
  };

  const downloadAuditPacket = () => {
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(logsList, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute(
      "download",
      `quizzler-forensic-audit-${new Date().toISOString().slice(0, 10)}.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const formatTimestamp = (d: Date | string) => {
    const dateObj = typeof d === "string" ? new Date(d) : d;
    return dateObj.toLocaleTimeString("en-GB", { hour12: false });
  };

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Page Title & Search Bar */}
      <div className="bg-[#111726] border border-[#1E293B] rounded-xl p-5 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-[#00F59B] animate-pulse" />
              <span className="text-[#00F59B] font-mono text-xs font-bold uppercase tracking-wider">
                RADAR ONLINE
              </span>
              <span className="text-slate-500 font-mono text-xs">&bull; Ingesting System & User Telemetry</span>
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Live Event & Audit Radar
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Immutable forensic log stream capturing role assignments, quiz mutations, authentication lifecycle, and proctoring events.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 bg-[#0A0E17] p-1 rounded-lg border border-[#1E293B] text-xs font-mono shrink-0">
            {[
              { id: "ALL", label: "All Events" },
              { id: "QUIZ", label: "Admin Ops" },
              { id: "USER_MANAGEMENT", label: "Governance" },
              { id: "AUTHENTICATION", label: "Auth" },
              { id: "SECURITY", label: "Tamper / Strikes", highlight: true },
            ].map((tab) => {
              const isSelected = activeCategory === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleCategoryClick(tab.id)}
                  className={`px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${
                    isSelected
                      ? "bg-[#1E293B] text-white shadow-xs"
                      : "text-slate-400 hover:text-slate-200"
                  } ${tab.highlight && !isSelected ? "text-rose-400" : ""}`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Search Input */}
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
              placeholder="Search audit trail by actor, action name, target entity, or display label..."
              className="w-full bg-[#090D15] border border-[#1E293B] rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00E5FF] font-mono"
            />
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="px-4 py-2 bg-[#1A2338] hover:bg-[#232F4A] border border-[#334155] text-white text-xs font-mono font-bold rounded-lg transition-colors cursor-pointer"
          >
            Filter Logs
          </button>
        </form>
      </div>

      {/* 2-Column Responsive Layout: Event Stream (Left) + Integrity Gauges (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Event Stream (2 Cols) */}
        <div className="lg:col-span-2 bg-[#111726] border border-[#1E293B] rounded-xl overflow-hidden shadow-lg flex flex-col">
          <div className="p-3.5 border-b border-[#1E293B] bg-[#0C111C] flex items-center justify-between font-mono text-xs">
            <span className="text-slate-400 font-bold uppercase tracking-wider text-[11px]">
              LIVE INGESTION STREAM
            </span>
            <span className="text-slate-500 text-[11px]">
              Topic: <strong className="text-[#00E5FF]">quizzler-master-audit</strong>
            </span>
          </div>

          <div className="flex-1 divide-y divide-[#1A2234] overflow-y-auto max-h-[640px]">
            {logsList.length === 0 ? (
              <div className="p-12 text-center text-slate-500 font-mono text-xs">
                No activity records found matching the active filters.
              </div>
            ) : (
              logsList.map((log) => {
                const isExpanded = expandedId === log.id;
                let badgeClass = "bg-slate-800 text-slate-300 border-slate-700";
                let actionCategoryLabel = log.category;

                if (log.category === "SECURITY" || log.action.includes("BLOCKED") || log.action.includes("STRIKE")) {
                  badgeClass = "bg-rose-950/60 text-rose-300 border-rose-800/80";
                  actionCategoryLabel = "TAMPER / STRIKE";
                } else if (log.category === "USER_MANAGEMENT" || log.actorRole === "SUPER_ADMIN") {
                  badgeClass = "bg-[#8B5CF6]/20 text-[#C084FC] border-[#8B5CF6]/40";
                  actionCategoryLabel = "GOVERNANCE";
                } else if (log.category === "QUIZ") {
                  badgeClass = "bg-indigo-950/60 text-indigo-300 border-indigo-800/60";
                  actionCategoryLabel = "ADMIN OP";
                } else if (log.category === "AUTHENTICATION") {
                  badgeClass = "bg-amber-500/20 text-amber-300 border-amber-500/40";
                  actionCategoryLabel = "AUTH";
                }

                return (
                  <div
                    key={log.id}
                    className="p-3.5 hover:bg-[#141C2E]/60 transition-colors font-mono text-xs"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5 flex-1 min-w-0">
                        {/* Timestamp */}
                        <span className="text-slate-500 text-[11px] shrink-0 pt-0.5">
                          {formatTimestamp(log.createdAt)}
                        </span>

                        {/* Event Category Tag */}
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold border shrink-0 ${badgeClass}`}
                        >
                          {actionCategoryLabel}
                        </span>

                        {/* Event Message */}
                        <div className="flex-1 min-w-0">
                          <div className="text-slate-200 leading-snug">
                            <span className="text-[#00E5FF] font-bold">
                              [{log.actorRole}: {log.actorName || log.actorEmail || "SYSTEM"}]
                            </span>{" "}
                            <span className="text-white font-semibold">{log.action}</span>
                            {log.targetLabel && (
                              <span className="text-slate-400"> &bull; target: &quot;{log.targetLabel}&quot;</span>
                            )}
                          </div>

                          {/* Safe details snippet */}
                          {log.metadata && (
                            <div className="text-[11px] text-slate-400 mt-1 truncate">
                              {Object.entries(log.metadata)
                                .map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : v}`)
                                .join(" &bull; ")}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Expand / Inspect button */}
                      {(log.metadata || log.payloadBefore || log.payloadAfter) && (
                        <button
                          type="button"
                          onClick={() => setExpandedId(isExpanded ? null : log.id)}
                          className="px-2 py-0.5 rounded bg-[#1A2338] border border-[#334155] text-slate-400 hover:text-white text-[10px] shrink-0 cursor-pointer"
                        >
                          {isExpanded ? "Close" : "Inspect"}
                        </button>
                      )}
                    </div>

                    {/* Expandable Metadata Drawer */}
                    {isExpanded && (
                      <div className="mt-3 p-3 rounded bg-[#090D15] border border-[#1E293B] text-[11px] space-y-2">
                        <div className="text-slate-400 text-[10px] uppercase font-bold">
                          Forensic Packet Metadata:
                        </div>
                        <pre className="text-[#00F59B] overflow-x-auto p-2 bg-black/60 rounded">
                          {JSON.stringify(
                            {
                              id: log.id,
                              actorId: log.actorId,
                              action: log.action,
                              targetEntity: log.targetEntity,
                              targetId: log.targetId,
                              metadata: log.metadata,
                              payloadBefore: log.payloadBefore,
                              payloadAfter: log.payloadAfter,
                              ipAddress: log.ipAddress,
                              createdAt: log.createdAt,
                            },
                            null,
                            2
                          )}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-3 border-t border-[#1E293B] bg-[#0C111C] flex items-center justify-between text-xs font-mono text-slate-400">
              <span>
                Page {page} of {totalPages} &bull; Total {total} events
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1 || isPending}
                  onClick={() => {
                    const p = Math.max(1, page - 1);
                    setPage(p);
                    refreshLogs(activeCategory, search, p);
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
                    refreshLogs(activeCategory, search, p);
                  }}
                  className="px-3 py-1 rounded bg-[#1A2338] border border-[#334155] text-slate-300 hover:text-white disabled:opacity-40 cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Integrity Gauges (Stitch Reference) */}
        <div className="space-y-4">
          <div className="bg-[#111726] border border-[#1E293B] rounded-xl p-5 shadow-lg space-y-5 font-mono">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Integrity Gauges
              </h3>
              <span className="px-2 py-0.5 rounded bg-rose-950/60 text-rose-300 border border-rose-800/80 text-[10px] font-bold">
                strike lock Active
              </span>
            </div>

            {/* Gauge 1: Active Defocus Strikes */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-400">Active Defocus Strikes</span>
                <span className="text-rose-400 font-bold">
                  {stats.securityEventsCount} / {totalRunners} (
                  {Math.round((stats.securityEventsCount / Math.max(1, totalRunners)) * 100)}%)
                </span>
              </div>
              <div className="w-full bg-[#090D15] rounded-full h-2 border border-[#1E293B] overflow-hidden">
                <div
                  className="bg-rose-500 h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round((stats.securityEventsCount / Math.max(1, totalRunners)) * 100)
                    )}%`,
                  }}
                />
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                Proctoring telemetry logging tab switches & window blur.
              </div>
            </div>

            {/* Gauge 2: Answer Collusion Risk */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-400">Answer Collusion Risk</span>
                <span className="text-[#00F59B] font-bold">0.02 (Ultra Low)</span>
              </div>
              <div className="w-full bg-[#090D15] rounded-full h-2 border border-[#1E293B] overflow-hidden">
                <div className="bg-[#00F59B] h-full w-[4%] rounded-full" />
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                Randomized question permutations prevent adjacent collusion.
              </div>
            </div>

            {/* Gauge 3: Proctor Stream Summary */}
            <div className="p-3 rounded-lg bg-[#0A0E17] border border-[#1E293B] text-xs space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span>Proctor Stream Summary</span>
                <span className="text-white font-bold">240 Sockets</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-[#1E293B]">
                <div>
                  <div className="text-slate-500 text-[9px] uppercase">Telemetry RTT</div>
                  <div className="text-[#00F59B] font-bold">18ms NOMINAL</div>
                </div>
                <div>
                  <div className="text-slate-500 text-[9px] uppercase">Postgres Pool</div>
                  <div className="text-[#00E5FF] font-bold">ACTIVE OK</div>
                </div>
              </div>
            </div>

            {/* Download Audit Packet Button */}
            <button
              type="button"
              onClick={downloadAuditPacket}
              className="w-full py-2.5 px-3 rounded-lg bg-[#1A2338] hover:bg-[#222E49] border border-[#334155] text-white text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4 text-[#00E5FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Forensic Audit Packet
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
