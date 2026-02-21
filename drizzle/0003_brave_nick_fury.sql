ALTER TABLE "users" ALTER COLUMN "quota" SET DEFAULT 2147483648;--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "folders" ADD COLUMN "deleted_at" timestamp;