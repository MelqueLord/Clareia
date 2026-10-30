'use client';

import { useRef, useState, type ChangeEvent } from 'react';
import { Download, LifeBuoy, Mail, ShieldCheck, Upload } from 'lucide-react';
import type { FinanceData, Space } from '../../lib/model';
import { emptyData } from '../../lib/model';
import { dataSchema } from '../../lib/validation';

type SupportRecoveryPanelProps = {
  space: Space;
  saving: boolean;
  onRestore: (data: FinanceData) => Promise<boolean>;
  onExport: () => void;
};

export default function SupportRecoveryPanel({ space, saving, onRestore, onExport }: SupportRecoveryPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function importBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    setMessage('');
    setBusy(true);
    try {
      if (file.size > 2_000_000) throw new Error('O arquivo ultrapassa o limite de 2 MB.');
      const decoded: unknown = JSON.parse(await file.text());
      if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) throw new Error('Este arquivo não é uma cópia válida do Clareia.');
      const backup = decoded as { version?: unknown; space?: unknown; data?: unknown };
      if (backup.version !== 1 || !backup.data) throw new Error('Este arquivo não é uma cópia válida do Clareia.');
      if (backup.space && backup.space !== space) throw new Error(`Esta cópia é do acesso ${backup.space === 'mei' ? 'MEI' : 'Pessoa Física'}. Entre no perfil correspondente antes de restaurar.`);
      const parsed = dataSchema.safeParse(backup.data);
      if (!parsed.success) throw new Error('A cópia contém dados inválidos ou de uma versão incompatível.');
      const lists = [parsed.data.accounts, parsed.data.cards, parsed.data.transactions, parsed.data.budgets, parsed.data.savingsGoals || [], parsed.data.investmentPlans || []];
      if (lists.some(list => list.some(item => item.space !== space))) throw new Error('A cópia mistura dados de Pessoa Física e MEI. Restaure cada perfil com sua própria cópia.');
      if (!window.confirm(`Restaurar a cópia de ${space === 'mei' ? 'MEI' : 'Pessoa Física'}? Os dados atuais deste acesso serão substituídos. Exporte uma cópia antes se quiser guardá-los.`)) return;
      const defaults = emptyData();
      const restored = { ...defaults, ...parsed.data, configured: parsed.data.accounts.length > 0 } as FinanceData;
      const saved = await onRestore(restored);
      if (saved) setMessage('Cópia restaurada e salva nesta conta.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível ler esta cópia.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return <section className="panel support-recovery-panel">
    <div className="support-panel-heading"><span className="support-panel-icon"><LifeBuoy size={19}/></span><div><h2>Suporte e recuperação</h2><p className="muted">Ajuda para entrar e uma cópia local dos seus dados.</p></div></div>
    <a className="support-panel-link" href="/suporte"><ShieldCheck size={16}/> Ver passo a passo e falar com o suporte</a>
    <div className="support-backup-row"><div><strong>Cópia de segurança</strong><p className="small-text muted">Guarde um arquivo JSON no aparelho. A restauração substitui os dados do perfil atual.</p></div><div className="support-backup-actions"><button className="button secondary" onClick={onExport}><Download size={15}/> Exportar</button><button className="button secondary" disabled={busy || saving} onClick={() => inputRef.current?.click()}><Upload size={15}/>{busy || saving ? 'Restaurando…' : 'Restaurar cópia'}</button><input ref={inputRef} type="file" accept="application/json,.json" onChange={event => void importBackup(event)} hidden/></div></div>
    {error && <p className="trial-admin-message error" role="alert">{error}</p>}{message && <p className="trial-admin-message" role="status">{message}</p>}
    <p className="support-backup-note"><Mail size={14}/> Para redefinir a senha, use “Esqueceu sua senha?” na tela de acesso. Confira também o spam; se o link não chegar, fale com o suporte. Nunca envie sua senha.</p>
  </section>;
}
