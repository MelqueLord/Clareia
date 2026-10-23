import { env } from 'cloudflare:workers';

export function isTrialAdmin(email: string) {
  const configured = env.TRIAL_ADMIN_EMAIL?.trim().toLowerCase();
  return Boolean(configured && email.trim().toLowerCase() === configured);
}
