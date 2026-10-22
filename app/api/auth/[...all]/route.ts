import { env } from "cloudflare:workers";
import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "../../../../lib/auth";

const handlers = toNextJsHandler(auth);
const unavailable = () => Response.json({ error: "Serviço temporariamente indisponível." }, { status: 503 });

export async function GET(request: Request) {
  if (!env.DB || !env.BETTER_AUTH_SECRET) return unavailable();
  return handlers.GET(request);
}

export async function POST(request: Request) {
  if (!env.DB || !env.BETTER_AUTH_SECRET) return unavailable();
  return handlers.POST(request);
}
