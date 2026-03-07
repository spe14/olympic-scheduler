CREATE TYPE "public"."avatar_color_enum" AS ENUM('blue', 'yellow', 'pink', 'green');--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "avatar_color" "avatar_color_enum" DEFAULT 'blue' NOT NULL;