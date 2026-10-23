import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { user as authUser } from './auth-schema';
export const pushSubscriptions=sqliteTable('push_subscriptions',{id:text('id').primaryKey(),userId:text('user_id').notNull(),endpoint:text('endpoint').notNull(),frequency:text('frequency').notNull(),lastDigest:text('last_digest').notNull(),lastSent:text('last_sent').notNull(),lastWeek:text('last_week').notNull(),attemptAt:text('attempt_at').notNull()},table=>[index('push_subscriptions_user_attempt_idx').on(table.userId,table.attemptAt),index('push_subscriptions_attempt_idx').on(table.attemptAt)]);
export const jobLocks=sqliteTable('job_locks',{id:text('id').primaryKey(),until:text('until_at').notNull()});
export const testSessions=sqliteTable('test_sessions',{tokenHash:text('token_hash').primaryKey(),userId:text('user_id').notNull(),displayName:text('display_name').notNull(),email:text('email').notNull(),space:text('space').notNull(),expiresAt:text('expires_at').notNull()},table=>[index('test_sessions_expires_at_idx').on(table.expiresAt)]);
export const financeDocuments = sqliteTable('finance_documents',{userId:text('user_id').primaryKey(),payload:text('payload').notNull(),revision:integer('revision').notNull(),mutationId:text('mutation_id').notNull(),updatedAt:text('updated_at').notNull()});
export const snapshots = sqliteTable('finance_snapshots',{id:text('id').primaryKey(),userId:text('user_id').notNull(),payload:text('payload').notNull(),createdAt:text('created_at').notNull()},table=>[index('finance_snapshots_user_created_idx').on(table.userId,table.createdAt)]);
export const audit = sqliteTable('finance_audit',{id:text('id').primaryKey(),userId:text('user_id').notNull(),action:text('action').notNull(),createdAt:text('created_at').notNull()},table=>[index('finance_audit_user_created_idx').on(table.userId,table.createdAt)]);
export const accountAccess = sqliteTable('account_access', {
  userId: text('user_id').primaryKey().references(() => authUser.id, { onDelete: 'cascade' }),
  status: text('status', { enum: ['trialing', 'active', 'expired', 'past_due', 'canceled'] }).notNull().default('trialing'),
  trialStartedAt: integer('trial_started_at').notNull(),
  trialEndsAt: integer('trial_ends_at').notNull(),
  billingPeriodEndsAt: integer('billing_period_ends_at'),
  providerSubscriptionId: text('provider_subscription_id'),
  subscriptionRequestedAt: integer('subscription_requested_at'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`).notNull(),
}, table => [index('account_access_status_idx').on(table.status), index('account_access_trial_ends_idx').on(table.trialEndsAt)]);
export { user, session, account, verification, rateLimit } from './auth-schema';
