ALTER TABLE "combo_session" DROP CONSTRAINT "combo_session_session_id_session_session_code_fk";
--> statement-breakpoint
ALTER TABLE "conflict" DROP CONSTRAINT "conflict_session_id_session_session_code_fk";
--> statement-breakpoint
ALTER TABLE "session_preference" DROP CONSTRAINT "session_preference_session_id_session_session_code_fk";
--> statement-breakpoint
ALTER TABLE "viable_config" DROP CONSTRAINT "viable_config_session_id_session_session_code_fk";
--> statement-breakpoint
ALTER TABLE "combo_session" ADD CONSTRAINT "combo_session_session_id_session_session_code_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session"("session_code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conflict" ADD CONSTRAINT "conflict_session_id_session_session_code_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session"("session_code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_preference" ADD CONSTRAINT "session_preference_session_id_session_session_code_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session"("session_code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viable_config" ADD CONSTRAINT "viable_config_session_id_session_session_code_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session"("session_code") ON DELETE cascade ON UPDATE no action;