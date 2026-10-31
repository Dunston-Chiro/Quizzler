"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createQuizAction, deleteQuizAction } from "@/app/actions/admin-quiz";

export interface AdminQuizItem {
  id: string;
  title: string;
  description: string | null;
  roomCode: string | null;
  createdBy: string;
  creatorName: string;
  creatorEmail: string;
  sessionStatus: "DRAFT" | "SCHEDULED" | "LIVE" | "ENDED";
  resultsReleased: boolean;
  defaultTimePerQuestionSec: number;
  isSharedWithAdmins?: boolean;
  totalQuestions: number;
  totalPoints: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface QuizManagerClientProps {
  initialQuizzes: AdminQuizItem[];
  currentUserId: string;
  currentUserRole: string;
}

export default function QuizManagerClient({
  initialQuizzes,
  currentUserId,
  currentUserRole,
}: QuizManagerClientProps) {
  const router = useRouter();
  const [quizzes, setQuizzes] = useState<AdminQuizItem[]>(initialQuizzes);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // New Quiz form state
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newRoomCode, setNewRoomCode] = useState(
    () => `QZ-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
  );
  const [newDefaultTime, setNewDefaultTime] = useState(30);
  const [newShowTabSwitchCount, setNewShowTabSwitchCount] = useState(false);
  const [newIsSharedWithAdmins, setNewIsSharedWithAdmins] = useState(false);

  // Filter quizzes
  const filteredQuizzes = quizzes.filter((quiz) => {
    const isOwner = quiz.createdBy === currentUserId || currentUserRole === "SUPER_ADMIN";
    const matchesSearch =
      quiz.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (quiz.roomCode && quiz.roomCode.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (quiz.description && quiz.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (quiz.creatorName && quiz.creatorName.toLowerCase().includes(searchTerm.toLowerCase()));

    let matchesStatus = true;
    if (statusFilter === "MY QUIZZES") {
      matchesStatus = isOwner;
    } else if (statusFilter === "SHARED WITH ME") {
      matchesStatus = !isOwner && Boolean(quiz.isSharedWithAdmins);
    } else if (statusFilter !== "ALL") {
      matchesStatus = quiz.sessionStatus === statusFilter;
    }

    return matchesSearch && matchesStatus;
  });

  const handleCreateQuiz = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setErrorMsg(null);
    startTransition(async () => {
      const result = await createQuizAction({
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
        roomCode: newRoomCode.trim().toUpperCase(),
        defaultTimePerQuestionSec: Number(newDefaultTime) || 30,
        showTabSwitchCount: newShowTabSwitchCount,
        isSharedWithAdmins: newIsSharedWithAdmins,
      });

      if (result.success && result.data) {
        setShowCreateModal(false);
        setNewTitle("");
        setNewDescription("");
        setNewShowTabSwitchCount(false);
        setNewIsSharedWithAdmins(false);
        setNewRoomCode(`QZ-${Math.random().toString(36).substring(2, 6).toUpperCase()}`);
        router.refresh();
      } else {
        setErrorMsg(result.error || "Failed to create quiz.");
      }
    });
  };

  const handleDeleteQuiz = (quizId: string, title: string) => {
    if (!window.confirm(`Are you sure you want to delete "${title}"? This cannot be undone.`)) {
      return;
    }

    startTransition(async () => {
      const res = await deleteQuizAction(quizId);
      if (res.success) {
        setQuizzes((prev) => prev.filter((q) => q.id !== quizId));
        router.refresh();
      } else {
        alert(res.error || "Could not delete quiz.");
      }
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "LIVE":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            LIVE
          </span>
        );
      case "SCHEDULED":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
            SCHEDULED
          </span>
        );
      case "ENDED":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
            ENDED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            DRAFT
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col flex-1 bg-white">
      {/* Top Action Bar */}
      <div className="border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Quiz Management Studio
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Create, manage questions, and launch live synchronized quiz sessions.
          </p>
        </div>

        <button
          onClick={() => {
            setNewRoomCode(`QZ-${Math.random().toString(36).substring(2, 6).toUpperCase()}`);
            setShowCreateModal(true);
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white font-semibold text-sm rounded-lg shadow-sm transition-colors cursor-pointer self-start md:self-auto"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          Create New Quiz
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <svg
            className="w-4 h-4 absolute left-3 top-2.5 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search quizzes or room codes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-slate-800"
          />
        </div>

        {/* Status Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-1">
          {["ALL", "MY QUIZZES", "SHARED WITH ME", "LIVE", "SCHEDULED", "DRAFT", "ENDED"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 rounded-md text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                statusFilter === st
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Quizzes List Table / Grid */}
      <div className="flex-1 p-6 overflow-y-auto">
        {filteredQuizzes.length === 0 ? (
          <div className="border border-dashed border-slate-300 rounded-xl p-12 text-center max-w-lg mx-auto my-8">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-slate-800 mb-1">No quizzes found</h3>
            <p className="text-xs text-slate-500 mb-4">
              {searchTerm || statusFilter !== "ALL"
                ? "No quizzes match your current search or filter criteria."
                : "You haven't created any quizzes yet. Start by creating your first competition quiz."}
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-sky-500 hover:bg-sky-600 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              + Create New Quiz
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredQuizzes.map((quiz) => {
              const isOwner = quiz.createdBy === currentUserId || currentUserRole === "SUPER_ADMIN";

              return (
                <div
                  key={quiz.id}
                  className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
                >
                  <div>
                    {/* Header: Room & Status */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200/90 rounded-md px-2 py-0.5 text-xs font-mono font-bold text-slate-700">
                        <span>ROOM:</span>
                        <span className="text-sky-700">{quiz.roomCode || "N/A"}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {!isOwner && quiz.isSharedWithAdmins && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-300" title="Shared by another organizer in view-only mode">
                            👁️ Shared
                          </span>
                        )}
                        {getStatusBadge(quiz.sessionStatus)}
                      </div>
                    </div>

                    {/* Title & Description */}
                    <h3 className="text-base font-bold text-slate-900 line-clamp-1 mb-1">
                      {quiz.title}
                    </h3>
                    <p className="text-xs text-slate-500 line-clamp-2 min-h-[32px] mb-4">
                      {quiz.description || "No description provided."}
                    </p>

                    {/* Meta stats */}
                    <div className="grid grid-cols-3 gap-2 bg-slate-50 rounded-lg p-2.5 mb-4 text-center border border-slate-100">
                      <div>
                        <div className="text-[10px] uppercase font-bold text-slate-400">Questions</div>
                        <div className="text-sm font-extrabold text-slate-800">{quiz.totalQuestions}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase font-bold text-slate-400">Total Pts</div>
                        <div className="text-sm font-extrabold text-slate-800">{quiz.totalPoints}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase font-bold text-slate-400">Time / Q</div>
                        <div className="text-sm font-extrabold text-slate-800">{quiz.defaultTimePerQuestionSec}s</div>
                      </div>
                    </div>

                    {/* Author attribution for shared quizzes */}
                    {!isOwner && (
                      <div className="text-[11px] text-slate-500 mb-3 truncate flex items-center gap-1">
                        <span className="font-semibold text-slate-600">Created by:</span>
                        <span className="font-bold text-slate-800">{quiz.creatorName}</span>
                        <span className="text-slate-400 font-mono">({quiz.creatorEmail})</span>
                      </div>
                    )}

                    {/* Author attribution for super-admins */}
                    {currentUserRole === "SUPER_ADMIN" && isOwner && (
                      <div className="text-[11px] text-slate-400 mb-3 truncate">
                        Owner: <span className="font-medium text-slate-600">{quiz.creatorName}</span> ({quiz.creatorEmail})
                      </div>
                    )}
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <Link
                      href={`/admin/quizzes/${quiz.id}`}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      {isOwner ? "Question Studio" : "View Questions (View-Only)"}
                    </Link>

                    <div className="flex items-center gap-1.5">
                      {isOwner && (
                        <button
                          onClick={() => handleDeleteQuiz(quiz.id, quiz.title)}
                          disabled={isPending || quiz.sessionStatus === "LIVE"}
                          title={quiz.sessionStatus === "LIVE" ? "Cannot delete while LIVE" : "Delete Quiz"}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors disabled:opacity-40 cursor-pointer"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}

                      <Link
                        href={`/admin/quizzes/${quiz.id}/live`}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-xs flex items-center gap-1.5 ${
                          isOwner
                            ? "bg-sky-500 hover:bg-sky-600 text-white"
                            : "bg-slate-900 hover:bg-slate-800 text-white"
                        }`}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {isOwner ? "Launch Live Stage" : "Observe Live Stage"}
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Quiz Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <h2 className="text-base font-bold text-slate-900">Create New Competition Quiz</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 mb-4 rounded-lg bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreateQuiz} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Quiz Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ACM Chapter Annual Coding Blitz 2026"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Brief competition summary or instructions..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-900 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Room Code
                  </label>
                  <input
                    type="text"
                    required
                    value={newRoomCode}
                    onChange={(e) => setNewRoomCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 text-sm font-mono font-bold bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Default Timer (Sec)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={300}
                    value={newDefaultTime}
                    onChange={(e) => setNewDefaultTime(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={newShowTabSwitchCount}
                    onChange={(e) => setNewShowTabSwitchCount(e.target.checked)}
                    className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300"
                  />
                  <span>Display tab switch count to participants during quiz</span>
                </label>
                <p className="text-[11px] text-slate-500 ml-6 mt-0.5">
                  When unchecked (default), tab switch counts remain hidden during the test to prevent distraction, but will always appear on the final scorecard.
                </p>
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={newIsSharedWithAdmins}
                    onChange={(e) => setNewIsSharedWithAdmins(e.target.checked)}
                    className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300"
                  />
                  <span>Share live quiz with other Admins</span>
                </label>
                <p className="text-[11px] text-slate-500 ml-6 mt-0.5">
                  Allow other authenticated administrators to monitor this live quiz session in view-only mode.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || !newTitle.trim()}
                  className="px-4 py-2 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  {isPending ? "Creating..." : "Create Quiz"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
