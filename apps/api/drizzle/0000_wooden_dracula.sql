CREATE TYPE "public"."metric_aggregation" AS ENUM('single_run', 'mean_over_seeds', 'mean_over_folds_and_seeds', 'fold_mean_over_seeds', 'std_between_fold_means', 'range_min', 'range_max');--> statement-breakpoint
CREATE TYPE "public"."agreement" AS ENUM('converging', 'mixed', 'open');--> statement-breakpoint
CREATE TYPE "public"."model_family" AS ENUM('quantum', 'classical', 'hybrid');--> statement-breakpoint
CREATE TYPE "public"."metric_split" AS ENUM('train', 'test', 'validation');--> statement-breakpoint
CREATE TYPE "public"."record_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TABLE "admin_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "comparison_set_experiments" (
	"set_id" integer NOT NULL,
	"experiment_id" integer NOT NULL,
	CONSTRAINT "comparison_set_experiments_set_id_experiment_id_pk" PRIMARY KEY("set_id","experiment_id")
);
--> statement-breakpoint
CREATE TABLE "comparison_sets" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"research_line_id" integer NOT NULL,
	"protocol_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"factor" text NOT NULL,
	"row_label" text DEFAULT 'Dataset' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "comparison_sets_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "datasets" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"short_name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"samples" text,
	"features" text,
	CONSTRAINT "datasets_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "experiments" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"research_line_id" integer NOT NULL,
	"protocol_id" integer NOT NULL,
	"dataset_id" integer,
	"title" text NOT NULL,
	"model_name" text NOT NULL,
	"model_family" "model_family" NOT NULL,
	"variant" text,
	"setting" text,
	"factor" text NOT NULL,
	"objective" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"configuration" jsonb,
	"fold" integer,
	"seed" integer,
	"n_seeds" integer,
	"n_folds" integer,
	"observations" text,
	"limitations" text,
	"source" text NOT NULL,
	"status" "record_status" DEFAULT 'draft' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "experiments_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "figures" (
	"id" serial PRIMARY KEY NOT NULL,
	"research_line_id" integer NOT NULL,
	"experiment_id" integer,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"source" text,
	"storage_key" text NOT NULL,
	"content_type" text NOT NULL,
	"width" integer,
	"height" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "figures_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "finding_experiments" (
	"finding_id" integer NOT NULL,
	"experiment_id" integer NOT NULL,
	CONSTRAINT "finding_experiments_finding_id_experiment_id_pk" PRIMARY KEY("finding_id","experiment_id")
);
--> statement-breakpoint
CREATE TABLE "findings" (
	"id" serial PRIMARY KEY NOT NULL,
	"question_id" integer NOT NULL,
	"research_line_id" integer,
	"observation" text NOT NULL,
	"interpretation" text DEFAULT '' NOT NULL,
	"limitations" text DEFAULT '' NOT NULL,
	"status" "record_status" DEFAULT 'draft' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"ip" text NOT NULL,
	"email" text NOT NULL,
	"success" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"experiment_id" integer NOT NULL,
	"metric_name" text NOT NULL,
	"metric_value" numeric NOT NULL,
	"split" "metric_split",
	"aggregation_type" "metric_aggregation",
	"unit" text,
	"source" text
);
--> statement-breakpoint
CREATE TABLE "protocols" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"research_line_id" integer NOT NULL,
	"name" text NOT NULL,
	"evaluation" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"limitations" text DEFAULT '' NOT NULL,
	CONSTRAINT "protocols_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "research_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"short_name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"manuscript_title" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "research_lines_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "research_questions" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"question" text NOT NULL,
	"context" text DEFAULT '' NOT NULL,
	"agreement" "agreement" DEFAULT 'open' NOT NULL,
	"open_questions" text DEFAULT '' NOT NULL,
	"status" "record_status" DEFAULT 'draft' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "research_questions_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"admin_user_id" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_history" (
	"experiment_id" integer NOT NULL,
	"epoch" integer NOT NULL,
	"train_loss" numeric,
	"val_loss" numeric,
	CONSTRAINT "training_history_experiment_id_epoch_pk" PRIMARY KEY("experiment_id","epoch")
);
--> statement-breakpoint
ALTER TABLE "comparison_set_experiments" ADD CONSTRAINT "comparison_set_experiments_set_id_comparison_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."comparison_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comparison_set_experiments" ADD CONSTRAINT "comparison_set_experiments_experiment_id_experiments_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."experiments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comparison_sets" ADD CONSTRAINT "comparison_sets_research_line_id_research_lines_id_fk" FOREIGN KEY ("research_line_id") REFERENCES "public"."research_lines"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comparison_sets" ADD CONSTRAINT "comparison_sets_protocol_id_protocols_id_fk" FOREIGN KEY ("protocol_id") REFERENCES "public"."protocols"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiments" ADD CONSTRAINT "experiments_research_line_id_research_lines_id_fk" FOREIGN KEY ("research_line_id") REFERENCES "public"."research_lines"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiments" ADD CONSTRAINT "experiments_protocol_id_protocols_id_fk" FOREIGN KEY ("protocol_id") REFERENCES "public"."protocols"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiments" ADD CONSTRAINT "experiments_dataset_id_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."datasets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "figures" ADD CONSTRAINT "figures_research_line_id_research_lines_id_fk" FOREIGN KEY ("research_line_id") REFERENCES "public"."research_lines"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "figures" ADD CONSTRAINT "figures_experiment_id_experiments_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."experiments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finding_experiments" ADD CONSTRAINT "finding_experiments_finding_id_findings_id_fk" FOREIGN KEY ("finding_id") REFERENCES "public"."findings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finding_experiments" ADD CONSTRAINT "finding_experiments_experiment_id_experiments_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."experiments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_question_id_research_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."research_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_research_line_id_research_lines_id_fk" FOREIGN KEY ("research_line_id") REFERENCES "public"."research_lines"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metrics" ADD CONSTRAINT "metrics_experiment_id_experiments_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."experiments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "protocols" ADD CONSTRAINT "protocols_research_line_id_research_lines_id_fk" FOREIGN KEY ("research_line_id") REFERENCES "public"."research_lines"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_admin_user_id_admin_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_history" ADD CONSTRAINT "training_history_experiment_id_experiments_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."experiments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "experiments_line_idx" ON "experiments" USING btree ("research_line_id");--> statement-breakpoint
CREATE INDEX "experiments_status_idx" ON "experiments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "login_attempts_ip_idx" ON "login_attempts" USING btree ("ip","created_at");--> statement-breakpoint
CREATE INDEX "login_attempts_email_idx" ON "login_attempts" USING btree ("email","created_at");--> statement-breakpoint
CREATE INDEX "metrics_experiment_idx" ON "metrics" USING btree ("experiment_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_idx" ON "sessions" USING btree ("expires_at");