CREATE TABLE `account_access` (
	`user_id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'trialing' NOT NULL,
	`trial_started_at` integer NOT NULL,
	`trial_ends_at` integer NOT NULL,
	`billing_period_ends_at` integer,
	`provider_subscription_id` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_access_status_idx` ON `account_access` (`status`);--> statement-breakpoint
CREATE INDEX `account_access_trial_ends_idx` ON `account_access` (`trial_ends_at`);