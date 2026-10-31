"use client";

import { useState, useEffect, useTransition, useMemo, useCallback } from "react";
import {
  updateQuizStatusAction,
  toggleResultVisibilityAction,
  toggleLeaderboardVisibilityAction,
  toggleTabSwitchCountVisibilityAction,
  toggleQuizSharingAction,
  toggleQualificationAction,
  createQuestionAction,
  updateQuizAction,
  getStudentAttemptReviewAction,
} from "@/app/actions/admin-quiz";

interface StudentReviewData {
  quizTitle: string;
  quizId: string;
  attemptId: string;
  studentName: string;
  studentTeam: string | null;
  studentEmail: string;
  collegeName: string | null;
  rollNumber: string | null;
  totalScore: number;
  tabSwitchCount: number;
  status: "IN_PROGRESS" | "COMPLETED" | "DISQUALIFIED";
  qualifiedForNextRound: boolean;
  startedAt: Date | string | null;
  completedAt: Date | string | null;
  isReadOnly: boolean;
  questions: Array<{
    questionId: string;
    orderIndex: number;
    questionText: string;
    questionType: string;
    codeSnippet: string | null;
    points: number;
    timeLimitSeconds: number;
    options: Array<{ id: string; text: string }>;
    correctOptionIds: string[];
    explanation: string | null;
    studentAnswer: {
      selectedOptionIds: string[];
      isCorrect: boolean;
      scoreAwarded: number;
      timedOut: boolean;
      startedAt: Date | string;
      submittedAt: Date | string;
    } | null;
  }>;
}

export interface LiveStageClientProps {
  quizId: string;
  initialData: {
    quiz: {
      id: string;
      title: string;
      description?: string | null;
      roomCode?: string | null;
      sessionStatus: "DRAFT" | "SCHEDULED" | "LIVE" | "ENDED";
      resultsReleased: boolean;
      showLeaderboard?: boolean;
      showTabSwitchCount?: boolean;
      isSharedWithAdmins?: boolean;
      ownerName?: string;
      isReadOnly?: boolean;
      defaultTimePerQuestionSec: number;
      totalQuestions: number;
    };
    questions: Array<{
      id: string;
      orderIndex: number;
      questionText: string;
      questionType: string;
      options: Array<{ id: string; text: string }>;
      correctOptionIds: string[];
      points: number;
      timeLimitSeconds: number;
    }>;
    attempts: Array<{
      id: string;
      userId: string;
      userName: string;
      userEmail: string;
      collegeName?: string | null;
      rollNumber?: string | null;
      currentQuestionIndex: number;
      totalScore: number;
      tabSwitchCount: number;
      status: "IN_PROGRESS" | "COMPLETED" | "DISQUALIFIED";
      qualifiedForNextRound: boolean;
      startedAt?: Date | string | null;
      completedAt?: Date | string | null;
    }>;
    answers: Array<{
      id: string;
      attemptId: string;
      questionId: string;
      selectedOptionIds: string[];
      isCorrect: boolean;
      scoreAwarded: number;
      timedOut: boolean;
    }>;
    metrics: {
      totalParticipants: number;
      activeParticipants: number;
      disqualifiedCount: number;
      flaggedCount: number;
      totalProctorEvents: number;
      totalAnswersSubmitted: number;
      overallAccuracy: number;
      questionAccuracy: Array<{
        questionId: string;
        orderIndex: number;
        totalResponses: number;
        correctResponses: number;
        accuracyRate: number;
      }>;
    };
  };
}

type SortField = "name" | "score" | "time" | "tabSwitchCount";
type SortDirection = "asc" | "desc";

export default function LiveStageClient({
  quizId,
  initialData,
}: LiveStageClientProps) {
  const [data, setData] = useState(initialData);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<"ALL" | "IN_PROGRESS" | "FLAGGED" | "QUALIFIED">("ALL");
  const [showStudentNames, setShowStudentNames] = useState(true);
  const [showAnswers, setShowAnswers] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Sorting state
  const [sortField, setSortField] = useState<SortField>("score");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Quick Question Injector Form State
  const [isInjectorOpen, setIsInjectorOpen] = useState(true);
  const [injectorType, setInjectorType] = useState<"MULTIPLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER">("MULTIPLE_CHOICE");
  const [promptText, setPromptText] = useState("");
  const [opt1, setOpt1] = useState("");
  const [opt2, setOpt2] = useState("");
  const [opt3, setOpt3] = useState("");
  const [opt4, setOpt4] = useState("");
  const [correctOptIndex, setCorrectOptIndex] = useState(0);
  const [injectorPoints, setInjectorPoints] = useState(100);
  const [injectorTimer, setInjectorTimer] = useState(30);
  const [injectorSuccess, setInjectorSuccess] = useState(false);

  // Student Review Modal State
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewData, setReviewData] = useState<StudentReviewData | null>(null);

  // Pure timer state for live duration calculations
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  // Poll live telemetry every 4 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      setCurrentTime(Date.now());
      try {
        const res = await fetch(`/api/admin/quizzes/${quizId}/live`);
        if (res.ok) {
          const freshData = await res.json();
          setData(freshData);
        }
      } catch {
        // network polling error ignored gracefully
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [quizId]);

  // Lock body scroll when review modal is open
  useEffect(() => {
    if (selectedAttemptId) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [selectedAttemptId]);

  const { quiz, questions, attempts, answers, metrics } = data;
  const isLive = quiz.sessionStatus === "LIVE";
  const isReadOnly = Boolean(quiz.isReadOnly);

  // Compute duration in seconds for an attempt (pure via currentTime state)
  const getAttemptDuration = useCallback(
    (att: (typeof attempts)[0]) => {
      if (!att.startedAt) return 0;
      const start = new Date(att.startedAt).getTime();
      const end = att.completedAt ? new Date(att.completedAt).getTime() : currentTime;
      return Math.max(0, Math.round((end - start) / 1000));
    },
    [currentTime]
  );

  const formatDuration = (seconds: number) => {
    if (seconds <= 0) return "0s";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m === 0) return `${s}s`;
    return `${m}m ${s.toString().padStart(2, "0")}s`;
  };

  // Filter participants
  const filteredAttempts = useMemo(() => {
    return attempts.filter((att) => {
      const matchesSearch =
        att.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (att.collegeName && att.collegeName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (att.rollNumber && att.rollNumber.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      if (filterMode === "IN_PROGRESS") return att.status === "IN_PROGRESS";
      if (filterMode === "FLAGGED") return att.tabSwitchCount > 0;
      if (filterMode === "QUALIFIED") return att.qualifiedForNextRound;
      return true;
    });
  }, [attempts, searchQuery, filterMode]);

  // Sort participants
  const sortedAttempts = useMemo(() => {
    return [...filteredAttempts].sort((a, b) => {
      let valA: number | string = 0;
      let valB: number | string = 0;

      switch (sortField) {
        case "name":
          valA = (a.userName || "").toLowerCase();
          valB = (b.userName || "").toLowerCase();
          return sortDirection === "asc"
            ? (valA as string).localeCompare(valB as string)
            : (valB as string).localeCompare(valA as string);
        case "score":
          valA = Number(a.totalScore) || 0;
          valB = Number(b.totalScore) || 0;
          break;
        case "time":
          valA = getAttemptDuration(a);
          valB = getAttemptDuration(b);
          break;
        case "tabSwitchCount":
          valA = Number(a.tabSwitchCount) || 0;
          valB = Number(b.tabSwitchCount) || 0;
          break;
      }

      if (valA === valB) return 0;
      return sortDirection === "asc" ? (valA < valB ? -1 : 1) : (valA > valB ? -1 : 1);
    });
  }, [filteredAttempts, sortField, sortDirection, getAttemptDuration]);

  const handleSortToggle = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection(field === "name" ? "asc" : "desc");
    }
  };

  // Action handlers
  const handleToggleStatus = (newStatus: "LIVE" | "ENDED" | "DRAFT") => {
    if (isReadOnly) return;
    startTransition(async () => {
      const res = await updateQuizStatusAction(quizId, newStatus);
      if (res.success && res.data) {
        setData((prev) => ({
          ...prev,
          quiz: { ...prev.quiz, sessionStatus: (res.data as { sessionStatus: "LIVE" | "ENDED" | "DRAFT" }).sessionStatus },
        }));
      }
    });
  };

  const handleToggleResults = () => {
    if (isReadOnly) return;
    startTransition(async () => {
      const newVal = !quiz.resultsReleased;
      const res = await toggleResultVisibilityAction(quizId, newVal);
      if (res.success) {
        setData((prev) => ({
          ...prev,
          quiz: { ...prev.quiz, resultsReleased: newVal },
        }));
      }
    });
  };

  const handleToggleLeaderboard = () => {
    if (isReadOnly) return;
    startTransition(async () => {
      const newVal = !quiz.showLeaderboard;
      const res = await toggleLeaderboardVisibilityAction(quizId, newVal);
      if (res.success) {
        setData((prev) => ({
          ...prev,
          quiz: { ...prev.quiz, showLeaderboard: newVal },
        }));
      }
    });
  };

  const handleToggleTabSwitchCount = () => {
    if (isReadOnly) return;
    startTransition(async () => {
      const newVal = !quiz.showTabSwitchCount;
      const res = await toggleTabSwitchCountVisibilityAction(quizId, newVal);
      if (res.success) {
        setData((prev) => ({
          ...prev,
          quiz: { ...prev.quiz, showTabSwitchCount: newVal },
        }));
      }
    });
  };

  const handleToggleQuizSharing = () => {
    if (isReadOnly) return;
    startTransition(async () => {
      const newVal = !quiz.isSharedWithAdmins;
      const res = await toggleQuizSharingAction(quizId, newVal);
      if (res.success) {
        setData((prev) => ({
          ...prev,
          quiz: { ...prev.quiz, isSharedWithAdmins: newVal },
        }));
      }
    });
  };

  const handleCadenceChange = (sec: number) => {
    if (isReadOnly) return;
    startTransition(async () => {
      await updateQuizAction(quizId, { defaultTimePerQuestionSec: sec });
      setData((prev) => ({
        ...prev,
        quiz: { ...prev.quiz, defaultTimePerQuestionSec: sec },
      }));
    });
  };

  const handleToggleQualification = (attemptId: string, current: boolean) => {
    if (isReadOnly) return;
    startTransition(async () => {
      const res = await toggleQualificationAction(attemptId, quizId, !current);
      if (res.success) {
        setData((prev) => ({
          ...prev,
          attempts: prev.attempts.map((att) =>
            att.id === attemptId ? { ...att, qualifiedForNextRound: !current } : att
          ),
        }));
        if (reviewData && reviewData.attemptId === attemptId) {
          setReviewData({ ...reviewData, qualifiedForNextRound: !current });
        }
      }
    });
  };

  const handleInjectQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly || !promptText.trim()) return;

    let optionsArray: Array<{ id: string; text: string }> = [];
    let correctId = "opt1";

    if (injectorType === "TRUE_FALSE") {
      optionsArray = [
        { id: "opt1", text: "True" },
        { id: "opt2", text: "False" },
      ];
      correctId = correctOptIndex === 0 ? "opt1" : "opt2";
    } else {
      const rawOptions = [opt1, opt2, opt3, opt4].filter((o) => o.trim().length > 0);
      if (rawOptions.length < 2) return;
      optionsArray = rawOptions.map((text, i) => ({
        id: `opt${i + 1}`,
        text: text.trim(),
      }));
      correctId = `opt${correctOptIndex + 1}`;
    }

    startTransition(async () => {
      const res = await createQuestionAction(quizId, {
        questionText: promptText.trim(),
        questionType: injectorType,
        options: optionsArray,
        correctOptionIds: [correctId],
        points: injectorPoints,
        timeLimitSeconds: injectorTimer,
      });

      if (res.success) {
        setPromptText("");
        setOpt1("");
        setOpt2("");
        setOpt3("");
        setOpt4("");
        setInjectorSuccess(true);
        setTimeout(() => setInjectorSuccess(false), 2500);

        // Fetch fresh state
        const refresh = await fetch(`/api/admin/quizzes/${quizId}/live`);
        if (refresh.ok) {
          setData(await refresh.json());
        }
      }
    });
  };

  // Student Answer Review Modal Handlers
  const handleOpenReview = async (attemptId: string) => {
    if (isReadOnly) return;
    setSelectedAttemptId(attemptId);
    setReviewLoading(true);
    setReviewError(null);
    setReviewData(null);

    try {
      const res = await getStudentAttemptReviewAction(quizId, attemptId);
      if (res.success && res.data) {
        setReviewData(res.data as StudentReviewData);
      } else {
        setReviewError(res.error || "Failed to load student review.");
      }
    } catch {
      setReviewError("An unexpected error occurred while loading review.");
    } finally {
      setReviewLoading(false);
    }
  };

  const handleCloseReview = () => {
    setSelectedAttemptId(null);
    setReviewData(null);
    setReviewError(null);
  };

  // Find current live question (order index based on max answered or 1st question)
  const currentLiveQ = questions[0];

  return (
    <div className="flex flex-col flex-1 bg-white">
      {/* 0. View-Only Observation Banner (For shared live quizzes) */}
      {isReadOnly && (
        <div className="bg-sky-50 border-b border-sky-200 px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-sky-900">
          <div className="flex items-center gap-2">
            <span className="text-base">👁️</span>
            <span className="font-bold">VIEW-ONLY MONITORING MODE:</span>
            <span>
              This live quiz is owned by <strong>{quiz.ownerName || "Organizer"}</strong>. You have observation clearance. Administrative mutations, status changes, question injections, and participant modifications are disabled.
            </span>
          </div>
          <span className="bg-sky-200/80 text-sky-900 font-bold px-2 py-0.5 rounded text-[10px] uppercase tracking-wider">
            Observer Clearance
          </span>
        </div>
      )}

      {/* 1. Stage Status Bar */}
      <div className="border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-50/50">
        <div className="flex flex-wrap items-center gap-3">
          <div
            className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
              isLive
                ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                : quiz.sessionStatus === "ENDED"
                ? "bg-rose-100 text-rose-800 border border-rose-300"
                : "bg-amber-100 text-amber-800 border border-amber-300"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isLive ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
              }`}
            />
            {isLive ? "Activity in Progress" : `Stage ${quiz.sessionStatus}`}
          </div>

          <div className="flex flex-col">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              {quiz.title}
              <span className="text-slate-400 font-normal text-sm">
                Q{questions.length > 0 ? "01" : "00"} of {questions.length} in flight
              </span>
            </h1>
            <p className="text-xs text-slate-500 font-medium truncate max-w-xl">
              Live question: {currentLiveQ ? currentLiveQ.questionText : "No questions in deck"}
            </p>
          </div>
        </div>

        {!isReadOnly ? (
          <div className="flex items-center gap-2.5 shrink-0">
            {isLive ? (
              <button
                onClick={() => handleToggleStatus("DRAFT")}
                disabled={isPending}
                className="px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <span>⏸</span> Pause Stage
              </button>
            ) : (
              <button
                onClick={() => handleToggleStatus("LIVE")}
                disabled={isPending}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <span>▶</span> Launch Stage
              </button>
            )}

            <button
              onClick={() => alert(`Announcement pushed to room ${quiz.roomCode || "STG2-BIM"}`)}
              className="px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <span>📢</span> Push Announcement
            </button>

            {isLive && (
              <button
                onClick={() => handleToggleStatus("ENDED")}
                disabled={isPending}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <span>⏹</span> Finish Activity
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg">
              Controls Managed by Organizer ({quiz.ownerName || "Owner"})
            </span>
          </div>
        )}
      </div>

      {/* 2. Cadence & Visibility Controls Bar */}
      <div className="border-b border-slate-200/80 px-6 py-2.5 flex flex-wrap items-center justify-between gap-4 text-xs bg-white">
        <div className="flex items-center gap-2">
          <span className="text-slate-500 font-semibold text-[11px] uppercase tracking-wider">
            Question Cadence:
          </span>
          {[15, 30, 45, 60].map((sec) => (
            <button
              key={sec}
              onClick={() => handleCadenceChange(sec)}
              disabled={isReadOnly}
              className={`px-2.5 py-1 rounded-md font-semibold text-xs transition-colors ${
                quiz.defaultTimePerQuestionSec === sec
                  ? "bg-sky-600 text-white font-bold shadow-xs"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700"
              } ${isReadOnly ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}`}
            >
              {sec}s {sec === 30 && "★"}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <label
            className={`flex items-center gap-2 text-slate-700 font-medium ${
              isReadOnly ? "opacity-70 cursor-not-allowed" : "cursor-pointer"
            }`}
            title={isReadOnly ? "Disabled in view-only monitoring mode" : undefined}
          >
            <input
              type="checkbox"
              checked={showStudentNames}
              onChange={(e) => !isReadOnly && setShowStudentNames(e.target.checked)}
              disabled={isReadOnly}
              className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300 disabled:opacity-50"
            />
            <span>Show Student Names</span>
          </label>

          <label
            className={`flex items-center gap-2 text-slate-700 font-medium ${
              isReadOnly ? "opacity-70 cursor-not-allowed" : "cursor-pointer"
            }`}
            title={isReadOnly ? "Disabled in view-only monitoring mode" : undefined}
          >
            <input
              type="checkbox"
              checked={showAnswers}
              onChange={(e) => !isReadOnly && setShowAnswers(e.target.checked)}
              disabled={isReadOnly}
              className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300 disabled:opacity-50"
            />
            <span>Show Answers</span>
          </label>

          <label className={`flex items-center gap-2 text-slate-700 font-medium ${isReadOnly ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}`}>
            <input
              type="checkbox"
              checked={quiz.resultsReleased}
              onChange={handleToggleResults}
              disabled={isReadOnly}
              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
            />
            <span className={quiz.resultsReleased ? "text-emerald-700 font-bold" : ""}>
              Show Final Results to Students
            </span>
          </label>

          <label className={`flex items-center gap-2 text-slate-700 font-medium ${isReadOnly ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}`}>
            <input
              type="checkbox"
              checked={Boolean(quiz.showLeaderboard)}
              onChange={handleToggleLeaderboard}
              disabled={isReadOnly}
              className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300"
            />
            <span className={quiz.showLeaderboard ? "text-amber-800 font-bold" : ""}>
              Show Top 10 Leaderboard
            </span>
          </label>

          <label className={`flex items-center gap-2 text-slate-700 font-medium ${isReadOnly ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}`}>
            <input
              type="checkbox"
              checked={Boolean(quiz.showTabSwitchCount)}
              onChange={handleToggleTabSwitchCount}
              disabled={isReadOnly}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
            />
            <span className={quiz.showTabSwitchCount ? "text-indigo-800 font-bold" : ""}>
              Display Tab Switch Count over Quiz
            </span>
          </label>

          {/* Share live quiz with other Admins Toggle */}
          <label className={`flex items-center gap-2 text-slate-700 font-medium ${isReadOnly ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}`} title="Allow other authenticated Admins to observe this live quiz in view-only mode">
            <input
              type="checkbox"
              checked={Boolean(quiz.isSharedWithAdmins)}
              onChange={handleToggleQuizSharing}
              disabled={isReadOnly || isPending}
              className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300"
            />
            <span className={quiz.isSharedWithAdmins ? "text-sky-800 font-bold" : ""}>
              Share live quiz with other Admins
            </span>
          </label>
        </div>
      </div>

      {/* 3. Metrics Row (4 Cards Grid) */}
      <div className="p-6 pb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Participants */}
          <div className="bg-slate-50/70 border border-slate-200/90 rounded-xl p-4 flex flex-col justify-between shadow-2xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Total Participants
              </span>
              <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                • {metrics.totalParticipants > 0 ? `${Math.round((metrics.activeParticipants / metrics.totalParticipants) * 100)}%` : "0%"} Active
              </span>
            </div>
            <div className="text-3xl font-black text-slate-900 tracking-tight my-1">
              {metrics.totalParticipants}{" "}
              <span className="text-slate-400 text-lg font-normal">/ 250 enrolled</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-200/60 mt-2">
              <span>• {metrics.disqualifiedCount} Dropped / Lagging</span>
              <span>Slot limit: 250</span>
            </div>
          </div>

          {/* Card 2: Question Submissions */}
          <div className="bg-slate-50/70 border border-slate-200/90 rounded-xl p-4 flex flex-col justify-between shadow-2xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Total Submissions
              </span>
              <span className="text-[10px] font-bold bg-sky-100 text-sky-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                ⏱ {quiz.defaultTimePerQuestionSec}s Cadence
              </span>
            </div>
            <div className="text-3xl font-black text-slate-900 tracking-tight my-1">
              {metrics.totalAnswersSubmitted}{" "}
              <span className="text-slate-400 text-lg font-normal">
                ({metrics.totalParticipants > 0 ? Math.round((metrics.totalAnswersSubmitted / (metrics.totalParticipants * Math.max(1, questions.length))) * 100) : 0}%)
              </span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-1.5 my-1 overflow-hidden">
              <div
                className="bg-sky-500 h-1.5 rounded-full transition-all"
                style={{
                  width: `${metrics.totalParticipants > 0 ? Math.min(100, Math.round((metrics.totalAnswersSubmitted / (metrics.totalParticipants * Math.max(1, questions.length))) * 100)) : 0}%`,
                }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
              <span>Remaining: {Math.max(0, metrics.totalParticipants * Math.max(1, questions.length) - metrics.totalAnswersSubmitted)} answers</span>
              <span className="flex items-center gap-1 text-sky-600 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-ping" />
                Syncing live
              </span>
            </div>
          </div>

          {/* Card 3: Class Accuracy */}
          <div className="bg-slate-50/70 border border-slate-200/90 rounded-xl p-4 flex flex-col justify-between shadow-2xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Class Accuracy
              </span>
              <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                Good Pace
              </span>
            </div>
            <div className="text-3xl font-black text-slate-900 tracking-tight my-1">
              {metrics.overallAccuracy}%
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-200/60 mt-2">
              <span>{questions.length} Questions deck</span>
              <span>Graded live</span>
            </div>
          </div>

          {/* Card 4: Integrity Flags */}
          <div className="bg-slate-50/70 border border-slate-200/90 rounded-xl p-4 flex flex-col justify-between shadow-2xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Integrity Flags
              </span>
              <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                • {metrics.totalProctorEvents} Warnings
              </span>
            </div>
            <div className="flex items-center gap-2 my-1">
              <span className="px-2.5 py-1 rounded bg-rose-100 text-rose-800 font-bold text-xs">
                {metrics.disqualifiedCount} DQ
              </span>
              <span className="px-2.5 py-1 rounded bg-amber-100 text-amber-800 font-bold text-xs">
                {metrics.flaggedCount} Under Audit
              </span>
              <span className="px-2.5 py-1 rounded bg-slate-200 text-slate-700 font-bold text-xs">
                {metrics.totalProctorEvents} Warned
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-200/60 mt-2">
              <span>Tab blur incidents</span>
              <span className="text-sky-600 font-bold">Server recorded</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Monitoring & Participant Section (Full-width with relocated Quick Question Injector) */}
      <div className="p-6 pt-2 space-y-5 flex-1 flex flex-col">
        {/* Relocated Quick Question Injector: Positioned immediately above Participants table */}
        {!isReadOnly && (
          <div className="border border-slate-200 rounded-xl bg-white shadow-xs overflow-hidden">
            <div
              className="p-3.5 bg-slate-50/80 border-b border-slate-200/90 flex items-center justify-between cursor-pointer select-none"
              onClick={() => setIsInjectorOpen(!isInjectorOpen)}
            >
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-md bg-sky-100 text-sky-700 font-bold text-sm flex items-center justify-center">
                  ⊕
                </span>
                <h3 className="font-bold text-slate-900 text-xs sm:text-sm">
                  Quick Question Injector
                </h3>
                <span className="text-[10px] font-bold bg-sky-100 text-sky-800 px-2 py-0.5 rounded uppercase">
                  Live Deck
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                <span>{isInjectorOpen ? "Hide Injector ▲" : "Expand Injector ▼"}</span>
              </div>
            </div>

            {isInjectorOpen && (
              <div className="p-5 bg-white">
                {/* Question Type Pills */}
                <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-lg mb-4 text-xs max-w-md">
                  {(["MULTIPLE_CHOICE", "TRUE_FALSE", "SHORT_ANSWER"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setInjectorType(type)}
                      className={`py-1 rounded font-semibold text-[11px] transition-all cursor-pointer ${
                        injectorType === type
                          ? "bg-white text-sky-700 shadow-2xs font-bold"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      {type === "MULTIPLE_CHOICE"
                        ? "Multiple Choice"
                        : type === "TRUE_FALSE"
                        ? "True / False"
                        : "Short Answer"}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleInjectQuestion} className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Question Prompt
                    </label>
                    <textarea
                      required
                      rows={2}
                      value={promptText}
                      onChange={(e) => setPromptText(e.target.value)}
                      placeholder="e.g. Which consensus mechanism does Ethereum 2.0 utilize?"
                      className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-sky-500 focus:bg-white focus:outline-none"
                    />
                  </div>

                  {/* Options */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                      Options (Select Correct Answer)
                    </label>

                    {injectorType === "TRUE_FALSE" ? (
                      <div className="flex flex-wrap items-center gap-4">
                        {["True", "False"].map((val, idx) => (
                          <label
                            key={val}
                            className={`flex items-center gap-2.5 px-4 py-2 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                              correctOptIndex === idx
                                ? "bg-sky-50 border-sky-300 text-sky-900 font-bold"
                                : "bg-slate-50 border-slate-200 text-slate-700"
                            }`}
                          >
                            <input
                              type="radio"
                              name="tfOption"
                              checked={correctOptIndex === idx}
                              onChange={() => setCorrectOptIndex(idx)}
                              className="w-4 h-4 text-sky-600 focus:ring-sky-500 cursor-pointer"
                            />
                            <span>{val}</span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {[
                          { val: opt1, set: setOpt1, label: "Option A" },
                          { val: opt2, set: setOpt2, label: "Option B" },
                          { val: opt3, set: setOpt3, label: "Option C" },
                          { val: opt4, set: setOpt4, label: "Option D" },
                        ].map((opt, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-2 focus-within:border-sky-400 focus-within:bg-white"
                          >
                            <input
                              type="radio"
                              name="correctOption"
                              checked={correctOptIndex === idx}
                              onChange={() => setCorrectOptIndex(idx)}
                              className="w-4 h-4 ml-1 text-sky-600 focus:ring-sky-500 cursor-pointer shrink-0"
                            />
                            <input
                              type="text"
                              required={idx < 2}
                              value={opt.val}
                              onChange={(e) => opt.set(e.target.value)}
                              placeholder={opt.label}
                              className="w-full bg-transparent text-xs font-medium text-slate-800 focus:outline-none px-1"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Points, Timer & Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-bold uppercase tracking-wider text-[11px] text-slate-500">Points:</span>
                        <select
                          value={injectorPoints}
                          onChange={(e) => setInjectorPoints(Number(e.target.value))}
                          className="p-1.5 bg-slate-50 border border-slate-300 rounded-md text-xs font-semibold text-slate-800 cursor-pointer"
                        >
                          <option value={100}>100 pts</option>
                          <option value={50}>50 pts</option>
                          <option value={200}>200 pts</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-bold uppercase tracking-wider text-[11px] text-slate-500">Timer:</span>
                        <select
                          value={injectorTimer}
                          onChange={(e) => setInjectorTimer(Number(e.target.value))}
                          className="p-1.5 bg-slate-50 border border-slate-300 rounded-md text-xs font-semibold text-slate-800 cursor-pointer"
                        >
                          <option value={15}>15s</option>
                          <option value={30}>30s</option>
                          <option value={45}>45s</option>
                          <option value={60}>60s</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {injectorSuccess && (
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-md">
                          ✓ Question pushed to live deck!
                        </span>
                      )}

                      <button
                        type="submit"
                        disabled={isPending}
                        className="px-5 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs uppercase tracking-wider shadow-xs transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
                      >
                        <span>🚀</span> Push Question to Live Session
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* Live Participants Table Container */}
        <div className="border border-slate-200 rounded-xl bg-white shadow-xs overflow-hidden flex-1 flex flex-col justify-between">
          {/* Controls & Filter Bar */}
          <div className="p-4 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3 bg-slate-50/40">
            <div className="flex items-center gap-2 flex-1 min-w-[260px]">
              <div className="relative flex-1 max-w-sm">
                <input
                  type="text"
                  placeholder="Search student, team, or college..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                />
                <span className="absolute left-2.5 top-2 text-slate-400 text-xs">🔍</span>
              </div>

              <select
                value={filterMode}
                onChange={(e) => setFilterMode(e.target.value as "ALL" | "IN_PROGRESS" | "FLAGGED" | "QUALIFIED")}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Participants ({attempts.length})</option>
                <option value="IN_PROGRESS">Active Only ({metrics.activeParticipants})</option>
                <option value="FLAGGED">Flagged / Blur ({metrics.flaggedCount})</option>
                <option value="QUALIFIED">Round 2 Qualified</option>
              </select>
            </div>

            {/* Sorting Controls and Legend */}
            <div className="flex flex-wrap items-center gap-4 text-xs">
              {/* Legend */}
              <div className="flex items-center gap-2 text-slate-500 text-[11px] font-medium">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" /> Correct
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-rose-500" /> Wrong
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-sky-500" /> In Flight
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-slate-300" /> Unanswered
                </span>
              </div>

              <div className="px-2.5 py-1 rounded bg-sky-50 border border-sky-200 text-sky-800 font-bold text-[11px]">
                {questions.length} Total Questions
              </div>
            </div>
          </div>

          {/* Table Container with Scrollbar and Sticky Student Header */}
          <div className="overflow-x-auto overflow-y-auto max-h-[600px] flex-1">
            <table className="w-full text-left border-collapse text-xs min-w-[800px]">
              <thead className="sticky top-0 z-20 bg-slate-50/95 backdrop-blur-xs shadow-2xs">
                <tr className="text-slate-500 font-bold text-[10px] uppercase tracking-wider border-b border-slate-200">
                  <th className="py-2.5 px-3 w-12 text-center sticky left-0 z-30 bg-slate-50">
                    Rank
                  </th>
                  <th
                    className="py-2.5 px-4 min-w-[190px] sticky left-12 z-30 bg-slate-50 border-r border-slate-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] cursor-pointer hover:text-slate-900 select-none"
                    onClick={() => handleSortToggle("name")}
                  >
                    <div className="flex items-center gap-1">
                      <span>Student / Squad</span>
                      {sortField === "name" && (
                        <span className="text-sky-600 font-black">{sortDirection === "asc" ? "▲" : "▼"}</span>
                      )}
                    </div>
                  </th>
                  <th className="py-2.5 px-3 w-28">Progress</th>

                  {/* Complete Question Progress Headers (Every Question) */}
                  {questions.map((q, idx) => (
                    <th key={q.id} className="py-2.5 px-2 text-center min-w-[42px] max-w-[50px]">
                      <span className="font-mono text-[10px] font-bold">Q{idx + 1}</span>
                    </th>
                  ))}

                  <th
                    className="py-2.5 px-4 text-right min-w-[90px] cursor-pointer hover:text-slate-900 select-none"
                    onClick={() => handleSortToggle("score")}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Score</span>
                      {sortField === "score" && (
                        <span className="text-sky-600 font-black">{sortDirection === "asc" ? "▲" : "▼"}</span>
                      )}
                    </div>
                  </th>

                  <th
                    className="py-2.5 px-3 text-right min-w-[85px] cursor-pointer hover:text-slate-900 select-none"
                    onClick={() => handleSortToggle("time")}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Time</span>
                      {sortField === "time" && (
                        <span className="text-sky-600 font-black">{sortDirection === "asc" ? "▲" : "▼"}</span>
                      )}
                    </div>
                  </th>

                  <th
                    className="py-2.5 px-3 text-center min-w-[100px] cursor-pointer hover:text-slate-900 select-none"
                    onClick={() => handleSortToggle("tabSwitchCount")}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Integrity</span>
                      {sortField === "tabSwitchCount" && (
                        <span className="text-sky-600 font-black">{sortDirection === "asc" ? "▲" : "▼"}</span>
                      )}
                    </div>
                  </th>

                  <th className="py-2.5 px-4 text-center min-w-[110px]">
                    Round 2 Gate
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedAttempts.length === 0 ? (
                  <tr>
                    <td colSpan={7 + questions.length} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <span className="text-2xl">📋</span>
                        <p className="font-semibold text-slate-600">No participants matching filter</p>
                        <p className="text-xs text-slate-400">
                          Students join via room code <span className="font-mono font-bold text-slate-700">{quiz.roomCode || "STG2-BIM"}</span>
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  sortedAttempts.map((att, index) => {
                    const attAnswers = answers.filter((a) => a.attemptId === att.id);
                    const completedCount = attAnswers.length;
                    const durationSec = getAttemptDuration(att);

                    return (
                      <tr key={att.id} className="hover:bg-slate-50/70 transition-colors group">
                        {/* Rank */}
                        <td className="py-3 px-3 text-center sticky left-0 z-10 bg-white group-hover:bg-slate-50 transition-colors">
                          <span
                            className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-bold text-xs ${
                              index === 0
                                ? "bg-amber-100 text-amber-900 border border-amber-300"
                                : index === 1
                                ? "bg-slate-200 text-slate-800"
                                : index === 2
                                ? "bg-amber-50 text-amber-800 border border-amber-200"
                                : "text-slate-500 font-medium"
                            }`}
                          >
                            {index + 1}
                          </span>
                        </td>

                        {/* Student / Squad (Sticky Left) */}
                        <td className="py-3 px-4 sticky left-12 z-10 bg-white group-hover:bg-slate-50 border-r border-slate-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] transition-colors">
                          <div className="font-bold text-slate-900 text-xs">
                            {showStudentNames ? att.userName : `Participant #${att.id.slice(0, 4)}`}
                          </div>
                          <div className="text-[10px] text-slate-400 font-medium truncate max-w-[180px]">
                            {att.collegeName || "Institution"} • {att.rollNumber || `#${att.id.slice(0, 6)}`}
                          </div>
                        </td>

                        {/* Overall Progress Bar */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-slate-200 rounded-full h-1.5 overflow-hidden min-w-[50px]">
                              <div
                                className="h-1.5 bg-emerald-500 rounded-full transition-all"
                                style={{
                                  width: `${questions.length > 0 ? (completedCount / questions.length) * 100 : 0}%`,
                                }}
                              />
                            </div>
                            <span className="font-mono text-[10px] font-bold text-slate-500 shrink-0">
                              {completedCount}/{questions.length}
                            </span>
                          </div>
                        </td>

                        {/* Complete Question Progress Indicators (All Questions) */}
                        {questions.map((q, qIndex) => {
                          const ans = attAnswers.find((a) => a.questionId === q.id);
                          const isInFlight =
                            att.status === "IN_PROGRESS" &&
                            !ans &&
                            qIndex === att.currentQuestionIndex;

                          if (ans) {
                            const letter = ans.selectedOptionIds[0]?.replace("opt", "") || "A";
                            const label = showAnswers
                              ? String.fromCharCode(64 + parseInt(letter, 10) || 65)
                              : "✓";

                            return (
                              <td key={q.id} className="py-3 px-1.5 text-center">
                                <span
                                  className={`inline-block w-6 h-6 rounded text-[11px] leading-6 font-bold text-white shadow-2xs ${
                                    ans.isCorrect ? "bg-emerald-600" : "bg-rose-600"
                                  }`}
                                  title={`Q${qIndex + 1}: ${ans.isCorrect ? "Correct" : "Incorrect"} (${ans.scoreAwarded} pts)`}
                                >
                                  {label}
                                </span>
                              </td>
                            );
                          }

                          if (isInFlight) {
                            return (
                              <td key={q.id} className="py-3 px-1.5 text-center">
                                <span
                                  className="inline-block w-6 h-6 rounded bg-sky-100 border border-sky-400 text-sky-700 text-[10px] leading-5 font-bold animate-pulse shadow-2xs"
                                  title={`Q${qIndex + 1}: Currently in progress (In Flight)`}
                                >
                                  ⏱
                                </span>
                              </td>
                            );
                          }

                          return (
                            <td key={q.id} className="py-3 px-1.5 text-center">
                              <span
                                className="inline-block w-6 h-6 rounded bg-slate-100 text-slate-400 text-[10px] leading-6 font-mono font-bold"
                                title={`Q${qIndex + 1}: Unanswered`}
                              >
                                ...
                              </span>
                            </td>
                          );
                        })}

                        {/* Score */}
                        <td className="py-3 px-4 text-right">
                          <div className="font-extrabold text-slate-900 font-mono text-xs">
                            {att.totalScore.toLocaleString()}
                          </div>
                          <div className="text-[10px] text-slate-400 font-medium">
                            {completedCount > 0 ? `${Math.round(att.totalScore / completedCount)} avg/q` : "0 pts"}
                          </div>
                        </td>

                        {/* Elapsed Time */}
                        <td className="py-3 px-3 text-right">
                          <div className="font-mono text-xs font-bold text-slate-700">
                            {formatDuration(durationSec)}
                          </div>
                          <div className="text-[10px] text-slate-400 font-medium">
                            {att.status === "COMPLETED" ? "Finished" : "Active"}
                          </div>
                        </td>

                        {/* Integrity */}
                        <td className="py-3 px-3 text-center">
                          {att.status === "DISQUALIFIED" ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                              Disqualified
                            </span>
                          ) : att.tabSwitchCount === 0 ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              • Clean
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                              {att.tabSwitchCount} Tab Blur
                            </span>
                          )}
                        </td>

                        {/* Round 2 Gate & Review Button */}
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {att.qualifiedForNextRound && (
                              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                                Qualified ✓
                              </span>
                            )}
                            <button
                              onClick={() => !isReadOnly && handleOpenReview(att.id)}
                              disabled={isReadOnly}
                              className={`px-2.5 py-1 rounded-md text-xs font-bold border transition-all shadow-2xs ${
                                isReadOnly
                                  ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60"
                                  : "bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-300 cursor-pointer hover:text-slate-900"
                              }`}
                              title={isReadOnly ? "Review is disabled for non-organizer observers" : "Review student submitted answers"}
                            >
                              Review
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer with Question-wise accuracy line matching all questions */}
          <div className="p-4 border-t border-slate-200 bg-slate-50/60 flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="text-slate-500 font-medium">
              Showing {sortedAttempts.length} of {attempts.length} active squads &bull; Sorted by{" "}
              <strong className="text-slate-800 capitalize">{sortField}</strong> ({sortDirection === "asc" ? "Ascending" : "Descending"})
            </span>

            {/* Complete Question-wise accuracy stats with horizontal scroll when needed */}
            {metrics.questionAccuracy.length > 0 && (
              <div className="flex items-center gap-2 max-w-full overflow-x-auto py-1 text-[11px] font-medium text-slate-600">
                <span className="font-bold text-slate-700 shrink-0">Class Accuracy:</span>
                {metrics.questionAccuracy.map((qa, i) => (
                  <span key={qa.questionId} className="flex items-center gap-1 shrink-0">
                    <span className="font-bold text-slate-800">Q{i + 1}:</span>
                    <span
                      className={`font-semibold ${
                        qa.accuracyRate >= 70
                          ? "text-emerald-700"
                          : qa.accuracyRate >= 40
                          ? "text-amber-700"
                          : "text-rose-700"
                      }`}
                    >
                      {qa.accuracyRate}%
                    </span>
                    {i < metrics.questionAccuracy.length - 1 && "•"}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 5. Student Answer Review Modal */}
      {selectedAttemptId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded bg-sky-100 text-sky-800 font-mono text-[10px] font-bold uppercase">
                    Student Answer Review
                  </span>
                  <span className="text-xs font-bold text-slate-500">
                    {reviewData?.quizTitle || quiz.title}
                  </span>
                </div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  {reviewData?.studentName || "Candidate Review"}
                  {reviewData?.studentTeam && (
                    <span className="text-slate-500 font-normal ml-1.5 text-xs">
                      (Team: {reviewData.studentTeam})
                    </span>
                  )}
                </h2>
                <div className="text-xs text-slate-500 flex flex-wrap items-center gap-3 mt-1 font-mono">
                  <span>{reviewData?.collegeName || "Institution"}</span>
                  {reviewData?.rollNumber && <span>• Roll: {reviewData.rollNumber}</span>}
                  <span>• Score: <strong className="text-slate-900 font-black">{reviewData?.totalScore || 0} pts</strong></span>
                  <span>• Blur flags: {reviewData?.tabSwitchCount || 0}</span>
                  {reviewData?.qualifiedForNextRound && (
                    <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                      ✓ Round 2 Qualified
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={handleCloseReview}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 flex items-center justify-center text-lg font-bold transition-colors cursor-pointer shrink-0"
                title="Close modal"
              >
                ✕
              </button>
            </div>

            {/* Modal Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
              {reviewLoading ? (
                <div className="py-16 text-center">
                  <div className="inline-block w-8 h-8 border-3 border-sky-600 border-t-transparent rounded-full animate-spin mb-3" />
                  <p className="text-xs font-bold text-slate-600">Loading student submitted answers...</p>
                </div>
              ) : reviewError ? (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs">
                  <p className="font-bold">Error loading review:</p>
                  <p className="mt-1">{reviewError}</p>
                  <button
                    type="button"
                    onClick={() => selectedAttemptId && handleOpenReview(selectedAttemptId)}
                    className="mt-3 px-3 py-1.5 bg-rose-600 text-white rounded-md text-xs font-bold hover:bg-rose-700 transition-colors"
                  >
                    Retry
                  </button>
                </div>
              ) : reviewData && reviewData.questions.length > 0 ? (
                reviewData.questions.map((q, idx) => {
                  const ans = q.studentAnswer;
                  const isAnswered = Boolean(ans);
                  const isCorrect = ans ? ans.isCorrect : false;
                  const timedOut = ans ? ans.timedOut : false;

                  return (
                    <div
                      key={q.questionId}
                      className={`p-4 rounded-xl border text-xs bg-white shadow-2xs transition-colors ${
                        isCorrect
                          ? "border-emerald-200 bg-emerald-50/20"
                          : timedOut
                          ? "border-amber-200 bg-amber-50/20"
                          : isAnswered
                          ? "border-rose-200 bg-rose-50/20"
                          : "border-slate-200 bg-slate-50/30"
                      }`}
                    >
                      {/* Question Header & Status Badge */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mb-2.5 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] font-bold font-mono flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <span className="font-bold uppercase tracking-wider text-[11px] text-slate-500">
                            {q.questionType.replace("_", " ")} &bull; {q.points} PTS
                          </span>
                        </div>

                        <div>
                          {isCorrect ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              ✓ Correct (+{ans?.scoreAwarded} pts)
                            </span>
                          ) : timedOut ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                              ⏱️ Timed Out (0 pts)
                            </span>
                          ) : isAnswered ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                              ✕ Incorrect (0 pts)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                              ⏳ Not Answered Yet
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Question Text & Code */}
                      <p className="font-bold text-slate-900 text-xs sm:text-sm leading-relaxed mb-3">
                        {q.questionText}
                      </p>

                      {q.codeSnippet && (
                        <pre className="p-2.5 bg-slate-900 text-sky-300 font-mono text-[11px] rounded-lg mb-3 overflow-x-auto">
                          <code>{q.codeSnippet}</code>
                        </pre>
                      )}

                      {/* Options Grid with student answer vs correct key */}
                      <div className="space-y-1.5 mt-2">
                        {q.options.map((opt, optIdx) => {
                          const letter = String.fromCharCode(65 + optIdx);
                          const isSelectedByStudent = ans?.selectedOptionIds.includes(opt.id);
                          const isKey = q.correctOptionIds.includes(opt.id);

                          let rowClass = "border-slate-200 bg-slate-50/60 text-slate-700";
                          if (isKey && isSelectedByStudent) {
                            rowClass = "border-emerald-300 bg-emerald-100/70 text-emerald-950 font-bold";
                          } else if (isKey) {
                            rowClass = "border-emerald-300 bg-emerald-50 text-emerald-900 font-semibold";
                          } else if (isSelectedByStudent) {
                            rowClass = "border-rose-300 bg-rose-50 text-rose-900 font-semibold";
                          }

                          return (
                            <div
                              key={opt.id}
                              className={`flex items-center justify-between gap-3 p-2 rounded-lg border text-xs transition-colors ${rowClass}`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded bg-white/90 border border-slate-300 text-slate-800 font-mono font-bold text-[10px] flex items-center justify-center shrink-0">
                                  {letter}
                                </span>
                                <span>{opt.text}</span>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0 text-[10px] font-bold font-mono">
                                {isSelectedByStudent && (
                                  <span className={`px-1.5 py-0.5 rounded uppercase ${isKey ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"}`}>
                                    Student Choice
                                  </span>
                                )}
                                {isKey && (
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-700 text-white uppercase">
                                    ✓ Correct Key
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Explanation if available */}
                      {q.explanation && (
                        <div className="mt-2.5 p-2 bg-slate-100 rounded-md text-[11px] text-slate-700 font-mono">
                          <strong className="text-slate-900">Explanation:</strong> {q.explanation}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="py-12 text-center text-slate-400">
                  <p className="font-semibold text-slate-600">No question response data found for this student.</p>
                </div>
              )}
            </div>

            {/* Modal Footer with Actions: Select and Cancel */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-500 font-medium">
                {isReadOnly ? (
                  <span className="text-amber-800 font-semibold">
                    Observer view &bull; Candidate qualification is disabled
                  </span>
                ) : (
                  <span>Click &ldquo;Select&rdquo; to qualify or shortlist this candidate for Round 2.</span>
                )}
              </div>

              <div className="flex items-center gap-2.5">
                {/* Cancel Action */}
                <button
                  type="button"
                  onClick={handleCloseReview}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                {/* Select Action (Toggles / sets candidate qualification for next round) */}
                {!isReadOnly ? (
                  <button
                    type="button"
                    disabled={isPending || !reviewData}
                    onClick={() => {
                      if (reviewData) {
                        handleToggleQualification(reviewData.attemptId, reviewData.qualifiedForNextRound);
                      }
                    }}
                    className={`px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-xs ${
                      reviewData?.qualifiedForNextRound
                        ? "bg-amber-600 hover:bg-amber-700 text-white"
                        : "bg-emerald-600 hover:bg-emerald-700 text-white"
                    }`}
                  >
                    {reviewData?.qualifiedForNextRound
                      ? "Deselect Candidate"
                      : "Select (Qualify for Round 2)"}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider bg-slate-200 text-slate-400 cursor-not-allowed"
                    title="Participant selection is disabled in view-only mode"
                  >
                    Select (Disabled)
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
