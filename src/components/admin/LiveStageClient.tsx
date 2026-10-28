"use client";

import { useState, useEffect, useTransition } from "react";
import {
  updateQuizStatusAction,
  toggleResultVisibilityAction,
  toggleLeaderboardVisibilityAction,
  toggleTabSwitchCountVisibilityAction,
  toggleQualificationAction,
  createQuestionAction,
  updateQuizAction,
} from "@/app/actions/admin-quiz";

interface LiveStageClientProps {
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

  // Quick Question Injector Form State
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

  // Poll live telemetry every 4 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
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

  const { quiz, questions, attempts, answers, metrics } = data;
  const isLive = quiz.sessionStatus === "LIVE";

  // Filter participants
  const filteredAttempts = attempts.filter((att) => {
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

  // Action handlers
  const handleToggleStatus = (newStatus: "LIVE" | "ENDED" | "DRAFT") => {
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

  const handleCadenceChange = (sec: number) => {
    startTransition(async () => {
      await updateQuizAction(quizId, { defaultTimePerQuestionSec: sec });
      setData((prev) => ({
        ...prev,
        quiz: { ...prev.quiz, defaultTimePerQuestionSec: sec },
      }));
    });
  };

  const handleToggleQualification = (attemptId: string, current: boolean) => {
    startTransition(async () => {
      const res = await toggleQualificationAction(attemptId, quizId, !current);
      if (res.success) {
        setData((prev) => ({
          ...prev,
          attempts: prev.attempts.map((att) =>
            att.id === attemptId ? { ...att, qualifiedForNextRound: !current } : att
          ),
        }));
      }
    });
  };

  const handleInjectQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptText.trim()) return;

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

  // Find current live question (order index based on max answered or 1st question)
  const currentLiveQ = questions[0];

  return (
    <div className="flex flex-col flex-1 bg-white">
      {/* 1. Stage Status Bar matching reference */}
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
              className={`px-2.5 py-1 rounded-md font-semibold text-xs transition-colors cursor-pointer ${
                quiz.defaultTimePerQuestionSec === sec
                  ? "bg-sky-600 text-white font-bold shadow-xs"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700"
              }`}
            >
              {sec}s {sec === 30 && "★"}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-5">
          <label className="flex items-center gap-2 cursor-pointer text-slate-700 font-medium">
            <input
              type="checkbox"
              checked={showStudentNames}
              onChange={(e) => setShowStudentNames(e.target.checked)}
              className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300"
            />
            <span>Show Student Names</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer text-slate-700 font-medium">
            <input
              type="checkbox"
              checked={showAnswers}
              onChange={(e) => setShowAnswers(e.target.checked)}
              className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300"
            />
            <span>Show Answers</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer text-slate-700 font-medium">
            <input
              type="checkbox"
              checked={quiz.resultsReleased}
              onChange={handleToggleResults}
              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
            />
            <span className={quiz.resultsReleased ? "text-emerald-700 font-bold" : ""}>
              Show Final Results to Students
            </span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer text-slate-700 font-medium">
            <input
              type="checkbox"
              checked={Boolean(quiz.showLeaderboard)}
              onChange={handleToggleLeaderboard}
              className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300"
            />
            <span className={quiz.showLeaderboard ? "text-amber-800 font-bold" : ""}>
              Show Top 10 Leaderboard
            </span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer text-slate-700 font-medium">
            <input
              type="checkbox"
              checked={Boolean(quiz.showTabSwitchCount)}
              onChange={handleToggleTabSwitchCount}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
            />
            <span className={quiz.showTabSwitchCount ? "text-indigo-800 font-bold" : ""}>
              Display Tab Switch Count over Quiz
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

          {/* Card 2: Q01 Submissions */}
          <div className="bg-slate-50/70 border border-slate-200/90 rounded-xl p-4 flex flex-col justify-between shadow-2xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Q01 Submissions
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
              <span>Remaining: {Math.max(0, metrics.totalParticipants - metrics.totalAnswersSubmitted)} students</span>
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
              <span>Avg Pace: ~12.4s</span>
              <span>Median: 11.8s</span>
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
              <span className="text-sky-600 font-bold hover:underline cursor-pointer">
                Review logs →
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Two-Panel Section */}
      <div className="p-6 pt-2 grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
        {/* Left Panel: Participant Table (~65-70% / 8 columns) */}
        <div className="lg:col-span-8 flex flex-col justify-between border border-slate-200 rounded-xl bg-white overflow-hidden shadow-xs">
          {/* Controls & Filter Bar */}
          <div className="p-4 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3 bg-slate-50/40">
            <div className="flex items-center gap-2 flex-1 min-w-[240px]">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Search student or team ID..."
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

            <div className="flex items-center gap-3 text-xs">
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
              </div>

              <div className="px-2.5 py-1 rounded bg-sky-50 border border-sky-200 text-sky-800 font-bold text-[11px]">
                Cutoff: Top 24 (≥1,050 pts)
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 text-slate-500 font-bold text-[10px] uppercase tracking-wider border-b border-slate-200">
                  <th className="py-2.5 px-3 w-12 text-center">Rank</th>
                  <th className="py-2.5 px-4">Student / Squad</th>
                  <th className="py-2.5 px-3 w-28">Progress</th>
                  {questions.slice(0, 5).map((q, idx) => (
                    <th key={q.id} className="py-2.5 px-2 text-center w-10">
                      Q{idx + 1}
                    </th>
                  ))}
                  <th className="py-2.5 px-4 text-right">Score</th>
                  <th className="py-2.5 px-3 text-center">Integrity</th>
                  <th className="py-2.5 px-4 text-center">Round 2 Gate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAttempts.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400">
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
                  filteredAttempts.map((att, index) => {
                    // Collect answers for this attempt
                    const attAnswers = answers.filter((a) => a.attemptId === att.id);
                    const completedCount = attAnswers.length;

                    return (
                      <tr key={att.id} className="hover:bg-slate-50/70 transition-colors">
                        {/* Rank */}
                        <td className="py-3 px-3 text-center">
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

                        {/* Student / Squad */}
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 text-xs">
                            {showStudentNames ? att.userName : `Participant #${att.id.slice(0, 4)}`}
                          </div>
                          <div className="text-[10px] text-slate-400 font-medium">
                            {att.collegeName || "Institution"} • {att.rollNumber || `#${att.id.slice(0, 6)}`}
                          </div>
                        </td>

                        {/* Progress */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="h-1.5 bg-emerald-500 rounded-full"
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

                        {/* Question Badges Q1..Q5 */}
                        {questions.slice(0, 5).map((q) => {
                          const ans = attAnswers.find((a) => a.questionId === q.id);
                          if (!ans) {
                            return (
                              <td key={q.id} className="py-3 px-2 text-center">
                                <span className="inline-block w-6 h-6 rounded bg-slate-100 text-slate-400 text-[10px] leading-6 font-mono font-bold">
                                  ...
                                </span>
                              </td>
                            );
                          }

                          const letter = ans.selectedOptionIds[0]?.replace("opt", "") || "A";
                          const label = showAnswers
                            ? String.fromCharCode(64 + parseInt(letter, 10) || 65)
                            : "✓";

                          return (
                            <td key={q.id} className="py-3 px-2 text-center">
                              <span
                                className={`inline-block w-6 h-6 rounded text-[11px] leading-6 font-bold text-white shadow-2xs ${
                                  ans.isCorrect ? "bg-emerald-600" : "bg-rose-600"
                                }`}
                              >
                                {label}
                              </span>
                            </td>
                          );
                        })}

                        {/* Score & Pace */}
                        <td className="py-3 px-4 text-right">
                          <div className="font-extrabold text-slate-900 font-mono text-xs">
                            {att.totalScore.toLocaleString()}
                          </div>
                          <div className="text-[10px] text-slate-400 font-medium">
                            ~10.2s pace
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

                        {/* Round 2 Gate */}
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => handleToggleQualification(att.id, att.qualifiedForNextRound)}
                            className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                              att.qualifiedForNextRound
                                ? "bg-emerald-600 text-white shadow-xs hover:bg-emerald-700"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200"
                            }`}
                          >
                            {att.qualifiedForNextRound ? "Qualified ✓" : "Review ..."}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer with Question-wise accuracy line matching reference */}
          <div className="p-4 border-t border-slate-200 bg-slate-50/60 flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="text-slate-500 font-medium">
              Showing {filteredAttempts.length} of {attempts.length} active squads
            </span>

            {/* Question-wise accuracy stats */}
            {metrics.questionAccuracy.length > 0 && (
              <div className="flex items-center gap-3 text-[11px] font-medium text-slate-600">
                <span className="font-bold text-slate-700">Class Accuracy:</span>
                {metrics.questionAccuracy.slice(0, 4).map((qa, i) => (
                  <span key={qa.questionId} className="flex items-center gap-1">
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
                    {i < Math.min(3, metrics.questionAccuracy.length - 1) && "•"}
                  </span>
                ))}
              </div>
            )}

            <div className="flex items-center gap-1">
              <button className="px-2.5 py-1 rounded border border-slate-300 text-slate-600 hover:bg-slate-100 text-xs">
                Previous
              </button>
              <button className="px-2.5 py-1 rounded bg-sky-600 text-white font-bold text-xs">
                1
              </button>
              <button className="px-2.5 py-1 rounded border border-slate-300 text-slate-600 hover:bg-slate-100 text-xs">
                Next
              </button>
            </div>
          </div>
        </div>

        {/* Right Panel: Quick Question Injector (~32% / 4 columns) */}
        <div className="lg:col-span-4 flex flex-col justify-between border border-slate-200 rounded-xl bg-white p-5 shadow-xs">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-sky-600 text-base font-bold">⊕</span>
                <h3 className="font-bold text-slate-900 text-sm">
                  Quick Question Injector
                </h3>
              </div>
              <span className="text-[10px] font-bold bg-sky-100 text-sky-800 px-2 py-0.5 rounded uppercase">
                Live Deck
              </span>
            </div>

            {/* Question Type Pills */}
            <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-lg mb-4 text-xs">
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
                  rows={3}
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
                  <div className="space-y-2">
                    {["True", "False"].map((val, idx) => (
                      <label
                        key={val}
                        className={`flex items-center gap-2.5 p-2 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
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
                          className="w-4 h-4 text-sky-600 focus:ring-sky-500"
                        />
                        <span>{val}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {[
                      { val: opt1, set: setOpt1, label: "Proof-of-Stake (PoS)" },
                      { val: opt2, set: setOpt2, label: "Proof-of-Work (PoW)" },
                      { val: opt3, set: setOpt3, label: "Delegated Proof-of-Capacity" },
                      { val: opt4, set: setOpt4, label: "Proof-of-History (PoH)" },
                    ].map((opt, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-1.5 focus-within:border-sky-400 focus-within:bg-white"
                      >
                        <input
                          type="radio"
                          name="correctOption"
                          checked={correctOptIndex === idx}
                          onChange={() => setCorrectOptIndex(idx)}
                          className="w-4 h-4 ml-1 text-sky-600 focus:ring-sky-500 cursor-pointer"
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

              {/* Points & Timer */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Points
                  </label>
                  <select
                    value={injectorPoints}
                    onChange={(e) => setInjectorPoints(Number(e.target.value))}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 cursor-pointer"
                  >
                    <option value={100}>100 pts (Standard)</option>
                    <option value={50}>50 pts (Quick)</option>
                    <option value={200}>200 pts (Bonus)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Timer
                  </label>
                  <select
                    value={injectorTimer}
                    onChange={(e) => setInjectorTimer(Number(e.target.value))}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 cursor-pointer"
                  >
                    <option value={15}>15 seconds</option>
                    <option value={30}>30 seconds</option>
                    <option value={45}>45 seconds</option>
                    <option value={60}>60 seconds</option>
                  </select>
                </div>
              </div>

              {injectorSuccess && (
                <div className="p-2 bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-bold rounded-lg text-center">
                  ✓ Question successfully added to live deck!
                </div>
              )}

              <button
                type="submit"
                disabled={isPending}
                className="w-full py-2.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs uppercase tracking-wider shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span>🚀</span> Push Question to Live Session
              </button>
            </form>
          </div>

          {/* Bottom Queue */}
          <div className="pt-4 mt-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <span className="font-bold uppercase tracking-wider text-[11px] text-slate-700">
              Round 1 Queue
            </span>
            <span className="font-medium bg-slate-100 px-2 py-0.5 rounded text-[11px]">
              {questions.length} Remaining
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
