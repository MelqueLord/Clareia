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
  const suggestedQuestions = ['Onde gastei mais?', 'Este mês foi melhor que o anterior?', 'Como está minha meta?'];
  function askQuestion(text: string) {
    setQuestion(text);
    setAnswer(answerQuestion(text, data, space, asOf) || 'Ainda não consigo responder a essa pergunta. Experimente uma das sugestões ou pergunte sobre gastos, comparação e metas.');
  }
  function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    askQuestion(question);
  }
  return <section className={`central-ask panel ${compact ? 'compact' : ''}`}>
    <div className="central-ask-heading"><span className="guided-icon"><Sparkles size={19}/></span><div><span className="eyebrow">SEU ASSISTENTE FINANCEIRO · CENTRAL DE INTELIGÊNCIA</span><h2>{compact ? 'Pergunte ao seu assistente' : 'Seu dinheiro, acompanhado com inteligência.'}</h2><p>{compact ? 'Compare períodos, entenda gastos e consulte metas com base no que você registrou.' : 'Eu organizo seus dados financeiros e ajudo você a entender o mês e escolher um próximo passo.'}</p></div></div>
    <form className="central-ask-form" onSubmit={ask}><input aria-label="Pergunte ao seu assistente financeiro" value={question} onChange={event => setQuestion(event.target.value)} placeholder="Ex.: quanto posso gastar até o próximo recebimento?"/><button className="button secondary" type="button" onClick={onVoice}><Mic size={16}/><span>Lançar por voz</span></button><button className="button primary" disabled={!question.trim()}><span>Perguntar</span><ArrowRight size={15}/></button></form>
    <div className="central-assist-prompts" aria-label="Perguntas sugeridas"><span>Você pode perguntar:</span>{suggestedQuestions.map(text => <button type="button" key={text} onClick={() => askQuestion(text)}>{text}</button>)}</div>
    {answer && <div className="central-answer" role="status"><strong>O que seus registros mostram</strong><p>{answer}</p><small>As orientações usam os dados que você informou. Confira os lançamentos antes de decidir.</small></div>}
  </section>;
}
