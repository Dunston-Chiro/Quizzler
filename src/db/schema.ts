import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  pgEnum,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// -----------------------------------------------------------------------------
// PostgreSQL Enums
// -----------------------------------------------------------------------------

export const userRoleEnum = pgEnum("user_role", [
  "PARTICIPANT",
  "ADMIN",
  "SUPER_ADMIN",
]);

export const quizSessionStatusEnum = pgEnum("quiz_session_status", [
  "DRAFT",
  "SCHEDULED",
  "LIVE",
  "ENDED",
]);

export const attemptStatusEnum = pgEnum("attempt_status", [
  "IN_PROGRESS",
  "COMPLETED",
  "DISQUALIFIED",
]);

export const proctorEventTypeEnum = pgEnum("proctor_event_type", [
  "TAB_SWITCH",
  "WINDOW_BLUR",
  "FULLSCREEN_EXIT",
]);

// -----------------------------------------------------------------------------
// 1. Users Table
// -----------------------------------------------------------------------------
export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teamName: varchar("team_name", { length: 150 }),
    name: varchar("name", { length: 100 }).notNull(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    role: userRoleEnum("role").default("PARTICIPANT").notNull(),
    collegeName: varchar("college_name", { length: 150 }),
    rollNumber: varchar("roll_number", { length: 50 }),
    isActive: boolean("is_active").default(true).notNull(),
    isBlocked: boolean("is_blocked").default(false).notNull(),
    blockedReason: text("blocked_reason"),
    blockedAt: timestamp("blocked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("users_email_idx").on(table.email),
    index("users_role_idx").on(table.role),
  ]
);

// -----------------------------------------------------------------------------
// 2. Quizzes Table
// -----------------------------------------------------------------------------
export const quizzes = pgTable(
  "quizzes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    roomCode: varchar("room_code", { length: 32 }),
    createdBy: uuid("created_by")
      .references(() => users.id)
      .notNull(),
    sessionStatus: quizSessionStatusEnum("session_status")
      .default("DRAFT")
      .notNull(),
    resultsReleased: boolean("results_released").default(false).notNull(),
    showLeaderboard: boolean("show_leaderboard").default(false).notNull(),
    showTabSwitchCount: boolean("show_tab_switch_count").default(false).notNull(),
    isSharedWithAdmins: boolean("is_shared_with_admins").default(false).notNull(),
    defaultTimePerQuestionSec: integer("default_time_per_question_sec")
      .default(30)
      .notNull(),
    shuffleQuestions: boolean("shuffle_questions").default(false).notNull(),
    totalQuestions: integer("total_questions").default(0).notNull(),
    totalPoints: integer("total_points").default(0).notNull(),
    scheduledStartTime: timestamp("scheduled_start_time", {
      withTimezone: true,
    }),
    scheduledEndTime: timestamp("scheduled_end_time", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("quizzes_status_idx").on(table.sessionStatus),
    index("quizzes_creator_idx").on(table.createdBy),
    uniqueIndex("quizzes_room_code_idx").on(table.roomCode),
  ]
);

// -----------------------------------------------------------------------------
// 3. Questions Table
// -----------------------------------------------------------------------------
export const questions = pgTable(
  "questions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    quizId: uuid("quiz_id")
      .references(() => quizzes.id, { onDelete: "cascade" })
      .notNull(),
    createdBy: uuid("created_by")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    questionType: varchar("question_type", { length: 30 })
      .default("MULTIPLE_CHOICE")
      .notNull(),
    questionText: text("question_text").notNull(),
    codeSnippet: text("code_snippet"),
    mediaUrl: text("media_url"),
    options: jsonb("options")
      .$type<Array<{ id: string; text: string }>>()
      .notNull(),
    correctOptionIds: jsonb("correct_option_ids").$type<string[]>().notNull(),
    explanation: text("explanation"),
    points: integer("points").default(10).notNull(),
    timeLimitSeconds: integer("time_limit_seconds").default(30).notNull(),
    orderIndex: integer("order_index").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("questions_quiz_order_idx").on(table.quizId, table.orderIndex),
    index("questions_creator_idx").on(table.createdBy),
  ]
);

// -----------------------------------------------------------------------------
// 4. Participant Attempts Table
// -----------------------------------------------------------------------------
export const participantAttempts = pgTable(
  "participant_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    quizId: uuid("quiz_id")
      .references(() => quizzes.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    currentQuestionIndex: integer("current_question_index")
      .default(0)
      .notNull(),
    currentQuestionStartedAt: timestamp("current_question_started_at", {
      withTimezone: true,
    }),
    questionOrder: jsonb("question_order").$type<string[]>(),
    totalScore: integer("total_score").default(0).notNull(),
    tabSwitchCount: integer("tab_switch_count").default(0).notNull(),
    status: attemptStatusEnum("status").default("IN_PROGRESS").notNull(),
    qualifiedForNextRound: boolean("qualified_for_next_round")
      .default(false)
      .notNull(),
    startedAt: timestamp("started_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("attempts_quiz_user_idx").on(table.quizId, table.userId),
    index("attempts_status_idx").on(table.status),
  ]
);

// -----------------------------------------------------------------------------
// 5. Participant Answers Table
// -----------------------------------------------------------------------------
export const participantAnswers = pgTable(
  "participant_answers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    attemptId: uuid("attempt_id")
      .references(() => participantAttempts.id, { onDelete: "cascade" })
      .notNull(),
    questionId: uuid("question_id")
      .references(() => questions.id, { onDelete: "cascade" })
      .notNull(),
    selectedOptionIds: jsonb("selected_option_ids")
      .$type<string[]>()
      .notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull(),
    isCorrect: boolean("is_correct").default(false).notNull(),
    scoreAwarded: integer("score_awarded").default(0).notNull(),
    timedOut: boolean("timed_out").default(false).notNull(),
  },
  (table) => [
    uniqueIndex("answers_attempt_question_idx").on(
      table.attemptId,
      table.questionId
    ),
  ]
);

// -----------------------------------------------------------------------------
// 6. Proctoring Events Table
// -----------------------------------------------------------------------------
export const proctoringEvents = pgTable(
  "proctoring_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    attemptId: uuid("attempt_id")
      .references(() => participantAttempts.id, { onDelete: "cascade" })
      .notNull(),
    quizId: uuid("quiz_id")
      .references(() => quizzes.id)
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    eventType: proctorEventTypeEnum("event_type").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("proctor_attempt_idx").on(table.attemptId),
    index("proctor_quiz_idx").on(table.quizId),
  ]
);

// -----------------------------------------------------------------------------
// 7. Audit Logs Table
// -----------------------------------------------------------------------------
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorId: uuid("actor_id").references(() => users.id, {
      onDelete: "set null",
    }),
    actorRole: varchar("actor_role", { length: 20 }).notNull(),
    action: varchar("action", { length: 100 }).notNull(),
    category: varchar("category", { length: 50 }).default("SYSTEM").notNull(),
    targetEntity: varchar("target_entity", { length: 100 }).notNull(),
    targetId: varchar("target_id", { length: 100 }),
    targetLabel: varchar("target_label", { length: 255 }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    payloadBefore: jsonb("payload_before").$type<Record<string, unknown>>(),
    payloadAfter: jsonb("payload_after").$type<Record<string, unknown>>(),
    ipAddress: varchar("ip_address", { length: 50 }),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("audit_actor_idx").on(table.actorId),
    index("audit_action_idx").on(table.action),
    index("audit_created_at_idx").on(table.createdAt),
    index("audit_category_idx").on(table.category),
  ]
);

// -----------------------------------------------------------------------------
// Drizzle Relations
// -----------------------------------------------------------------------------

export const usersRelations = relations(users, ({ many }) => ({
  quizzes: many(quizzes),
  questions: many(questions),
  attempts: many(participantAttempts),
  auditLogs: many(auditLogs),
}));

export const quizzesRelations = relations(quizzes, ({ one, many }) => ({
  author: one(users, {
    fields: [quizzes.createdBy],
    references: [users.id],
  }),
  questions: many(questions),
  attempts: many(participantAttempts),
}));

export const questionsRelations = relations(questions, ({ one }) => ({
  quiz: one(quizzes, {
    fields: [questions.quizId],
    references: [quizzes.id],
  }),
  author: one(users, {
    fields: [questions.createdBy],
    references: [users.id],
  }),
}));

export const participantAttemptsRelations = relations(
  participantAttempts,
  ({ one, many }) => ({
    quiz: one(quizzes, {
      fields: [participantAttempts.quizId],
      references: [quizzes.id],
    }),
    user: one(users, {
      fields: [participantAttempts.userId],
      references: [users.id],
    }),
    answers: many(participantAnswers),
    proctoringEvents: many(proctoringEvents),
  })
);

export const participantAnswersRelations = relations(
  participantAnswers,
  ({ one }) => ({
    attempt: one(participantAttempts, {
      fields: [participantAnswers.attemptId],
      references: [participantAttempts.id],
    }),
    question: one(questions, {
      fields: [participantAnswers.questionId],
      references: [questions.id],
    }),
  })
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Quiz = typeof quizzes.$inferSelect;
export type Question = typeof questions.$inferSelect;
export type ParticipantAttempt = typeof participantAttempts.$inferSelect;
export type ParticipantAnswer = typeof participantAnswers.$inferSelect;
export type ProctoringEvent = typeof proctoringEvents.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
