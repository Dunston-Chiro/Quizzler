ALTER TABLE "questions" ADD COLUMN "created_by" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "question_type" varchar(30) DEFAULT 'MULTIPLE_CHOICE' NOT NULL;--> statement-breakpoint
ALTER TABLE "quizzes" ADD COLUMN "room_code" varchar(32);--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "questions_creator_idx" ON "questions" USING btree ("created_by");--> statement-breakpoint
CREATE UNIQUE INDEX "quizzes_room_code_idx" ON "quizzes" USING btree ("room_code");