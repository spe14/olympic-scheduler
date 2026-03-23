CREATE INDEX "buddy_constraint_buddy_id_idx" ON "buddy_constraint" USING btree ("buddy_id");--> statement-breakpoint
CREATE INDEX "combo_group_member_idx" ON "combo" USING btree ("group_id","member_id");--> statement-breakpoint
CREATE INDEX "member_group_status_idx" ON "member" USING btree ("group_id","status");--> statement-breakpoint
CREATE INDEX "ticket_purchase_group_session_idx" ON "ticket_purchase" USING btree ("group_id","session_id");