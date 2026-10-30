import { env } from 'cloudflare:workers';

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]!);
}

export function recoveryEmailConfigured() {
  return Boolean(env.RESEND_API_KEY?.trim() && env.RESEND_FROM_EMAIL?.trim());
}

function safeResetUrl(value: string) {
  if (!env.BETTER_AUTH_URL?.trim()) return null;
  try {
    const base = new URL(env.BETTER_AUTH_URL);
    const url = new URL(value);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
    if (base.protocol !== 'https:' && !(base.protocol === 'http:' && local)) return null;
    if (base.username || base.password || url.username || url.password || url.hash) return null;
    if (url.origin !== base.origin || url.pathname !== '/redefinir-senha') return null;
    if (url.searchParams.getAll('token').length !== 1 || !url.searchParams.get('token')?.trim()) return null;
    if ([...url.searchParams.keys()].some(key => key !== 'token')) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export async function sendRecoveryEmail({ email, name, resetUrl }: { email: string; name: string; resetUrl: string }) {
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.RESEND_FROM_EMAIL?.trim();
  const replyTo = env.RESEND_REPLY_TO?.trim();
  const safeUrl = safeResetUrl(resetUrl);
  if (!apiKey || !from || !safeUrl || /[\r\n]/.test(apiKey + from + (replyTo || '') + email)) return false;

  const greeting = name.trim() || 'tudo bem';
  const text = `Olá, ${greeting}.\n\nRecebemos um pedido para redefinir a senha da sua conta Clareia. Use o link abaixo em até 1 hora. Ele só pode ser usado uma vez:\n\n${safeUrl}\n\nSe você não fez este pedido, ignore esta mensagem. Nunca compartilhe este link.`;
  const html = `<p>Olá, ${escapeHtml(greeting)}.</p><p>Recebemos um pedido para redefinir a senha da sua conta Clareia. Use o link abaixo em até 1 hora. Ele só pode ser usado uma vez:</p><p><a href="${escapeHtml(safeUrl)}">Criar nova senha</a></p><p>Se você não fez este pedido, ignore esta mensagem. Nunca compartilhe este link.</p>`;

  try {
    // Stable per reset link; the token itself never appears in request headers.
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(safeUrl));
    const key = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json',
        'Idempotency-Key': `clareia-reset/${key}`,
      },
      body: JSON.stringify({
        from, to: [email], subject: 'Redefina sua senha do Clareia', text, html,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
      redirect: 'error',
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      await response.body?.cancel();
      return false;
    }
    const result = await response.json() as { id?: unknown };
    // Accepted by the provider is not the same as delivered to the inbox.
    return typeof result.id === 'string' && result.id.trim().length > 0;
  } catch {
    return false;
  }
}
