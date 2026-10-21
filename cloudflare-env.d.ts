declare namespace Cloudflare {
  interface Env {
    VAPID_PUBLIC_KEY?: string;
    VAPID_PRIVATE_JWK?: string;
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}
