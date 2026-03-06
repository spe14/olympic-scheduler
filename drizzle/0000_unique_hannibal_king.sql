CREATE TYPE "public"."buddy_type_enum" AS ENUM('hard', 'soft');--> statement-breakpoint
CREATE TYPE "public"."combo_rank_enum" AS ENUM('primary', 'backup1', 'backup2');--> statement-breakpoint
CREATE TYPE "public"."conflict_type_enum" AS ENUM('min_buddies_failure', 'hard_buddy_failure');--> statement-breakpoint
CREATE TYPE "public"."date_mode_enum" AS ENUM('consecutive', 'specific');--> statement-breakpoint
CREATE TYPE "public"."group_phase_enum" AS ENUM('preferences', 'schedule_review', 'conflict_resolution', 'completed');--> statement-breakpoint
CREATE TYPE "public"."interest_enum" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."member_role_enum" AS ENUM('owner', 'member');--> statement-breakpoint
CREATE TYPE "public"."member_status_enum" AS ENUM('pending_approval', 'joined', 'preferences_set', 'schedule_review_pending', 'schedule_review_confirmed', 'conflict_resolution_pending', 'conflict_resolution_confirmed');--> statement-breakpoint
CREATE TYPE "public"."preference_step_enum" AS ENUM('buddies_budget', 'sport_rankings', 'sessions');--> statement-breakpoint
CREATE TYPE "public"."session_type_enum" AS ENUM('Final', 'Semifinal', 'Quarterfinal', 'Preliminary', 'Bronze');--> statement-breakpoint
CREATE TYPE "public"."zone_enum" AS ENUM('Valley Zone', 'Carson Zone', 'DTLA Zone', 'Long Beach Zone', 'Exposition Park Zone', 'Venice Zone', 'Inglewood Zone', 'Pomona Zone', 'City of Industry Zone', 'Pasadena Zone', 'Arcadia Zone', 'Riviera Zone', 'Port of Los Angeles Zone', 'Whittier Narrows Zone', 'Universal City Zone', 'Trestles Beach Zone', 'Anaheim Zone');--> statement-breakpoint
CREATE TABLE "buddy_constraint" (
	"member_id" uuid NOT NULL,
	"buddy_id" uuid NOT NULL,
	"type" "buddy_type_enum" NOT NULL,
	CONSTRAINT "buddy_constraint_member_id_buddy_id_pk" PRIMARY KEY("member_id","buddy_id")
);
--> statement-breakpoint
CREATE TABLE "combo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"day" date NOT NULL,
	"rank" "combo_rank_enum" NOT NULL,
	"score" real NOT NULL
);
--> statement-breakpoint
CREATE TABLE "combo_session" (
	"combo_id" uuid NOT NULL,
	"session_id" text NOT NULL,
	CONSTRAINT "combo_session_combo_id_session_id_pk" PRIMARY KEY("combo_id","session_id")
);
--> statement-breakpoint
CREATE TABLE "conflict" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"session_id" text NOT NULL,
	"affected_member_id" uuid NOT NULL,
	"causing_member_id" uuid,
	"min_price" integer NOT NULL,
	"max_price" integer,
	"type" "conflict_type_enum" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"phase" "group_phase_enum" DEFAULT 'preferences' NOT NULL,
	"invite_code" text NOT NULL,
	"date_mode" date_mode_enum,
	"consecutive_days" integer,
	"start_date" date,
	"end_date" date,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "groups_invite_code_unique" UNIQUE("invite_code")
);
--> statement-breakpoint
CREATE TABLE "member" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"role" "member_role_enum" DEFAULT 'member' NOT NULL,
	"budget" real,
	"min_buddies" integer DEFAULT 0 NOT NULL,
	"sport_rankings" jsonb,
	"status" "member_status_enum" DEFAULT 'pending_approval' NOT NULL,
	"preference_step" "preference_step_enum",
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "member_user_id_group_id_unique" UNIQUE("user_id","group_id")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"session_code" text PRIMARY KEY NOT NULL,
	"sport" text NOT NULL,
	"venue" text NOT NULL,
	"zone" "zone_enum" NOT NULL,
	"session_date" date NOT NULL,
	"session_type" "session_type_enum" NOT NULL,
	"session_description" text,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_preference" (
	"session_id" text NOT NULL,
	"member_id" uuid NOT NULL,
	"interest" "interest_enum" NOT NULL,
	"max_willingness" integer,
	"hard_buddy_override" boolean DEFAULT false NOT NULL,
	"min_buddy_override" boolean DEFAULT false NOT NULL,
	"excluded" boolean DEFAULT false NOT NULL,
	CONSTRAINT "session_preference_session_id_member_id_pk" PRIMARY KEY("session_id","member_id")
);
--> statement-breakpoint
CREATE TABLE "travel_time" (
	"origin_zone" "zone_enum" NOT NULL,
	"destination_zone" "zone_enum" NOT NULL,
	"driving_minutes" real NOT NULL,
	"transit_minutes" real,
	CONSTRAINT "travel_time_origin_zone_destination_zone_pk" PRIMARY KEY("origin_zone","destination_zone")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_id" text NOT NULL,
	"email" text NOT NULL,
	"username" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_auth_id_unique" UNIQUE("auth_id"),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "viable_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"session_id" text NOT NULL,
	"min_price" integer NOT NULL,
	"max_price" integer
);
--> statement-breakpoint
CREATE TABLE "viable_config_member" (
	"viable_config_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	CONSTRAINT "viable_config_member_viable_config_id_member_id_pk" PRIMARY KEY("viable_config_id","member_id")
);
--> statement-breakpoint
CREATE TABLE "window_ranking" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"score" real NOT NULL,
	"selected" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "buddy_constraint" ADD CONSTRAINT "buddy_constraint_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buddy_constraint" ADD CONSTRAINT "buddy_constraint_buddy_id_member_id_fk" FOREIGN KEY ("buddy_id") REFERENCES "public"."member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "combo" ADD CONSTRAINT "combo_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "combo" ADD CONSTRAINT "combo_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "combo_session" ADD CONSTRAINT "combo_session_combo_id_combo_id_fk" FOREIGN KEY ("combo_id") REFERENCES "public"."combo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "combo_session" ADD CONSTRAINT "combo_session_session_id_session_session_code_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session"("session_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conflict" ADD CONSTRAINT "conflict_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conflict" ADD CONSTRAINT "conflict_session_id_session_session_code_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session"("session_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conflict" ADD CONSTRAINT "conflict_affected_member_id_member_id_fk" FOREIGN KEY ("affected_member_id") REFERENCES "public"."member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conflict" ADD CONSTRAINT "conflict_causing_member_id_member_id_fk" FOREIGN KEY ("causing_member_id") REFERENCES "public"."member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_preference" ADD CONSTRAINT "session_preference_session_id_session_session_code_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session"("session_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_preference" ADD CONSTRAINT "session_preference_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viable_config" ADD CONSTRAINT "viable_config_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viable_config" ADD CONSTRAINT "viable_config_session_id_session_session_code_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session"("session_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viable_config_member" ADD CONSTRAINT "viable_config_member_viable_config_id_viable_config_id_fk" FOREIGN KEY ("viable_config_id") REFERENCES "public"."viable_config"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viable_config_member" ADD CONSTRAINT "viable_config_member_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "window_ranking" ADD CONSTRAINT "window_ranking_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;