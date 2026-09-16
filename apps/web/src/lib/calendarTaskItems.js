import { toIsoDate } from './localDate.js';
import { filterOperationalTaskReferences, isTaskOpenStatus, isTaskOperational } from './taskExecution.js';

export function buildTaskCalendarItems(tasks = [], focusSessions = []) {
  const operationalTasks = tasks.filter(isTaskOperational);
  const openTasks = operationalTasks.filter((task) => isTaskOpenStatus(task.status));

  const taskItems = openTasks
    .filter((task) => toIsoDate(task.scheduledDate || task.dataSugeridaExecucao))
    .map((task) => ({
      id: `task-${task.id}`,
      title: task.title,
      projectId: task.project || 'Pessoal',
      type: 'task',
      date: toIsoDate(task.scheduledDate || task.dataSugeridaExecucao),
      period: task.scheduledPeriod || task.periodoSugerido || 'manhã',
      estimatedMinutes: Number(task.timeEstimate || 30),
      status: task.status || 'Pendente',
      sourceId: task.id,
      sourceType: 'task',
    }));

  const dueItems = openTasks
    .filter((task) => toIsoDate(task.dueDate || task.dataLimite))
    .map((task) => ({
      id: `due-${task.id}`,
      title: `Prazo: ${task.title}`,
      projectId: task.project || 'Pessoal',
      type: 'prazo',
      date: toIsoDate(task.dueDate || task.dataLimite),
      estimatedMinutes: 0,
      status: task.status || 'Pendente',
      sourceId: task.id,
      sourceType: 'task_due',
    }));

  const routineItems = openTasks
    .filter((task) => ['Semanal', 'Mensal'].includes(task.recurrenceFrequency))
    .map((task) => ({
      id: `routine-${task.id}`,
      title: `Rotina: ${task.title}`,
      projectId: task.project || 'Pessoal',
      type: 'rotina',
      date: toIsoDate(task.scheduledDate || task.dataSugeridaExecucao),
      period: task.scheduledPeriod || 'manhã',
      estimatedMinutes: Number(task.timeEstimate || 30),
      status: task.status || 'Ativa',
      sourceId: task.id,
      sourceType: 'task_routine',
    }))
    .filter((item) => item.date);

  const focusItems = filterOperationalTaskReferences(focusSessions, openTasks)
    .filter((session) => toIsoDate(session.startedAt))
    .map((session) => ({
      id: `focus-${session.id}`,
      title: session.title || 'Bloco de foco',
      projectId: session.projectId || 'Pessoal',
      type: 'foco',
      date: toIsoDate(session.startedAt),
      startTime: session.startedAt ? new Date(session.startedAt).toTimeString().slice(0, 5) : '',
      endTime: session.endedAt ? new Date(session.endedAt).toTimeString().slice(0, 5) : '',
      estimatedMinutes: Number(session.durationMinutes || 0),
      status: session.endedAt ? 'Concluído' : 'Planejado',
      sourceId: session.id,
      taskId: session.taskId || '',
      sourceType: 'work_session',
    }));

  return { taskItems, dueItems, routineItems, focusItems };
}