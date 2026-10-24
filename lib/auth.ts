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
