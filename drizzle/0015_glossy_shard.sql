CREATE TYPE "public"."purchase_timeslot_status_enum" AS ENUM('upcoming', 'in_progress', 'completed');--> statement-breakpoint
CREATE TABLE "out_of_budget_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"session_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "out_of_budget_session_member_id_session_id_unique" UNIQUE("member_id","session_id")
);
--> statement-breakpoint
CREATE TABLE "purchase_plan_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"session_id" text NOT NULL,
	"assignee_member_id" uuid NOT NULL,
	"price_ceiling" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_plan_entry_member_id_session_id_assignee_member_id_unique" UNIQUE("member_id","session_id","assignee_member_id")
);
--> statement-breakpoint
CREATE TABLE "purchase_timeslot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"timeslot_start" timestamp NOT NULL,
	"timeslot_end" timestamp NOT NULL,
	"status" "purchase_timeslot_status_enum" DEFAULT 'upcoming' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_timeslot_member_id_group_id_unique" UNIQUE("member_id","group_id")
);
--> statement-breakpoint
CREATE TABLE "reported_price" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"session_id" text NOT NULL,
	"reported_by_member_id" uuid NOT NULL,
	"price" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "reported_price_group_id_session_id_reported_by_member_id_unique" UNIQUE("group_id","session_id","reported_by_member_id")
);
--> statement-breakpoint
CREATE TABLE "sold_out_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"session_id" text NOT NULL,
	"reported_by_member_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sold_out_session_group_id_session_id_unique" UNIQUE("group_id","session_id")
);
--> statement-breakpoint
CREATE TABLE "ticket_purchase" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"session_id" text NOT NULL,
	"purchased_by_member_id" uuid NOT NULL,
	"price_per_ticket" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_purchase_assignee" (
	"ticket_purchase_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	CONSTRAINT "ticket_purchase_assignee_ticket_purchase_id_member_id_pk" PRIMARY KEY("ticket_purchase_id","member_id")
);
--> statement-breakpoint
ALTER TABLE "out_of_budget_session" ADD CONSTRAINT "out_of_budget_session_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "out_of_budget_session" ADD CONSTRAINT "out_of_budget_session_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "out_of_budget_session" ADD CONSTRAINT "out_of_budget_session_session_id_session_session_code_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session"("session_code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_plan_entry" ADD CONSTRAINT "purchase_plan_entry_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_plan_entry" ADD CONSTRAINT "purchase_plan_entry_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_plan_entry" ADD CONSTRAINT "purchase_plan_entry_session_id_session_session_code_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session"("session_code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_plan_entry" ADD CONSTRAINT "purchase_plan_entry_assignee_member_id_member_id_fk" FOREIGN KEY ("assignee_member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_timeslot" ADD CONSTRAINT "purchase_timeslot_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_timeslot" ADD CONSTRAINT "purchase_timeslot_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reported_price" ADD CONSTRAINT "reported_price_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reported_price" ADD CONSTRAINT "reported_price_session_id_session_session_code_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session"("session_code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reported_price" ADD CONSTRAINT "reported_price_reported_by_member_id_member_id_fk" FOREIGN KEY ("reported_by_member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sold_out_session" ADD CONSTRAINT "sold_out_session_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sold_out_session" ADD CONSTRAINT "sold_out_session_session_id_session_session_code_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session"("session_code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sold_out_session" ADD CONSTRAINT "sold_out_session_reported_by_member_id_member_id_fk" FOREIGN KEY ("reported_by_member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_purchase" ADD CONSTRAINT "ticket_purchase_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_purchase" ADD CONSTRAINT "ticket_purchase_session_id_session_session_code_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session"("session_code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_purchase" ADD CONSTRAINT "ticket_purchase_purchased_by_member_id_member_id_fk" FOREIGN KEY ("purchased_by_member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_purchase_assignee" ADD CONSTRAINT "ticket_purchase_assignee_ticket_purchase_id_ticket_purchase_id_fk" FOREIGN KEY ("ticket_purchase_id") REFERENCES "public"."ticket_purchase"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_purchase_assignee" ADD CONSTRAINT "ticket_purchase_assignee_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_preference" DROP COLUMN "excluded";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "budget";