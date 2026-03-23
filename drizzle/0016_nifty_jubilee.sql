ALTER TABLE "reported_price" ADD COLUMN "min_price" integer;--> statement-breakpoint
ALTER TABLE "reported_price" ADD COLUMN "max_price" integer;--> statement-breakpoint
ALTER TABLE "reported_price" ADD COLUMN "comments" text;--> statement-breakpoint
ALTER TABLE "ticket_purchase_assignee" ADD COLUMN "price_paid" integer;--> statement-breakpoint
ALTER TABLE "reported_price" DROP COLUMN "price";