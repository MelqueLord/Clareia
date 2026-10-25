'use client';

import { FormEvent, useState } from 'react';
import { ArrowDownLeft, ArrowRight, ArrowUpRight, ChevronDown, Mic, Sparkles } from 'lucide-react';
import type { FinanceData, Space } from '../../lib/model';
import { answerQuestion } from '../../lib/intelligence';
import { isFinancialMovement } from '../../lib/voice';

export default function CentralAsk({ data, space, asOf, onVoice, onQuickEntry, onQuickTransaction, compact = false }: {
  data: FinanceData;
  space: Space;
  asOf: string;
  onVoice: () => void;
  onQuickEntry: (text: string) => void;
  onQuickTransaction: (type: 'income' | 'expense') => void;
  compact?: boolean;
}) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const suggestedQuestions = [
    { label: 'Onde gastei mais?', question: 'Onde gastei mais este mês?' },
    { label: 'Compare com o mês anterior', question: 'Este mês foi melhor que o anterior?' },
    { label: 'Como estão minhas metas?', question: 'Como estão minhas metas para guardar dinheiro?' },
    { label: 'O que está aumentando meus gastos?', question: 'O que está aumentando meus gastos?' },
    { label: 'Quanto posso gastar?', question: 'Quanto posso gastar até a próxima entrada?' },
    ...(space === 'mei' ? [{ label: 'Quanto posso retirar do MEI?', question: 'Quanto posso retirar do MEI?' }] : []),
  ];
  function askQuestion(text: string) {
    setQuestion(text);
    setAnswer(answerQuestion(text, data, space, asOf) || 'Ainda não consigo responder a essa pergunta. Experimente uma das sugestões ou pergunte sobre gastos, comparação e metas.');
  }
  function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = question.trim();
    if (isFinancialMovement(text)) {
      setAnswer('');
      setQuestion('');
      onQuickEntry(text);
      return;
    }
    askQuestion(text);
  }
  return <section className={`central-ask panel ${compact ? 'compact' : ''}`}>
    <div className="central-ask-heading"><span className="guided-icon"><Sparkles size={19}/></span><div><span className="eyebrow">SEU ASSISTENTE FINANCEIRO</span><h2>Pergunte ao Clareia</h2><p>Consulte gastos, metas, comparações e alertas. Você também pode registrar uma movimentação por texto ou áudio.</p></div></div>
    {compact && <div className="central-quick-actions" aria-label="Ações rápidas"><button className="button secondary" type="button" onClick={() => onQuickTransaction('expense')}><ArrowUpRight size={16}/><span>Registrar gasto</span></button><button className="button secondary" type="button" onClick={() => onQuickTransaction('income')}><ArrowDownLeft size={16}/><span>Registrar entrada</span></button></div>}
    <form className="central-ask-form" onSubmit={ask}><input aria-label="Digite uma movimentação ou pergunta financeira" value={question} onChange={event => setQuestion(event.target.value)} placeholder="Ex.: paguei R$ 48 no mercado no Pix"/><button className="button secondary" type="button" onClick={onVoice}><Mic size={16}/><span>Falar</span></button><button className="button primary" disabled={!question.trim()}><span>{isFinancialMovement(question) ? 'Preparar lançamento' : 'Perguntar'}</span><ArrowRight size={15}/></button></form>
    <p className="central-quick-hint">Escreva uma pergunta ou conte o que recebeu ou pagou. O Clareia prepara a resposta ou o lançamento para você conferir.</p>
    <details className="central-assist-prompts"><summary>Ver todas as consultas disponíveis ({suggestedQuestions.length}) <ChevronDown size={15}/></summary><div className="central-prompt-list" aria-label="Consultas disponíveis">{suggestedQuestions.map(({label, question: prompt}) => <button type="button" key={prompt} onClick={() => askQuestion(prompt)}>{label}</button>)}</div></details>
    {answer && <div className="central-answer" role="status"><strong>O que seus registros mostram</strong><p>{answer}</p><small>As orientações usam os dados que você informou. Confira os lançamentos antes de decidir.</small></div>}
  </section>;
}
