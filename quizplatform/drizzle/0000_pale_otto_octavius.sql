CREATE TYPE "public"."attempt_status" AS ENUM('IN_PROGRESS', 'COMPLETED', 'DISQUALIFIED');--> statement-breakpoint
CREATE TYPE "public"."proctor_event_type" AS ENUM('TAB_SWITCH', 'WINDOW_BLUR', 'FULLSCREEN_EXIT');--> statement-breakpoint
CREATE TYPE "public"."quiz_session_status" AS ENUM('DRAFT', 'SCHEDULED', 'LIVE', 'ENDED');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('PARTICIPANT', 'ADMIN', 'SUPER_ADMIN');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid NOT NULL,
	"actor_role" varchar(20) NOT NULL,
	"action" varchar(100) NOT NULL,
	"target_entity" varchar(100) NOT NULL,
	"target_id" varchar(100),
	"payload_before" jsonb,
	"payload_after" jsonb,
	"ip_address" varchar(50),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "participant_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"selected_option_ids" jsonb NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"submitted_at" timestamp with time zone NOT NULL,
	"is_correct" boolean DEFAULT false NOT NULL,
	"score_awarded" integer DEFAULT 0 NOT NULL,
	"timed_out" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "participant_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quiz_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"current_question_index" integer DEFAULT 0 NOT NULL,
	"current_question_started_at" timestamp with time zone,
	"total_score" integer DEFAULT 0 NOT NULL,
	"tab_switch_count" integer DEFAULT 0 NOT NULL,
	"status" "attempt_status" DEFAULT 'IN_PROGRESS' NOT NULL,
	"qualified_for_next_round" boolean DEFAULT false NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "proctoring_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"quiz_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"event_type" "proctor_event_type" NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quiz_id" uuid NOT NULL,
	"question_text" text NOT NULL,
	"code_snippet" text,
	"media_url" text,
	"options" jsonb NOT NULL,
	"correct_option_ids" jsonb NOT NULL,
	"explanation" text,
	"points" integer DEFAULT 10 NOT NULL,
	"time_limit_seconds" integer DEFAULT 30 NOT NULL,
	"order_index" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quizzes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"created_by" uuid NOT NULL,
	"session_status" "quiz_session_status" DEFAULT 'DRAFT' NOT NULL,
	"results_released" boolean DEFAULT false NOT NULL,
	"default_time_per_question_sec" integer DEFAULT 30 NOT NULL,
	"shuffle_questions" boolean DEFAULT false NOT NULL,
	"total_questions" integer DEFAULT 0 NOT NULL,
	"total_points" integer DEFAULT 0 NOT NULL,
	"scheduled_start_time" timestamp with time zone,
	"scheduled_end_time" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'PARTICIPANT' NOT NULL,
	"college_name" varchar(150),
	"roll_number" varchar(50),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_answers" ADD CONSTRAINT "participant_answers_attempt_id_participant_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."participant_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_answers" ADD CONSTRAINT "participant_answers_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_attempts" ADD CONSTRAINT "participant_attempts_quiz_id_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_attempts" ADD CONSTRAINT "participant_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proctoring_events" ADD CONSTRAINT "proctoring_events_attempt_id_participant_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."participant_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proctoring_events" ADD CONSTRAINT "proctoring_events_quiz_id_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proctoring_events" ADD CONSTRAINT "proctoring_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_quiz_id_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_actor_idx" ON "audit_logs" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "audit_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE UNIQUE INDEX "answers_attempt_question_idx" ON "participant_answers" USING btree ("attempt_id","question_id");--> statement-breakpoint
CREATE INDEX "attempts_quiz_user_idx" ON "participant_attempts" USING btree ("quiz_id","user_id");--> statement-breakpoint
CREATE INDEX "attempts_status_idx" ON "participant_attempts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "proctor_attempt_idx" ON "proctoring_events" USING btree ("attempt_id");--> statement-breakpoint
CREATE INDEX "proctor_quiz_idx" ON "proctoring_events" USING btree ("quiz_id");--> statement-breakpoint
CREATE INDEX "questions_quiz_order_idx" ON "questions" USING btree ("quiz_id","order_index");--> statement-breakpoint
CREATE INDEX "quizzes_status_idx" ON "quizzes" USING btree ("session_status");--> statement-breakpoint
CREATE INDEX "quizzes_creator_idx" ON "quizzes" USING btree ("created_by");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");