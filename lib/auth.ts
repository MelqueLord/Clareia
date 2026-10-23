import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { env } from "cloudflare:workers";

// Keep builds usable without local credentials. Production auth routes fail
// closed unless BETTER_AUTH_SECRET is configured, so this value is never a
// shared or persistent production secret.
const ephemeralBuildSecret = crypto.randomUUID() + crypto.randomUUID();

export const auth = betterAuth({
  database: env.DB!,
  baseURL: env.BETTER_AUTH_URL || "http://localhost:3000",
  secret: env.BETTER_AUTH_SECRET || ephemeralBuildSecret,
  trustedOrigins: env.BETTER_AUTH_URL ? [env.BETTER_AUTH_URL] : undefined,
  user: {
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
        defaultValue: true,
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
