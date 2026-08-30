import { getScheduledLabelForTask } from '@/lib/schedulingRules.js';
import { parseLocalDate } from '@/lib/localDate.js';
import { normalizeTaskStatus, TASK_STATUS } from '@/lib/taskExecution.js';

function stripAccents(value = '') {
  return value
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function normalizeEnergy(value = '') {
  const text = stripAccents(value).trim();
  if (text.includes('alta')) return 'alta';
  if (text.includes('baixa')) return 'baixa';
  return 'média';
}

function minutesFromCheckInTempo(checkInTempo = '') {
  const tempo = checkInTempo.toString().trim().toLowerCase();
  if (tempo === '30 min' || tempo === '30min') return 30;
  if (tempo === '1h') return 60;
  if (tempo === '2h') return 120;
  if (tempo === '4h') return 240;
  if (tempo === 'dia inteiro') return 480;
  return 120;
}

function parseDate(value) {
  return value ? parseLocalDate(value) : null;
}

function dateDiffInDays(a, b) {
  return Math.round((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function isBusinessHours(date) {
  const hour = date.getHours();
  return !isWeekend(date) && hour >= 8 && hour < 18;
}

function isCommercialTask(task) {
  const type = stripAccents(task.taskType || task.type || '');
  const text = stripAccents(`${task.title || ''} ${task.project || ''}`);
  return (
    Boolean(task.isBusinessHoursOnly) ||
    Boolean(task.isClientTask) ||
    /atendimento|contato|cobran|reuni/.test(type) ||
    /falar com|conversar com|entrar em contato|ligar|mensagem|cliente|torion|leone|corcril|expocentro/.test(text)
  );
}

function isUrgent(task, today) {
  const due = parseDate(task.dueDate || task.dataLimite);
  if (!due) return false;
  return dateDiffInDays(due, today) <= 1;
}

function normalizeExecutionDifficulty(value = '') {
  const text = stripAccents(value).trim();
  if (text.includes('rápida') || text.includes('rapida')) return 'rápida';
  if (text.includes('foco')) return 'foco';
  if (text.includes('atrito')) return 'atrito';
  if (text.includes('grande')) return 'grande';
  return 'direta';
}

function getTaskSearchText(task) {
  return stripAccents([
    task?.title,
    task?.project,
    task?.taskType,
    task?.nextAction,
    task?.firstStep,
    task?.description,
    task?.objetivo,
    task?.motivo
  ].filter(Boolean).join(' '));
}

function isManualHighPriority(task) {
  const raw = stripAccents(`${task?.priority || ''} ${task?.priorityGroup || ''} ${task?.importance || ''} ${task?.urgency || ''}`);
  return /maxima|alta|high/.test(raw);
}

function isInternalClareiaTask(task) {
  const project = stripAccents(task?.project || '');
  return project === 'clareia';
}

function getClareiaImprovementLevel(task) {
  const source = stripAccents(`${task?.description || ''} ${task?.nextAction || ''} ${task?.title || ''}`);
  const manualHigh = isManualHighPriority(task);
  if (manualHigh) return 'alta';
  if (/prioridade declarada:\s*alta/.test(source)) return 'alta';
  if (/prioridade declarada:\s*media/.test(source)) return 'media';
  return 'baixa';
}

function getInternalClareiaPenalty(task) {
  const level = getClareiaImprovementLevel(task);
  if (level === 'alta') return 12;
  if (level === 'media') return 35;
  return 55;
}

function isFinancialTask(task) {
  const text = getTaskSearchText(task);
  return /(cobranca|fatura|fluxo de caixa|boleto|nota fiscal|contas a receber|recebimento)/.test(text);
}

function isBudgetTask(task) {
  const text = getTaskSearchText(task);
  return /(orcamento|proposta|enviar orcamento|envio ao diretor|aprovacao)/.test(text);
}

function isMoneyContractDecisionTask(task) {
  const text = getTaskSearchText(task);
  return /(dinheiro|contrato|aprovacao|decisao|fechamento|assinatura|pagamento|recebimento)/.test(text)
    || isFinancialTask(task)
    || isBudgetTask(task);
}

function isAccountantAccessTask(task) {
  const text = getTaskSearchText(task);
  return /(contador|documento|acesso|gov\.br|certificado|login|senha|credencial)/.test(text);
}

function isClientWaitingTask(task) {
  const text = getTaskSearchText(task);
  return /(cliente aguardando|diretor aguardando|contador aguardando|aguardando retorno|cliente esperando|diretor esperando|contador esperando)/.test(text);
}

function isTechnicalTask(task) {
  const text = getTaskSearchText(task);
  return /(crm|sistema|servidor|testar sistema|desenvolvimento|implementacao|melhoria tecnica|infra|deploy|api)/.test(text);
}

function isCampaignFollowUpTask(task) {
  const text = getTaskSearchText(task);
  return /(acompanhar campanha|avaliar campanha|monitorar resultados|monitorar campanha|ver se esta fazendo efeito|ver se funcionou)/.test(text)
    || ((/acompanhar|avaliar|monitorar|resultado|efeito/.test(text)) && /campanha|google ads|ads|anuncio/.test(text));
}

function isGoogleAdsBuildTask(task) {
  const text = getTaskSearchText(task);
  return /google ads|grupo de recursos|campanha/.test(text)
    && /criar|ajustar|configurar|publicar/.test(text)
    && !isCampaignFollowUpTask(task);
}

function hasExplicitUrgentDeadline(task, now) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const due = parseDate(task.dueDate || task.dataLimite);
  if (due) {
    const diff = dateDiffInDays(due, today);
    if (diff <= 1) return true;
  }

  return /\bhoje\b|\bamanha\b/.test(getTaskSearchText(task));
}

function isFutureScheduled(task, now) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const scheduled = parseDate(task.scheduledDate || task.dataSugeridaExecucao);
  return Boolean(scheduled && scheduled > today);
}

function isBusinessPriorityTask(task, now) {
  return isFinancialTask(task)
    || isBudgetTask(task)
    || isMoneyContractDecisionTask(task)
    || isClientWaitingTask(task)
    || hasExplicitUrgentDeadline(task, now);
}

function buildWhenToExecute(task, now) {
  return getScheduledLabelForTask(task, now) || 'Esta semana';
}

function canRunNow(task, now, checkInEnergy, availableMinutes) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const scheduled = parseDate(task.scheduledDate || task.dataSugeridaExecucao);
  const taskEnergy = normalizeEnergy(task.energiaNecessaria || task.energyNeeded);
  const estimate = Number(task.timeEstimate || task.estimatedMinutes || 30);
  const commercial = isCommercialTask(task);
  const difficulty = normalizeExecutionDifficulty(task.executionDifficulty);

  if (scheduled && scheduled > today) {
    return false;
  }

  if (isCampaignFollowUpTask(task) && !hasExplicitUrgentDeadline(task, now)) {
    return false;
  }

  if (commercial && !isBusinessHours(now) && !isUrgent(task, today)) {
    return false;
  }

  if (isWeekend(now) && commercial && !isUrgent(task, today)) {
    return false;
  }

  if (checkInEnergy === 'baixa' && taskEnergy === 'alta') {
    return false;
  }

  if (estimate > availableMinutes) {
    return false;
  }

  if (difficulty === 'grande') {
    return false;
  }

  return true;
}

function taskScore(task, now, checkInEnergy) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const due = parseDate(task.dueDate || task.dataLimite);
  const estimate = Number(task.timeEstimate || task.estimatedMinutes || 30);
  const taskEnergy = normalizeEnergy(task.energiaNecessaria || task.energyNeeded);
  const difficulty = normalizeExecutionDifficulty(task.executionDifficulty);

  let score = 0;

  if (isFinancialTask(task)) score += 50;
  if (isBudgetTask(task)) score += 45;

  if (due) {
    const dueDiff = dateDiffInDays(due, today);
    if (dueDiff === 0) score += 40;
    else if (dueDiff === 1) score += 35;
    else if (dueDiff < 0) score += 45;
  }

  if (isMoneyContractDecisionTask(task)) score += 30;
  if (isAccountantAccessTask(task)) score += 25;
  if (isClientWaitingTask(task)) score += 20;
  if (estimate <= 45) score += 15;
  if (isBudgetTask(task) && /diretor/.test(getTaskSearchText(task))) score += 25;

  if (isTechnicalTask(task) && !hasExplicitUrgentDeadline(task, now)) score -= 20;
  if (isTechnicalTask(task) && estimate > 90) score -= 25;
  if (isCampaignFollowUpTask(task)) score -= 30;
  if (isGoogleAdsBuildTask(task)) score -= 15;
  if (isFutureScheduled(task, now)) score -= 50;

  if (isCommercialTask(task) && isBusinessHours(now)) score += 10;
  if (isCommercialTask(task) && !isBusinessHours(now) && !hasExplicitUrgentDeadline(task, now)) score -= 10;

  if (checkInEnergy === 'baixa') {
    if (taskEnergy === 'baixa') score += 20;
    if (taskEnergy === 'média') score += 8;
    if (taskEnergy === 'alta') score -= 40;
  }

  if (checkInEnergy === 'alta' && taskEnergy === 'alta') score += 12;

  if (difficulty === 'rápida') score += 8;
  if (difficulty === 'direta') score += 3;
  if (difficulty === 'foco' && checkInEnergy === 'alta') score += 6;
  if (difficulty === 'atrito') score -= 8;
  if (difficulty === 'grande') score -= 60;

  if ((task.nextAction || '').trim()) score += 6;

  if (isInternalClareiaTask(task)) {
    score -= getInternalClareiaPenalty(task);
  }

  return score;
}

function normalizeTask(task, now) {
  return {
    ...task,
    whenToExecute: buildWhenToExecute(task, now),
    firstAction: task.nextAction || task.firstStep || task.microtarefas?.[0]?.title || task.microtarefas?.[0]?.descricao || '',
    priorityScore: taskScore(task, now, 'média')
  };
}

export function reorganizeTasksByEnergy(tasks, checkIn) {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return { recommended: null, agora: [], depois: [], seSobrar: [], alertasImportantes: [], fallbackMessage: '' };
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const checkInEnergy = normalizeEnergy(checkIn?.energia || 'média');
  const checkInMind = stripAccents(checkIn?.mente || 'normal');
  const availableMinutes = Math.max(20, Math.round(minutesFromCheckInTempo(checkIn?.tempo || '2h') * 0.85));

  const activeTasks = tasks.filter((task) => {
    const status = normalizeTaskStatus(task.status);
    return status !== TASK_STATUS.CONCLUIDA && status !== TASK_STATUS.ARQUIVADA && status !== TASK_STATUS.PAUSADA;
  });

  const alerts = activeTasks
    .filter((task) => {
      const due = parseDate(task.dueDate || task.dataLimite);
      const scheduled = parseDate(task.scheduledDate || task.dataSugeridaExecucao);
      return Boolean((due && due <= today) || (scheduled && scheduled < today));
    })
    .map((task) => normalizeTask(task, now));

  let candidatesNow = activeTasks.filter((task) => canRunNow(task, now, checkInEnergy, availableMinutes));

  if (checkInMind === 'sobrecarregada') {
    candidatesNow = candidatesNow
      .filter((task) => !isTechnicalTask(task) || isManualHighPriority(task))
      .slice(0, 4);
  }

  const hasBusinessUrgentCandidate = candidatesNow.some((task) => isBusinessPriorityTask(task, now));
  if (hasBusinessUrgentCandidate) {
    candidatesNow = candidatesNow.filter((task) => isBusinessPriorityTask(task, now) || isManualHighPriority(task));
  }

  const scoredNow = candidatesNow
    .map((task) => ({ task: normalizeTask(task, now), score: taskScore(task, now, checkInEnergy) }))
    .sort((a, b) => b.score - a.score);

  const recommended = scoredNow[0]?.task || null;

  const remainingNow = scoredNow.slice(1).map((entry) => entry.task);

  const laterCandidates = activeTasks
    .filter((task) => !recommended || task.id !== recommended.id)
    .filter((task) => !remainingNow.some((entry) => entry.id === task.id))
    .map((task) => ({ task: normalizeTask(task, now), score: taskScore(task, now, checkInEnergy) }))
    .sort((a, b) => b.score - a.score);

  const nowLimit = checkInMind === 'sobrecarregada' ? 2 : 4;
  const laterLimit = checkInMind === 'sobrecarregada' ? 3 : 6;
  const spareLimit = checkInMind === 'sobrecarregada' ? 2 : 6;

  const agora = remainingNow.slice(0, nowLimit);
  const laterTasks = laterCandidates.map((entry) => entry.task);

  const futureFollowUps = laterTasks.filter((task) => isCampaignFollowUpTask(task) || isFutureScheduled(task, now));
  const nearTasks = laterTasks.filter((task) => !futureFollowUps.some((future) => future.id === task.id));

  const depois = nearTasks
    .filter((task) => !isTechnicalTask(task) && !isGoogleAdsBuildTask(task))
    .slice(0, laterLimit);
  const restantes = nearTasks.filter((task) => !depois.some((entry) => entry.id === task.id));
  const seSobrar = [...restantes, ...futureFollowUps].slice(0, spareLimit);

  const fallbackMessage = recommended
    ? ''
    : 'Nenhuma tarefa pesada para agora. Você pode revisar o plano ou preparar algo leve.';

  return {
    recommended,
    agora,
    depois,
    seSobrar,
    alertasImportantes: alerts,
    fallbackMessage
  };
}

export function getTodayCapacity(tasks, checkIn) {
  const availableMinutes = Math.max(20, Math.round(minutesFromCheckInTempo(checkIn?.tempo || '2h') * 0.85));
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const plannedMinutes = (Array.isArray(tasks) ? tasks : [])
    .filter((task) => {
      const status = (task.status || '').toString().toLowerCase();
      if (status === 'concluída' || status === 'concluida' || status === 'backlog') return false;

      const scheduledDate = parseDate(task.scheduledDate || task.dataSugeridaExecucao);
      return status === 'hoje' || (scheduledDate && scheduledDate.getTime() === todayStart.getTime());
    })
    .reduce((total, task) => total + Number(task.timeEstimate || task.estimatedMinutes || 30), 0);

  return {
    availableMinutes,
    plannedMinutes,
    remainingMinutes: Math.max(0, availableMinutes - plannedMinutes),
    isOverCapacity: plannedMinutes > availableMinutes
  };
}
