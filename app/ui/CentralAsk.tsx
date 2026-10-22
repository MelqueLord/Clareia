'use client';

import { FormEvent, useState } from 'react';
import { ArrowRight, Mic, Sparkles } from 'lucide-react';
import type { FinanceData, Space } from '../../lib/model';
import { answerQuestion } from '../../lib/intelligence';

export default function CentralAsk({ data, space, asOf, onVoice, compact = false }: {
  data: FinanceData;
  space: Space;
  asOf: string;
  onVoice: () => void;
  compact?: boolean;
}) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = answerQuestion(question, data, space, asOf);
    if (result) setAnswer(result);
  }
  return <section className={`central-ask panel ${compact ? 'compact' : ''}`}>
    <div className="central-ask-heading"><span className="guided-icon"><Sparkles size={19}/></span><div><span className="eyebrow">CENTRAL DE INTELIGÊNCIA</span><h2>{compact ? 'Pergunte ao Clareia' : 'Seu dinheiro, acompanhado de perto.'}</h2><p>{compact ? 'Peça uma comparação ou orientação com base nos seus registros.' : 'Tire dúvidas, entenda seus gastos e receba um próximo passo com seus dados.'}</p></div></div>
    <form className="central-ask-form" onSubmit={ask}><input aria-label="Pergunte à Central de Inteligência" value={question} onChange={event => setQuestion(event.target.value)} placeholder="Ex.: Este mês foi melhor que o anterior?"/><button className="button secondary" type="button" onClick={onVoice}><Mic size={16}/><span>Falar</span></button><button className="button primary" disabled={!question.trim()}><span>Perguntar</span><ArrowRight size={15}/></button></form>
    {answer && <div className="central-answer" role="status"><strong>O que seus registros mostram</strong><p>{answer}</p><small>Resposta baseada nos lançamentos informados e em regras verificáveis.</small></div>}
  </section>;
}
