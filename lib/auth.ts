import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { env } from "cloudflare:workers";
import { getRequestExecutionContext } from "vinext/shims/request-context";
import { sendRecoveryEmail } from "./recovery-email";

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
      const resetUrl = new URL('/redefinir-senha', env.BETTER_AUTH_URL || new URL(url).origin);
      resetUrl.searchParams.set('token', token);

      // Invalidate older requests first; only the newest one-time link remains usable.
      await env.DB.batch([
        env.DB.prepare("DELETE FROM verification WHERE value=? AND identifier LIKE 'reset-password:%' AND identifier<>?").bind(user.id, activeResetIdentifier),
        env.DB.prepare('DELETE FROM verification WHERE identifier=?').bind(identifier),
      ]);

      const queueForSupport = async () => {
        // A slow failed delivery must not restore a superseded or already-used
        // link to the support queue. Check the token atomically when inserting.
        await env.DB!.prepare(`
          INSERT INTO verification(id,identifier,value,expires_at,created_at,updated_at)
          SELECT ?,?,?,?,?,?
          WHERE EXISTS (SELECT 1 FROM verification WHERE identifier=? AND value=? AND expires_at>?)
            AND NOT EXISTS (SELECT 1 FROM verification WHERE identifier=?)
        `).bind(crypto.randomUUID(), identifier, resetUrl.toString(), now + 60 * 60 * 1000, now, now,
          activeResetIdentifier, user.id, Date.now(), identifier).run();
      };
      const deliverOrQueue = async () => {
        const sent = await sendRecoveryEmail({ email: user.email, name: user.name || '', resetUrl: resetUrl.toString() });
        if (!sent) await queueForSupport();
      };

      const requestContext = getRequestExecutionContext();
      if (requestContext) requestContext.waitUntil(deliverOrQueue().catch(() => {}));
      else await deliverOrQueue();
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

          if (adminEmail && email === adminEmail) {
            throw new APIError("FORBIDDEN", {
              message: "Este endereço está reservado. Use o acesso existente ou fale com o suporte.",
            });
          }

          const signupPolicy = env.AUTH_SIGNUP_POLICY ?? "open";
          if (signupPolicy !== "open" && signupPolicy !== "allowlist") {
            throw new APIError("SERVICE_UNAVAILABLE", {
              message: "O cadastro está temporariamente indisponível. Fale com o suporte.",
            });
          }
          if (signupPolicy === "allowlist") {
            const allowedEmails = (env.AUTH_SIGNUP_ALLOWED_EMAILS || "")
              .split(/[,;\n\r]+/).map(value => value.trim().toLowerCase()).filter(Boolean);
            const validList = allowedEmails.length > 0 && allowedEmails.length <= 1000 &&
              allowedEmails.every(value => /^[^\s@,;*]+@[^\s@,;*]+\.[^\s@,;*]+$/.test(value));
            if (!validList || !allowedEmails.includes(email)) {
              throw new APIError("FORBIDDEN", {
                message: "O cadastro da homologação está restrito aos participantes autorizados. Fale com o suporte.",
              });
            }
          }

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
              "SELECT COUNT(*) AS total FROM user WHERE NOT (id = ? AND lower(email) = ?)",
            ).bind(env.TRIAL_ADMIN_USER_ID?.trim() || "", adminEmail).first<{ total: number }>();

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
