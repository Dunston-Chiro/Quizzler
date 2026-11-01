CREATE TYPE "public"."quiz_access_request_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TABLE "quiz_access_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quiz_id" uuid NOT NULL,
	"requesting_admin_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"status" "quiz_access_request_status" DEFAULT 'PENDING' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone,
	"responded_by" uuid
);
--> statement-breakpoint
ALTER TABLE "quizzes" ADD COLUMN "show_in_arena" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "quiz_access_requests" ADD CONSTRAINT "quiz_access_requests_quiz_id_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_access_requests" ADD CONSTRAINT "quiz_access_requests_requesting_admin_id_users_id_fk" FOREIGN KEY ("requesting_admin_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_access_requests" ADD CONSTRAINT "quiz_access_requests_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_access_requests" ADD CONSTRAINT "quiz_access_requests_responded_by_users_id_fk" FOREIGN KEY ("responded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "quiz_access_requests_quiz_admin_idx" ON "quiz_access_requests" USING btree ("quiz_id","requesting_admin_id");--> statement-breakpoint
CREATE INDEX "quiz_access_requests_owner_status_idx" ON "quiz_access_requests" USING btree ("owner_id","status");