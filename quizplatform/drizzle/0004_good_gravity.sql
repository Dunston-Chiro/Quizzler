ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_actor_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "audit_logs" ALTER COLUMN "actor_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "category" varchar(50) DEFAULT 'SYSTEM' NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "target_label" varchar(255);--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "user_agent" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_blocked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "blocked_reason" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "blocked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_created_at_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_category_idx" ON "audit_logs" USING btree ("category");