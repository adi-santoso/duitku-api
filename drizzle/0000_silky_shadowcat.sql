CREATE TABLE "app_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" text,
	"role" text DEFAULT 'owner' NOT NULL,
	"owner_id" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "app_users_email_unique" UNIQUE("email"),
	CONSTRAINT "app_users_role_check" CHECK ("app_users"."role" IN ('owner', 'staff')),
	CONSTRAINT "valid_role_owner" CHECK (("app_users"."role" = 'owner' AND "app_users"."owner_id" IS NULL) OR ("app_users"."role" = 'staff' AND "app_users"."owner_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "budgets" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"category_id" bigint NOT NULL,
	"amount" numeric NOT NULL,
	"period" text NOT NULL,
	"start_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "budgets_period_check" CHECK ("budgets"."period" IN ('monthly', 'yearly')),
	CONSTRAINT "budgets_amount_check" CHECK ("budgets"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"icon" text,
	"color" text,
	"is_default" boolean DEFAULT false,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "categories_type_check" CHECK ("categories"."type" IN ('income', 'expense'))
);
--> statement-breakpoint
CREATE TABLE "savings_contributions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"goal_id" bigint NOT NULL,
	"user_id" uuid NOT NULL,
	"amount" numeric NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "savings_contributions_amount_check" CHECK ("savings_contributions"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "savings_goals" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"target_amount" numeric NOT NULL,
	"current_amount" numeric DEFAULT '0' NOT NULL,
	"target_date" date,
	"icon" text DEFAULT '🎯',
	"color" text DEFAULT '#10B981',
	"is_completed" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "savings_goals_target_check" CHECK ("savings_goals"."target_amount" > 0),
	CONSTRAINT "savings_goals_current_check" CHECK ("savings_goals"."current_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"category_id" bigint NOT NULL,
	"type" text NOT NULL,
	"amount" numeric NOT NULL,
	"description" text,
	"receipt_image" text,
	"transaction_date" date NOT NULL,
	"is_recurring" boolean DEFAULT false,
	"recurring_frequency" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "transactions_type_check" CHECK ("transactions"."type" IN ('income', 'expense')),
	CONSTRAINT "transactions_amount_check" CHECK ("transactions"."amount" >= 0),
	CONSTRAINT "transactions_recurring_frequency_check" CHECK ("transactions"."recurring_frequency" IS NULL OR "transactions"."recurring_frequency" IN ('daily', 'weekly', 'monthly', 'yearly'))
);
--> statement-breakpoint
ALTER TABLE "app_users" ADD CONSTRAINT "app_users_owner_id_app_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_contributions" ADD CONSTRAINT "savings_contributions_goal_id_savings_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."savings_goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_contributions" ADD CONSTRAINT "savings_contributions_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_goals" ADD CONSTRAINT "savings_goals_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_app_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_app_users_email" ON "app_users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_app_users_owner_id" ON "app_users" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_app_users_role" ON "app_users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "idx_budgets_user_id" ON "budgets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_budgets_user_category" ON "budgets" USING btree ("user_id","category_id");--> statement-breakpoint
CREATE INDEX "idx_categories_user_id" ON "categories" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_categories_type" ON "categories" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_savings_contributions_goal_id" ON "savings_contributions" USING btree ("goal_id");--> statement-breakpoint
CREATE INDEX "idx_savings_goals_user_id" ON "savings_goals" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_transactions_user_id" ON "transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_transactions_date" ON "transactions" USING btree ("transaction_date");--> statement-breakpoint
CREATE INDEX "idx_transactions_user_date" ON "transactions" USING btree ("user_id","transaction_date");--> statement-breakpoint
CREATE INDEX "idx_transactions_user_type" ON "transactions" USING btree ("user_id","type");