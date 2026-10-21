CREATE TABLE `test_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`display_name` text NOT NULL,
	`email` text NOT NULL,
	`space` text NOT NULL,
	`expires_at` text NOT NULL
);
