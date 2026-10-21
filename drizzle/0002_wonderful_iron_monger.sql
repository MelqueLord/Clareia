CREATE TABLE `job_locks` (
	`id` text PRIMARY KEY NOT NULL,
	`until_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`endpoint` text NOT NULL,
	`frequency` text NOT NULL,
	`last_digest` text NOT NULL,
	`last_sent` text NOT NULL,
	`last_week` text NOT NULL,
	`attempt_at` text NOT NULL
);
