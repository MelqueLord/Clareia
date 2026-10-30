import { env } from 'cloudflare:workers';

type AdminCandidate = {
  authUserId?: string;
  email: string;
  isTest: boolean;
  mustChangePassword: boolean;
};

export function isTrialAdmin(user: AdminCandidate | null | undefined) {
  const configuredId = env.TRIAL_ADMIN_USER_ID?.trim();
  const configuredEmail = env.TRIAL_ADMIN_EMAIL?.trim().toLowerCase();

  // The ID is assigned by authentication and enrolled by the hosting operator.
  // Never fall back to an email address supplied during public registration.
  return Boolean(
    configuredId && configuredEmail && user &&
    !user.isTest && !user.mustChangePassword &&
    user.authUserId === configuredId &&
    user.email.trim().toLowerCase() === configuredEmail,
  );
}
