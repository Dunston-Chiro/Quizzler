ALTER TABLE "participant_attempts" ADD COLUMN "question_order" jsonb;--> statement-breakpoint
ALTER TABLE "quizzes" ADD COLUMN "show_leaderboard" boolean DEFAULT false NOT NULL;