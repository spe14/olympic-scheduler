DROP TABLE "conflict" CASCADE;--> statement-breakpoint
DROP TABLE "viable_config" CASCADE;--> statement-breakpoint
DROP TABLE "viable_config_member" CASCADE;--> statement-breakpoint
ALTER TABLE "groups" ALTER COLUMN "phase" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "groups" ALTER COLUMN "phase" SET DEFAULT 'preferences'::text;--> statement-breakpoint
UPDATE "groups" SET "phase" = 'schedule_review' WHERE "phase" = 'conflict_resolution';--> statement-breakpoint
DROP TYPE "public"."group_phase_enum";--> statement-breakpoint
CREATE TYPE "public"."group_phase_enum" AS ENUM('preferences', 'schedule_review', 'completed');--> statement-breakpoint
ALTER TABLE "groups" ALTER COLUMN "phase" SET DEFAULT 'preferences'::"public"."group_phase_enum";--> statement-breakpoint
ALTER TABLE "groups" ALTER COLUMN "phase" SET DATA TYPE "public"."group_phase_enum" USING "phase"::"public"."group_phase_enum";--> statement-breakpoint
ALTER TABLE "member" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "member" ALTER COLUMN "status" SET DEFAULT 'pending_approval'::text;--> statement-breakpoint
UPDATE "member" SET "status" = 'schedule_review_pending' WHERE "status" = 'conflict_resolution_pending';--> statement-breakpoint
UPDATE "member" SET "status" = 'schedule_review_confirmed' WHERE "status" = 'conflict_resolution_confirmed';--> statement-breakpoint
DROP TYPE "public"."member_status_enum";--> statement-breakpoint
CREATE TYPE "public"."member_status_enum" AS ENUM('pending_approval', 'denied', 'joined', 'preferences_set', 'schedule_review_pending', 'schedule_review_confirmed');--> statement-breakpoint
ALTER TABLE "member" ALTER COLUMN "status" SET DEFAULT 'pending_approval'::"public"."member_status_enum";--> statement-breakpoint
ALTER TABLE "member" ALTER COLUMN "status" SET DATA TYPE "public"."member_status_enum" USING "status"::"public"."member_status_enum";--> statement-breakpoint
ALTER TABLE "member" ALTER COLUMN "preference_step" SET DATA TYPE text;--> statement-breakpoint
UPDATE "member" SET "preference_step" = 'buddies' WHERE "preference_step" = 'buddies_budget';--> statement-breakpoint
DROP TYPE "public"."preference_step_enum";--> statement-breakpoint
CREATE TYPE "public"."preference_step_enum" AS ENUM('buddies', 'sport_rankings', 'sessions');--> statement-breakpoint
ALTER TABLE "member" ALTER COLUMN "preference_step" SET DATA TYPE "public"."preference_step_enum" USING "preference_step"::"public"."preference_step_enum";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "budget" real;--> statement-breakpoint
UPDATE "users" SET "budget" = sub.budget FROM (SELECT DISTINCT ON (user_id) user_id, budget FROM "member" WHERE budget IS NOT NULL ORDER BY user_id, created_at DESC) sub WHERE "users".id = sub.user_id;--> statement-breakpoint
ALTER TABLE "member" DROP COLUMN "budget";--> statement-breakpoint
ALTER TABLE "session_preference" DROP COLUMN "max_willingness";--> statement-breakpoint
DROP TYPE "public"."conflict_type_enum";