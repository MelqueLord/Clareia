'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, ShieldCheck, UserRound, Wallet, Building2, CheckCircle2, Clock3, Ban } from 'lucide-react';

type AccountRow = {
  id: string;
  name: string;
  email: string;
  space: 'pf' | 'mei';
  createdAt: number;
  status: 'trialing' | 'active' | 'expired' | 'past_due' | 'canceled' | null;
  trialStartedAt: number | null;
  trialEndsAt: number | null;
  billingPeriodEndsAt: number | null;
  subscriptionRequestedAt: number | null;
};
const when = (value: number | null) => value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(value)) : 'Ainda não começou';
const statusLabel = (status: AccountRow['status']) => status === 'active' ? 'Ativa' : status === 'trialing' ? 'Em teste' : status === 'expired' ? 'Bloqueada' : status === 'past_due' ? 'Pagamento pendente' : status === 'canceled' ? 'Cancelada' : 'Aguardando primeiro acesso';

export default function TrialManagementPanel() {
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/access', { cache: 'no-store' });
      const result = await response.json() as { accounts?: AccountRow[]; error?: string };
      if (!response.ok) throw new Error(result.error || 'Não foi possível carregar os acessos.');
      setAccounts(result.accounts || []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível carregar os acessos.');
    } finally {
      setLoading(false);
    }
  }

  async function update(account: AccountRow, action: 'extend_trial' | 'activate' | 'block') {
    setBusyId(account.id);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/admin/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: account.id, action, days: action === 'extend_trial' ? 7 : 30 }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Não foi possível atualizar o acesso.');
      setMessage('Acesso atualizado.');
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível atualizar o acesso.');
    } finally {
      setBusyId('');
    }
  }

  useEffect(() => { void refresh(); }, []);

  return <section className="panel trial-admin">
    <div className="trial-admin-heading"><div><span className="trial-admin-icon"><ShieldCheck size={19}/></span><div><h2>Controle de testes e assinaturas</h2><p>Gerencie os acessos sem visualizar os dados financeiros das pessoas.</p></div></div><button className="icon-button" aria-label="Atualizar lista de contas" disabled={loading} onClick={()=>void refresh()}><RefreshCw size={16}/></button></div>
    {error&&<p className="trial-admin-message error" role="alert">{error}</p>}{message&&<p className="trial-admin-message" role="status">{message}</p>}
    {loading?<p className="muted small-text">Carregando contas…</p>:accounts.length===0?<p className="muted small-text">Nenhuma conta cadastrada ainda.</p>:<div className="trial-admin-list">{accounts.map(account=><article className="trial-admin-row" key={account.id}>
      <div className="trial-admin-user"><span className="trial-admin-avatar">{account.space==='mei'?<Building2 size={17}/>:<UserRound size={17}/>}</span><div><strong>{account.name||account.email}</strong><small>{account.email} · {account.space==='mei'?'MEI':'Pessoa Física'}</small></div></div>
      <div className="trial-admin-status"><span className={'trial-status-pill '+(account.status==='active'?'active':account.status==='trialing'?'trialing':'blocked')}>{account.status==='active'?<CheckCircle2 size={13}/>:account.status==='trialing'?<Clock3 size={13}/>:<Ban size={13}/>} {statusLabel(account.status)}</span><small>{account.status==='active'?`Acesso até ${when(account.billingPeriodEndsAt)}`:`Teste até ${when(account.trialEndsAt)}`}</small>{account.subscriptionRequestedAt&&<small className="trial-request-date">Pediu assinatura em {when(account.subscriptionRequestedAt)}</small>}</div>
      <div className="trial-admin-actions"><button className="button secondary" disabled={busyId===account.id} onClick={()=>void update(account,'extend_trial')}>+ 7 dias de teste</button><button className="button secondary" disabled={busyId===account.id} onClick={()=>void update(account,'activate')}><Wallet size={14}/> Liberar 30 dias</button><button className="button danger-button" disabled={busyId===account.id} onClick={()=>void update(account,'block')}>Bloquear</button></div>
    </article>)}</div>}
  </section>;
}
