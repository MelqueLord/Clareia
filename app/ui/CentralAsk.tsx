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
    <div className="central-ask-heading"><span className="guided-icon"><Sparkles size={19}/></span><div><span className="eyebrow">SEU ASSISTENTE FINANCEIRO</span><h2>{compact ? 'Como posso ajudar agora?' : 'Seu dinheiro, acompanhado com inteligência.'}</h2><p>{compact ? 'Escolha uma ação ou conte em uma frase. Você confere antes de salvar.' : 'Eu organizo seus dados financeiros e ajudo você a entender o mês e escolher um próximo passo.'}</p></div></div>
    {compact && <div className="central-quick-actions" aria-label="Ações rápidas"><button className="button secondary" type="button" onClick={() => onQuickTransaction('expense')}><ArrowUpRight size={16}/><span>Registrar gasto</span></button><button className="button secondary" type="button" onClick={() => onQuickTransaction('income')}><ArrowDownLeft size={16}/><span>Registrar entrada</span></button></div>}
    <form className="central-ask-form" onSubmit={ask}><input aria-label="Digite uma movimentação ou pergunta financeira" value={question} onChange={event => setQuestion(event.target.value)} placeholder="Ex.: paguei R$ 48 no mercado no Pix"/><button className="button secondary" type="button" onClick={onVoice}><Mic size={16}/><span>Falar</span></button><button className="button primary" disabled={!question.trim()}><span>{isFinancialMovement(question) ? 'Preparar lançamento' : 'Perguntar'}</span><ArrowRight size={15}/></button></form>
    <p className="central-quick-hint">Escreva um gasto ou uma dúvida. O Clareia prepara o que reconhecer e pede só o que faltar.</p>
    <details className="central-assist-prompts"><summary>Perguntas rápidas <ChevronDown size={15}/></summary><div className="central-prompt-list">{suggestedQuestions.map(text => <button type="button" key={text} onClick={() => askQuestion(text)}>{text}</button>)}</div></details>
    {answer && <div className="central-answer" role="status"><strong>O que seus registros mostram</strong><p>{answer}</p><small>As orientações usam os dados que você informou. Confira os lançamentos antes de decidir.</small></div>}
  </section>;
}
