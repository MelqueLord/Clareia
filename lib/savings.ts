import type { FinanceData, SavingsGoal, Space } from './model';
import { money } from './model';

export function goalSaved(data: FinanceData, goal: SavingsGoal, asOf: string) {
  return Math.max(0, data.transactions
    .filter(t => t.goalId === goal.id && t.space === goal.space && t.paid && t.dueDate <= asOf && ['reserve', 'release'].includes(t.type))
    .reduce((sum, t) => sum + (t.type === 'reserve' ? t.amount : -t.amount), 0));
}

export function goalsFor(data: FinanceData, space: Space) {
  return (data.savingsGoals || []).filter(goal => goal.space === space);
}

export function goalPlan(data: FinanceData, goal: SavingsGoal, asOf: string) {
  const saved = goalSaved(data, goal, asOf);
  const remaining = Math.max(0, goal.target - saved);
  const today = new Date(asOf + 'T12:00:00');
  const deadline = new Date(goal.targetDate + 'T12:00:00');
  const months = Math.max(1, (deadline.getFullYear() - today.getFullYear()) * 12 + deadline.getMonth() - today.getMonth() + (deadline.getDate() >= today.getDate() ? 1 : 0));
  return { saved, remaining, progress: Math.min(100, Math.round(saved / goal.target * 100)), monthly: Math.ceil(remaining / months), months, complete: saved >= goal.target };
}

export function goalSummary(data: FinanceData, space: Space, asOf: string) {
  const goals = goalsFor(data, space);
  if (!goals.length) return 'Você ainda não criou uma meta de economia. Em Planejamento, defina o que quer alcançar e quando.';
  return goals.map(goal => {
    const plan = goalPlan(data, goal, asOf);
    return plan.complete
      ? `${goal.name}: meta alcançada, com ${money(plan.saved)} separados.`
      : `${goal.name}: ${money(plan.saved)} de ${money(goal.target)} separados (${plan.progress}%). Faltam ${money(plan.remaining)}; o ritmo sugerido é ${money(plan.monthly)} por mês até ${new Date(goal.targetDate + 'T12:00:00').toLocaleDateString('pt-BR')}.`;
  }).join('\n');
}
