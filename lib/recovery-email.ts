import { env } from 'cloudflare:workers';

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]!);
}

export function recoveryEmailConfigured() {
  return Boolean(env.RESEND_API_KEY?.trim() && env.RESEND_FROM_EMAIL?.trim());
}

export async function sendRecoveryEmail({ email, name, resetUrl }: { email: string; name: string; resetUrl: string }) {
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.RESEND_FROM_EMAIL?.trim();
  if (!apiKey || !from) return false;

  const greeting = name.trim() || 'tudo bem';
  const text = `Olá, ${greeting}.\n\nRecebemos um pedido para redefinir a senha da sua conta Clareia. Use o link abaixo em até 1 hora. Ele só pode ser usado uma vez:\n\n${resetUrl}\n\nSe você não fez este pedido, ignore esta mensagem. Nunca compartilhe este link.`;
  const html = `<p>Olá, ${escapeHtml(greeting)}.</p><p>Recebemos um pedido para redefinir a senha da sua conta Clareia. Use o link abaixo em até 1 hora. Ele só pode ser usado uma vez:</p><p><a href="${escapeHtml(resetUrl)}">Criar nova senha</a></p><p>Se você não fez este pedido, ignore esta mensagem. Nunca compartilhe este link.</p>`;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [email],
        subject: 'Redefina sua senha do Clareia',
        text,
        html,
        ...(env.RESEND_REPLY_TO?.trim() ? { reply_to: env.RESEND_REPLY_TO.trim() } : {}),
      }),
      redirect: 'error',
      signal: AbortSignal.timeout(8_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
