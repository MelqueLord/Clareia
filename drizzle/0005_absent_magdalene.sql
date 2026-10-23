CREATE INDEX `finance_audit_user_created_idx` ON `finance_audit` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `push_subscriptions_user_attempt_idx` ON `push_subscriptions` (`user_id`,`attempt_at`);--> statement-breakpoint
CREATE INDEX `push_subscriptions_attempt_idx` ON `push_subscriptions` (`attempt_at`);--> statement-breakpoint
CREATE INDEX `rate_limit_last_request_idx` ON `rate_limit` (`last_request`);--> statement-breakpoint
CREATE INDEX `session_expires_at_idx` ON `session` (`expires_at`);--> statement-breakpoint
CREATE INDEX `finance_snapshots_user_created_idx` ON `finance_snapshots` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `test_sessions_expires_at_idx` ON `test_sessions` (`expires_at`);--> statement-breakpoint
CREATE INDEX `verification_expires_at_idx` ON `verification` (`expires_at`);