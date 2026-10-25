'use client';

import { FormEvent, useState } from 'react';
import { ArrowRight, Mic, Sparkles } from 'lucide-react';
import type { FinanceData, Space } from '../../lib/model';
import { answerQuestion } from '../../lib/intelligence';
import { isFinancialMovement } from '../../lib/voice';

export default function CentralAsk({ data, space, asOf, onVoice, compact = false }: {
  data: FinanceData;
  space: Space;
  asOf: string;
  onVoice: () => void;
  onQuickEntry: (text: string) => void;
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
    <div className="central-ask-heading"><span className="guided-icon"><Sparkles size={19}/></span><div><span className="eyebrow">SEU ASSISTENTE FINANCEIRO · CENTRAL DE INTELIGÊNCIA</span><h2>{compact ? 'Seu próximo passo, sem complicação' : 'Seu dinheiro, acompanhado com inteligência.'}</h2><p>{compact ? 'Peça uma orientação ou conte o que recebeu e pagou. Eu preparo o lançamento para você conferir.' : 'Eu organizo seus dados financeiros e ajudo você a entender o mês e escolher um próximo passo.'}</p></div></div>
    <form className="central-ask-form" onSubmit={ask}><input aria-label="Peça uma orientação ou registre um movimento financeiro" value={question} onChange={event => setQuestion(event.target.value)} placeholder="Ex.: paguei R$ 48 no mercado no Pix · ou: onde gastei mais?"/><button className="button secondary" type="button" onClick={onVoice}><Mic size={16}/><span>Falar</span></button><button className="button primary" disabled={!question.trim()}><span>Continuar</span><ArrowRight size={15}/></button></form>
    <p className="central-quick-hint">Uma frase basta. O Clareia preenche o que reconhecer e pede só o que faltar. Você confere antes de salvar.</p>
    <div className="central-assist-prompts" aria-label="Perguntas sugeridas"><span>Orientações rápidas:</span>{suggestedQuestions.map(text => <button type="button" key={text} onClick={() => askQuestion(text)}>{text}</button>)}</div>
    {answer && <div className="central-answer" role="status"><strong>O que seus registros mostram</strong><p>{answer}</p><small>As orientações usam os dados que você informou. Confira os lançamentos antes de decidir.</small></div>}
  </section>;
}
