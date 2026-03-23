ALTER TABLE "sold_out_session" DROP CONSTRAINT "sold_out_session_reported_by_member_id_member_id_fk";
--> statement-breakpoint
ALTER TABLE "sold_out_session" ALTER COLUMN "reported_by_member_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "sold_out_session" ADD CONSTRAINT "sold_out_session_reported_by_member_id_member_id_fk" FOREIGN KEY ("reported_by_member_id") REFERENCES "public"."member"("id") ON DELETE set null ON UPDATE no action;