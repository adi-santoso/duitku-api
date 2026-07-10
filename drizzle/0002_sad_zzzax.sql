ALTER TABLE "projects" DROP CONSTRAINT "projects_total_budget_check";--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "total_budget" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_total_budget_check" CHECK ("projects"."total_budget" IS NULL OR "projects"."total_budget" >= 0);