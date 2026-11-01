"use client";

import { useState, useTransition } from "react";
import { respondQuizAccessRequestAction } from "@/app/actions/admin-quiz";
import { useRouter } from "next/navigation";

export interface PendingAccessRequestItem {
  id: string;
  quizId: string;
  quizTitle: string;
  requestingAdminId: string;
  requestingAdminName: string;
  requestingAdminEmail: string;
  ownerId: string;
  status: string;
  note: string | null;
  createdAt: Date | string;
}

interface PendingAccessRequestsProps {
  initialRequests: PendingAccessRequestItem[];
}

export default function PendingAccessRequests({
  initialRequests,
}: PendingAccessRequestsProps) {
  const router = useRouter();
  const [requests, setRequests] = useState<PendingAccessRequestItem[]>(initialRequests);
  const [isPending, startTransition] = useTransition();

  const handleDecision = (requestId: string, decision: "APPROVED" | "REJECTED") => {
    startTransition(async () => {
      const res = await respondQuizAccessRequestAction(requestId, decision);
      if (res.success) {
        setRequests((prev) => prev.filter((r) => r.id !== requestId));
        router.refresh();
      } else {
        alert(res.error || "Failed to process access request.");
      }
    });
  };

  if (requests.length === 0) return null;

  return (
    <div className="border border-amber-300 bg-amber-50/60 rounded-2xl p-5 shadow-xs mb-8">
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-amber-200/80 mb-4">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
          <h2 className="text-sm font-bold text-amber-900 uppercase tracking-wider">
            Pending Full Access Delegations ({requests.length})
          </h2>
        </div>
        <span className="text-[11px] font-medium text-amber-700">
          Other organizers requesting administrative control
        </span>
      </div>

      <div className="space-y-3">
        {requests.map((req) => {
          const reqDate = new Date(req.createdAt).toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          });

          return (
            <div
              key={req.id}
              className="bg-white border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs"
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-slate-900">
                    {req.requestingAdminName}
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    ({req.requestingAdminEmail})
                  </span>
                </div>
                <div className="text-xs text-slate-700">
                  Requests full control for quiz:{" "}
                  <strong className="text-slate-900 font-bold">
                    &ldquo;{req.quizTitle}&rdquo;
                  </strong>
                </div>
                {req.note && (
                  <p className="text-[11px] text-slate-500 italic mt-0.5">
                    Note: &ldquo;{req.note}&rdquo;
                  </p>
                )}
                <div className="text-[10px] text-slate-400 mt-1 font-mono">
                  Requested at: {reqDate}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleDecision(req.id, "APPROVED")}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 shadow-xs flex items-center gap-1"
                >
                  <span>✓</span> Allow Full Control
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleDecision(req.id, "REJECTED")}
                  className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                >
                  ✕ Reject
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
