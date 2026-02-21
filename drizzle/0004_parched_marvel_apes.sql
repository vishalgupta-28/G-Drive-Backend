ALTER TABLE "files" ADD COLUMN "is_starred" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "folders" ADD COLUMN "is_starred" boolean DEFAULT false NOT NULL;