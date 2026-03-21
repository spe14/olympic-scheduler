ALTER TABLE "buddy_constraint" DROP CONSTRAINT "buddy_constraint_member_id_member_id_fk";
--> statement-breakpoint
ALTER TABLE "buddy_constraint" DROP CONSTRAINT "buddy_constraint_buddy_id_member_id_fk";
--> statement-breakpoint
ALTER TABLE "combo" DROP CONSTRAINT "combo_group_id_groups_id_fk";
--> statement-breakpoint
ALTER TABLE "combo" DROP CONSTRAINT "combo_member_id_member_id_fk";
--> statement-breakpoint
ALTER TABLE "combo_session" DROP CONSTRAINT "combo_session_combo_id_combo_id_fk";
--> statement-breakpoint
ALTER TABLE "member" DROP CONSTRAINT "member_group_id_groups_id_fk";
--> statement-breakpoint
ALTER TABLE "session_preference" DROP CONSTRAINT "session_preference_member_id_member_id_fk";
--> statement-breakpoint
ALTER TABLE "window_ranking" DROP CONSTRAINT "window_ranking_group_id_groups_id_fk";
--> statement-breakpoint
ALTER TABLE "buddy_constraint" ADD CONSTRAINT "buddy_constraint_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "buddy_constraint" ADD CONSTRAINT "buddy_constraint_buddy_id_member_id_fk" FOREIGN KEY ("buddy_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "combo" ADD CONSTRAINT "combo_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "combo" ADD CONSTRAINT "combo_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "combo_session" ADD CONSTRAINT "combo_session_combo_id_combo_id_fk" FOREIGN KEY ("combo_id") REFERENCES "public"."combo"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "session_preference" ADD CONSTRAINT "session_preference_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "window_ranking" ADD CONSTRAINT "window_ranking_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;
