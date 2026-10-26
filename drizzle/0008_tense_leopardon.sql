CREATE TABLE `billing_events` (
	`id` text PRIMARY KEY NOT NULL,
	`event_type` text NOT NULL,
	`provider_payment_id` text,
	`provider_subscription_id` text,
	`received_at` integer NOT NULL,
	`processed_at` integer
);
--> statement-breakpoint
CREATE INDEX `billing_events_processed_idx` ON `billing_events` (`processed_at`);--> statement-breakpoint
CREATE INDEX `billing_events_subscription_idx` ON `billing_events` (`provider_subscription_id`);--> statement-breakpoint
ALTER TABLE `account_access` ADD `provider_customer_id` text;--> statement-breakpoint
ALTER TABLE `account_access` ADD `provider_payment_id` text;