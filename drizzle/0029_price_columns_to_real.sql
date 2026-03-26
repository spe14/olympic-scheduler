ALTER TABLE "reported_price" ALTER COLUMN "min_price" SET DATA TYPE real;--> statement-breakpoint
ALTER TABLE "reported_price" ALTER COLUMN "max_price" SET DATA TYPE real;--> statement-breakpoint
ALTER TABLE "ticket_purchase" ALTER COLUMN "price_per_ticket" SET DATA TYPE real;--> statement-breakpoint
ALTER TABLE "ticket_purchase_assignee" ALTER COLUMN "price_paid" SET DATA TYPE real;