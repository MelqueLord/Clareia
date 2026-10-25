import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { env } from "cloudflare:workers";

// Keep builds usable without local credentials. Cloudflare forbids generating
// random values during module initialization. Every production auth route
// checks BETTER_AUTH_SECRET before calling Better Auth, so this fixed fallback
// is only used by local builds and is never accepted for production requests.
const buildOnlySecret = "clareia-build-only-secret-not-for-production";

export const auth = betterAuth({
  database: env.DB!,
  baseURL: env.BETTER_AUTH_URL || "http://localhost:3000",
  secret: env.BETTER_AUTH_SECRET || buildOnlySecret,
  trustedOrigins: env.BETTER_AUTH_URL ? [env.BETTER_AUTH_URL] : undefined,
  user: {
    deleteUser: {
      enabled: true,
      beforeDelete: async (user) => {
        if (!env.DB) throw new Error('Banco de dados indisponível para concluir a exclusão.');

        // Finance records are stored outside Better Auth, with one document per
        // profile. Remove both current and legacy keys before deleting the login.
        const financeUserIds = [
          user.id,
          `${user.id}:pf`,
          `${user.id}:mei`,
          `personal:${user.id}:pf`,
          `personal:${user.id}:mei`,
        ];
        const placeholders = financeUserIds.map(() => '?').join(',');
        const statements = (['finance_documents', 'finance_snapshots', 'finance_audit', 'push_subscriptions'] as const)
          .map((table) => env.DB!.prepare(`DELETE FROM ${table} WHERE user_id IN (${placeholders})`).bind(...financeUserIds));

        await env.DB.batch([
          ...statements,
          env.DB.prepare('DELETE FROM account_access WHERE user_id=?').bind(user.id),
          env.DB.prepare('DELETE FROM verification WHERE value=? OR identifier=? OR identifier=?')
            .bind(user.id, user.email, `email:${user.email}`),
          env.DB.prepare('DELETE FROM verification WHERE identifier=?').bind(`support-reset-link:${user.id}`),
        ]);
      },
    },
    fields: {
      emailVerified: "email_verified",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
    additionalFields: {
      space: {
        type: ["pf", "mei"],
        required: true,
        input: true,
      },
      mustChangePassword: {
        type: "boolean",
        required: true,
        defaultValue: false,
        input: false,
        fieldName: "must_change_password",
      },
    },
  },
  session: {
    fields: {
      userId: "user_id",
      expiresAt: "expires_at",
      createdAt: "created_at",
      updatedAt: "updated_at",
      ipAddress: "ip_address",
      userAgent: "user_agent",
    },
  },
  account: {
    fields: {
      accountId: "account_id",
      providerId: "provider_id",
      userId: "user_id",
      accessToken: "access_token",
      refreshToken: "refresh_token",
      idToken: "id_token",
      accessTokenExpiresAt: "access_token_expires_at",
      refreshTokenExpiresAt: "refresh_token_expires_at",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  verification: {
    fields: {
      expiresAt: "expires_at",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    disableSignUp: env.AUTH_SIGNUP_ENABLED !== "true",
    resetPasswordTokenExpiresIn: 60 * 60,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url, token }) => {
      if (!env.DB) throw new Error('Banco de dados indisponível para registrar a recuperação.');
      const now = Date.now();
      const identifier = `support-reset-link:${user.id}`;
      const activeResetIdentifier = `reset-password:${token}`;
      // Email delivery is not configured yet. Keep one short-lived link in the
      // existing verification table for the authorized support administrator.
      await env.DB.batch([
        env.DB.prepare("DELETE FROM verification WHERE value=? AND identifier LIKE 'reset-password:%' AND identifier<>?").bind(user.id, activeResetIdentifier),
        env.DB.prepare('DELETE FROM verification WHERE identifier=?').bind(identifier),
        env.DB.prepare('INSERT INTO verification(id,identifier,value,expires_at,created_at,updated_at) VALUES(?,?,?,?,?,?)')
          .bind(crypto.randomUUID(), identifier, url, now + 60 * 60 * 1000, now, now),
      ]);
    },
    onPasswordReset: async ({ user }) => {
      if (!env.DB) return;
      await env.DB.prepare('DELETE FROM verification WHERE identifier=?').bind(`support-reset-link:${user.id}`).run();
    },
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    modelName: "rate_limit",
    fields: {
      lastRequest: "last_request",
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (data) => {
          if (!env.DB) {
            throw new APIError("INTERNAL_SERVER_ERROR", {
              message: "Não foi possível verificar as vagas da homologação.",
            });
          }

          const configuredLimit = Number(env.PILOT_MAX_ACCOUNTS || 30);
          const limit = Number.isInteger(configuredLimit) && configuredLimit >= 1 && configuredLimit <= 1000
            ? configuredLimit
            : 30;
          const adminEmail = (env.TRIAL_ADMIN_EMAIL || "").trim().toLowerCase();
          const email = data.email.trim().toLowerCase();

          if (adminEmail && email === adminEmail) return { data };

          const lockId = "pilot-signup-capacity";
          const now = new Date().toISOString();
          const lock = await env.DB.prepare(
            "INSERT INTO job_locks(id,until_at) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET until_at=excluded.until_at WHERE job_locks.until_at<=? RETURNING id",
          ).bind(lockId, new Date(Date.now() + 120_000).toISOString(), now).first<{ id: string }>();
          if (!lock) {
            throw new APIError("TOO_MANY_REQUESTS", {
              message: "Estamos confirmando outro cadastro. Aguarde alguns segundos e tente novamente.",
            });
          }

          try {
            const accountCount = await env.DB.prepare(
              "SELECT COUNT(*) AS total FROM user WHERE lower(email) <> ?",
            ).bind(adminEmail).first<{ total: number }>();

            if ((accountCount?.total || 0) >= limit) {
              throw new APIError("FORBIDDEN", {
                message: `A turma de homologação atingiu o limite de ${limit} contas. Fale com o suporte do Clareia.`,
              });
            }
          } catch (cause) {
            await env.DB.prepare("DELETE FROM job_locks WHERE id=?").bind(lockId).run();
            throw cause;
          }

          return { data };
        },
        after: async () => {
          if (env.DB) await env.DB.prepare("DELETE FROM job_locks WHERE id=?").bind("pilot-signup-capacity").run();
        },
      },
      update: {
        before: async (data) => {
          if (Object.hasOwn(data, "space")) {
            throw new APIError("BAD_REQUEST", {
              message: "O tipo da conta é fixo após o cadastro.",
            });
          }
          if (Object.hasOwn(data, "mustChangePassword")) {
            throw new APIError("BAD_REQUEST", {
              message: "Este campo de acesso não pode ser alterado pelo perfil.",
            });
          }
          return { data };
        },
      },
    },
  },
});
