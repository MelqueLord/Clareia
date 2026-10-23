import { env } from 'cloudflare:workers';

const DAY_MS = 24 * 60 * 60 * 1000;
export type AccessStatus = 'trialing' | 'active' | 'expired' | 'demo';
export type AccountAccess = {
  status: AccessStatus;
  trialStartedAt: number | null;
  trialEndsAt: number | null;
  subscriptionRequestedAt: number | null;
  daysRemaining: number;
  canUse: boolean;
};

function trialDays() {
  const configured = Number(env.TRIAL_DURATION_DAYS || 30);
  return Number.isInteger(configured) && configured >= 1 && configured <= 365 ? configured : 30;
}

export async function getAccountAccess(authUserId: string, now = Date.now()): Promise<AccountAccess> {
  if (!env.DB) throw new Error('Banco de dados indisponível.');
  const duration = trialDays() * DAY_MS;
  await env.DB.prepare(`
    INSERT OR IGNORE INTO account_access (user_id, status, trial_started_at, trial_ends_at)
    SELECT id, 'trialing', ?, ? FROM user WHERE id = ?
  `).bind(now, now + duration, authUserId).run();

  const row = await env.DB.prepare(
    'SELECT status, trial_started_at, trial_ends_at, billing_period_ends_at, subscription_requested_at FROM account_access WHERE user_id = ?',
  ).bind(authUserId).first<{
    status: string;
    trial_started_at: number;
    trial_ends_at: number;
    billing_period_ends_at: number | null;
    subscription_requested_at: number | null;
  }>();
  if (!row) throw new Error('Não foi possível iniciar o período de teste.');

  const trialIsOpen = row.status === 'trialing' && row.trial_ends_at > now;
  const paidIsOpen = row.status === 'active' && (row.billing_period_ends_at === null || row.billing_period_ends_at > now);
  const status: AccessStatus = paidIsOpen ? 'active' : trialIsOpen ? 'trialing' : 'expired';
  if ((row.status === 'trialing' && !trialIsOpen) || (row.status === 'active' && !paidIsOpen)) {
    await env.DB.prepare("UPDATE account_access SET status='expired', updated_at=? WHERE user_id=? AND status IN ('trialing','active')")
      .bind(now, authUserId).run();
  }

  return {
    status,
    trialStartedAt: row.trial_started_at,
    trialEndsAt: row.trial_ends_at,
    subscriptionRequestedAt: row.subscription_requested_at,
    daysRemaining: trialIsOpen ? Math.max(1, Math.ceil((row.trial_ends_at - now) / DAY_MS)) : 0,
    canUse: trialIsOpen || paidIsOpen,
  };
}

export const demoAccess: AccountAccess = {
  status: 'demo',
  trialStartedAt: null,
  trialEndsAt: null,
  subscriptionRequestedAt: null,
  daysRemaining: 0,
  canUse: true,
};
