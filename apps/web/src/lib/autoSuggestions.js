
export function suggestTaskType(taskText) {
  const text = taskText.toLowerCase();
  if (text.includes('cobrar') || text.includes('fatura') || text.includes('pagamento')) return 'Cobrança';
  if (text.includes('reunião') || text.includes('call') || text.includes('falar com')) return 'Reunião';
  if (text.includes('desenvolver') || text.includes('código') || text.includes('sistema') || text.includes('api')) return 'Desenvolvimento';
  if (text.includes('site') || text.includes('página') || text.includes('landing page')) return 'Site';
  if (text.includes('ads') || text.includes('campanha') || text.includes('anúncio')) return 'Google Ads';
  if (text.includes('cliente') || text.includes('responder') || text.includes('suporte')) return 'Atendimento';
  if (text.includes('planilha') || text.includes('relatório') || text.includes('organizar')) return 'Administrativo';
  if (text.includes('médico') || text.includes('comprar') || text.includes('casa')) return 'Pessoal';
  return 'Outro';
}

export function suggestProject(taskText) {
  const text = taskText.toLowerCase();
  if (text.includes('leone')) return 'Leone';
  if (text.includes('corcril')) return 'Corcril';
  if (text.includes('expocentro')) return 'Expocentro';
  if (text.includes('idtpr')) return 'IDTPR';
  if (text.includes('torion')) return 'Torion';

  if (/(cobran[çc]a|fatura|fluxo de caixa|boleto|nota fiscal|pagamento)/i.test(taskText)) {
    return 'Administrativo';
  }

  return 'Pessoal';
}

export function suggestTimeEstimate(taskText) {
  const text = taskText.toLowerCase();
  
  // Specific domains
  if (text.includes('reunião')) return 60;
  if (text.includes('cobrança') || text.includes('fatura')) return 20;
  if (text.includes('ads') || text.includes('campanha')) return 60;
  if (text.includes('site') || text.includes('página')) return 120;
  if (text.includes('crm') || text.includes('sistema')) return 180;

  // Verbs
  if (text.includes('enviar') || text.includes('responder') || text.includes('verificar')) return 20;
  if (text.includes('revisar') || text.includes('atualizar')) return 45;
  if (text.includes('criar') || text.includes('configurar') || text.includes('preparar')) return 90;
  if (text.includes('desenvolver') || text.includes('implementar')) return 180;
  
  return 30; // default
}

export function suggestNextAction(taskText) {
  const text = taskText.toLowerCase();
  if (text.includes('reunião')) return 'Listar pauta e separar materiais';
  if (text.includes('cobrar') || text.includes('fatura')) return 'Verificar valores e gerar link de pagamento';
  if (text.includes('site')) return 'Abrir o editor/código e revisar o layout atual';
  if (text.includes('ads') || text.includes('campanha')) return 'Abrir o painel do Google Ads e checar métricas';
  return 'Definir o primeiro passo prático para começar';
}

export function shouldBreakDown(timeEstimate) {
  return timeEstimate > 90;
}

export function suggestPriority(taskText, dueDateStr, status, updatedAtStr) {
  const text = taskText.toLowerCase();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let isOverdue = false;
  let isTodayOrTomorrow = false;
  let daysDiff = null;

  if (dueDateStr) {
    const dueDate = new Date(dueDateStr);
    dueDate.setHours(0, 0, 0, 0);
    const diffTime = dueDate - today;
    daysDiff = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (daysDiff < 0) isOverdue = true;
    if (daysDiff === 0 || daysDiff === 1) isTodayOrTomorrow = true;
  }

  const updatedDate = updatedAtStr ? new Date(updatedAtStr) : new Date();
  const stalledDays = Math.ceil((today - updatedDate) / (1000 * 60 * 60 * 24));

  if (isOverdue) return { level: 'Alta', urgency: 'Alta', reason: 'Prazo ultrapassado', color: 'red' };
  if (isTodayOrTomorrow) return { level: 'Alta', urgency: 'Alta', reason: 'Prazo muito próximo', color: 'orange' };
  
  const type = suggestTaskType(taskText);
  if ((type === 'Cobrança' || type === 'Reunião') && daysDiff !== null && daysDiff <= 3) {
    return { level: 'Alta', urgency: 'Média', reason: `${type} em breve`, color: 'orange' };
  }

  if (status === 'Backlog' || stalledDays >= 7) {
    return { level: 'Média', urgency: 'Baixa', reason: 'Parada há mais de 7 dias', color: 'yellow' };
  }

  if (text.includes('urgente') || text.includes('hoje')) {
    return { level: 'Alta', urgency: 'Alta', reason: 'Palavra-chave urgente', color: 'red' };
  }

  return { level: 'Média', urgency: 'Média', reason: 'Prioridade normal', color: 'blue' };
}

export function suggestSubtasks(taskTitle, timeEstimate) {
  if (timeEstimate <= 45) return [];
  
  const title = taskTitle.toLowerCase();
  if (title.includes('crm') || title.includes('sistema')) {
    return [
      { text: 'Abrir projeto no servidor', time: 15 },
      { text: 'Testar login e permissões', time: 15 },
      { text: 'Verificar banco de dados', time: 30 },
      { text: 'Listar telas prontas', time: 30 },
      { text: 'Anotar o que falta', time: 30 },
      { text: 'Definir próximo passo técnico', time: 15 }
    ];
  }
  
  if (title.includes('site') || title.includes('landing page')) {
    return [
      { text: 'Revisar referências visuais', time: 20 },
      { text: 'Criar rascunho (wireframe)', time: 40 },
      { text: 'Adicionar textos', time: 30 },
      { text: 'Ajustar imagens', time: 30 }
    ];
  }

  // Generic breakdown
  return [
    { text: 'Reunir informações necessárias', time: 15 },
    { text: 'Fazer um rascunho inicial', time: 30 },
    { text: 'Desenvolver o foco principal', time: Math.floor(timeEstimate / 2) },
    { text: 'Revisar e concluir', time: 20 }
  ];
}

export function autoSuggestAll(taskText, dueDate = null) {
  const timeEstimate = suggestTimeEstimate(taskText);
  return {
    taskType: suggestTaskType(taskText),
    project: suggestProject(taskText),
    timeEstimate,
    nextAction: suggestNextAction(taskText),
    shouldBreakDown: shouldBreakDown(timeEstimate),
    priority: suggestPriority(taskText, dueDate, null, null),
    subtasks: suggestSubtasks(taskText, timeEstimate)
  };
}
