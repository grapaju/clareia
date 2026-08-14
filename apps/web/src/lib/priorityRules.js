
export function evaluateTaskPriority(task) {
  const now = new Date();
  const deadline = task.deadline ? new Date(task.deadline) : null;
  const daysDiff = deadline ? Math.ceil((deadline - now) / (1000 * 60 * 60 * 24)) : null;
  
  const lastUpdated = task.lastUpdated ? new Date(task.lastUpdated) : new Date(task.createdAt || now);
  const daysSinceUpdate = Math.ceil((now - lastUpdated) / (1000 * 60 * 60 * 24));
  
  const indicators = {
    isOverdue: false,
    isUrgent: false,
    isQuick: false,
    isAtRisk: false,
    needsBreaking: false,
    priorityGroup: 'normal'
  };
  
  // Rule 1: Overdue
  if (deadline && daysDiff < 0) {
    indicators.isOverdue = true;
    indicators.priorityGroup = 'overdue';
  }
  
  // Rule 2: Deadline today or tomorrow
  if (deadline && daysDiff >= 0 && daysDiff <= 1) {
    indicators.isUrgent = true;
    if (indicators.priorityGroup !== 'overdue') {
      indicators.priorityGroup = 'today-without-fail';
    }
  }
  
  // Rule 3: Billing tasks due in ≤3 days
  if (task.type === 'cobranca' && deadline && daysDiff >= 0 && daysDiff <= 3) {
    indicators.isUrgent = true;
    if (indicators.priorityGroup !== 'overdue') {
      indicators.priorityGroup = 'today-without-fail';
    }
  }
  
  // Rule 4: Meeting tasks in ≤3 days
  if (task.type === 'reuniao' && deadline && daysDiff >= 0 && daysDiff <= 3) {
    indicators.isUrgent = true;
    if (indicators.priorityGroup !== 'overdue') {
      indicators.priorityGroup = 'today-without-fail';
    }
  }
  
  // Rule 5: Task paused >7 days
  if (task.status === 'adiado' && daysSinceUpdate > 7) {
    indicators.isAtRisk = true;
    if (indicators.priorityGroup === 'normal') {
      indicators.priorityGroup = 'at-risk';
    }
  }
  
  // Rule 6: Quick tasks (≤30 min)
  if (task.estimatedTime && task.estimatedTime <= 30) {
    indicators.isQuick = true;
    if (indicators.priorityGroup === 'normal') {
      indicators.priorityGroup = 'quick-tasks';
    }
  }
  
  // Rule 7: No next action
  if (!task.nextAction || task.nextAction.trim() === '') {
    indicators.needsBreaking = true;
    if (indicators.priorityGroup === 'normal') {
      indicators.priorityGroup = 'needs-breaking';
    }
  }
  
  // Rule 8: High importance + high urgency
  if (task.importance === 'high' && task.urgency === 'high') {
    if (indicators.priorityGroup === 'normal') {
      indicators.priorityGroup = 'today-without-fail';
    }
  }
  
  // Rule 9: Important this week (deadline in 2-7 days)
  if (deadline && daysDiff >= 2 && daysDiff <= 7 && task.importance === 'high') {
    if (indicators.priorityGroup === 'normal') {
      indicators.priorityGroup = 'important-this-week';
    }
  }
  
  // Rule 10: Awaiting someone
  if (task.status === 'aguardando') {
    indicators.priorityGroup = 'awaiting-someone';
  }
  
  return indicators;
}

export function getPriorityGroupLabel(group) {
  const labels = {
    'overdue': 'Atrasado',
    'today-without-fail': 'Hoje sem falta',
    'important-this-week': 'Importante nesta semana',
    'quick-tasks': 'Tarefas rápidas',
    'at-risk': 'Em risco',
    'awaiting-someone': 'Aguardando alguém',
    'needs-breaking': 'Muito grande: dividir em passos',
    'normal': 'Outras tarefas'
  };
  
  return labels[group] || 'Outras tarefas';
}

export function getRecommendedTask(tasks) {
  if (!tasks || tasks.length === 0) return null;
  
  const activeTasks = tasks.filter(t => 
    t.status !== 'concluido' && 
    t.status !== 'adiado' &&
    t.status !== 'aguardando'
  );
  
  if (activeTasks.length === 0) return null;
  
  const scoredTasks = activeTasks.map(task => {
    const indicators = evaluateTaskPriority(task);
    let score = 0;
    
    if (indicators.isOverdue) score += 100;
    if (indicators.isUrgent) score += 50;
    if (indicators.priorityGroup === 'today-without-fail') score += 40;
    if (task.importance === 'high') score += 30;
    if (task.urgency === 'high') score += 20;
    if (indicators.isQuick) score += 10;
    
    if (task.nextAction && task.nextAction.trim() !== '') score += 15;
    
    const hour = new Date().getHours();
    if (hour >= 16 && task.energyNeeded === 'low') score += 5;
    
    return { task, score, indicators };
  });
  
  scoredTasks.sort((a, b) => b.score - a.score);
  
  return scoredTasks[0];
}

export function getRecommendationReason(task, indicators) {
  if (indicators.isOverdue) return "Esta tarefa está atrasada e precisa de atenção imediata.";
  if (indicators.isUrgent && task.type === 'cobranca') return "Prazo de cobrança se aproximando.";
  if (indicators.isUrgent && task.type === 'reuniao') return "A reunião está próxima.";
  if (indicators.priorityGroup === 'today-without-fail') return "Prioridade alta para ser concluída hoje.";
  if (indicators.isQuick) return "Tarefa rápida (menos de 30 min).";
  if (task.importance === 'high' && task.urgency === 'high') return "Importante e urgente.";
  
  return "Próxima tarefa recomendada baseada nas suas prioridades.";
}
