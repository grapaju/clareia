
import React, { createContext, useState, useEffect } from 'react';
import pb from '@/lib/pocketbaseClient.js';
import { getCurrentAccountId } from '@/lib/pocketbaseClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';
import { getNextRecurringDate, getStatusForScheduledDate, resetMicrotasks } from '@/lib/recurrenceLogic.js';
import { appendProjectHistory } from '@/services/projectHistoryService.js';
import { addTaskHistoryEvent } from '@/services/taskHistoryService.js';
import { addManualWorkSession, finishActiveWorkSessionForTask, getActiveWorkSession, listWorkSessions, startTimerWorkSession } from '@/services/workSessionService.js';
import {
  completeAllMicrotasks,
  getTaskMicrotaskProgress,
  isTaskCompletedStatus,
  normalizeMicrotasks,
  normalizeTaskStatus,
  TASK_STATUS
} from '@/lib/taskExecution.js';

export const TaskContext = createContext();

const CHECKIN_STORAGE_PREFIX = 'clareia.dailyCheckIn';

function getTodayIso() {
  return new Date().toISOString().split('T')[0];
}

function normalizeCheckInValue(value, field) {
  const text = (value || '').toString().trim().toLowerCase();

  if (field === 'energia') {
    if (text === 'alta') return 'alta';
    if (text === 'baixa') return 'baixa';
    return 'média';
  }

  if (field === 'mente') {
    if (text === 'tranquila') return 'tranquila';
    if (text === 'focada') return 'tranquila';
    if (text === 'sobrecarregada') return 'sobrecarregada';
    return 'normal';
  }

  if (field === 'tempo') {
    if (text === '30 min' || text === '30min') return '30min';
    if (text === '1h') return '1h';
    if (text === '2h') return '2h';
    if (text === '4h') return '4h';
    if (text === 'dia inteiro') return 'dia inteiro';
    return '2h';
  }

  return text;
}

export function TaskProvider({ children }) {
  const { currentUser } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);
  
  // Daily check-in state
  const [checkIn, setCheckIn] = useState(null);
  const [isCheckInEditing, setIsCheckInEditing] = useState(true);

  const getCheckInStorageKey = () => {
    if (!currentUser?.id) return null;
    return `${CHECKIN_STORAGE_PREFIX}.${currentUser.id}`;
  };

  const normalizeTaskRecord = (record) => {
    if (!record) return record;
    return {
      ...record,
      status: normalizeTaskStatus(record.status),
      microtarefas: normalizeMicrotasks(record.microtarefas, record.id)
    };
  };

  const normalizeTaskPayload = (taskData, taskId = '') => {
    const payload = { ...taskData };
    if (payload.status !== undefined) {
      payload.status = normalizeTaskStatus(payload.status);
    }
    if (payload.microtarefas !== undefined) {
      payload.microtarefas = normalizeMicrotasks(payload.microtarefas, taskId);
    }
    return payload;
  };

  const fetchTasks = async () => {
    if (!currentUser) return;
    setIsLoading(true);
    try {
      const records = await pb.collection('tasks').getFullList({
        sort: '-created',
        $autoCancel: false
      });
      setTasks(records.map((record) => normalizeTaskRecord(record)));
    } catch (error) {
      console.error("Erro ao buscar tarefas:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!currentUser) {
      setTasks([]);
      setIsLoading(false);
      return;
    }
    fetchTasks();
  }, [currentUser]);

  const refreshTasks = async () => {
    await fetchTasks();
  };

  useEffect(() => {
    if (!currentUser?.id) {
      setCheckIn(null);
      setIsCheckInEditing(true);
      return;
    }

    const key = getCheckInStorageKey();
    const today = getTodayIso();
    if (!key) {
      setCheckIn(null);
      setIsCheckInEditing(true);
      return;
    }

    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        setCheckIn(null);
        setIsCheckInEditing(true);
        return;
      }

      const parsed = JSON.parse(raw);
      if (parsed?.date !== today) {
        setCheckIn(null);
        setIsCheckInEditing(true);
        return;
      }

      setCheckIn({
        energia: normalizeCheckInValue(parsed.energia, 'energia'),
        mente: normalizeCheckInValue(parsed.mente, 'mente'),
        tempo: normalizeCheckInValue(parsed.tempo, 'tempo'),
        prioridadePrincipal: String(parsed.prioridadePrincipal || '').trim(),
        date: parsed.date,
        updatedAt: parsed.updatedAt || new Date().toISOString()
      });
      setIsCheckInEditing(false);
    } catch {
      setCheckIn(null);
      setIsCheckInEditing(true);
    }
  }, [currentUser?.id]);

  const saveDailyCheckIn = (payload) => {
    const today = getTodayIso();
    const normalized = {
      energia: normalizeCheckInValue(payload?.energia, 'energia'),
      mente: normalizeCheckInValue(payload?.mente, 'mente'),
      tempo: normalizeCheckInValue(payload?.tempo, 'tempo'),
      prioridadePrincipal: String(payload?.prioridadePrincipal || '').trim(),
      date: today,
      updatedAt: new Date().toISOString()
    };

    const key = getCheckInStorageKey();
    if (key) {
      localStorage.setItem(key, JSON.stringify(normalized));
    }

    setCheckIn(normalized);
    setIsCheckInEditing(false);
  };

  const openCheckInEditor = () => {
    setIsCheckInEditing(true);
  };

  const clearDailyCheckIn = () => {
    const key = getCheckInStorageKey();
    if (key) {
      localStorage.removeItem(key);
    }
    setCheckIn(null);
    setIsCheckInEditing(true);
  };

  const hasTodayCheckIn = !!(checkIn?.date && checkIn.date === getTodayIso());

  const addTask = async (taskData) => {
    try {
      const accountId = currentUser?.currentAccountId || getCurrentAccountId();
      const payload = normalizeTaskPayload({
        ...taskData,
        status: taskData?.status || TASK_STATUS.PENDENTE,
        userId: currentUser?.id,
        ...(accountId ? { accountId } : {})
      });
      const record = await pb.collection('tasks').create({
        ...payload
      }, { $autoCancel: false });
      const normalized = normalizeTaskRecord(record);
      setTasks(prev => [normalized, ...prev]);
      if (record?.project) {
        appendProjectHistory(record.project, 'Tarefa criada', record.title || 'Nova tarefa');
      }
      addTaskHistoryEvent({
        taskId: record.id,
        projectId: record.project || 'Pessoal',
        type: 'task_created',
        message: 'Tarefa criada'
      });
      return normalized;
    } catch (error) {
      console.error(error);
      toast.error('Erro ao adicionar tarefa.');
      throw error;
    }
  };

  const updateTask = async (id, updates) => {
    try {
      const payload = normalizeTaskPayload(updates, id);
      const record = await pb.collection('tasks').update(id, payload, { $autoCancel: false });
      const normalized = normalizeTaskRecord(record);
      setTasks(prev => prev.map(t => t.id === id ? normalized : t));
      if (Object.keys(updates || {}).length > 0) {
        addTaskHistoryEvent({
          taskId: normalized.id,
          projectId: normalized.project || 'Pessoal',
          type: 'task_edited',
          message: 'Tarefa editada'
        });
      }
      return normalized;
    } catch (error) {
      console.error(error);
      toast.error('Erro ao atualizar tarefa.');
      throw error;
    }
  };

  const deleteTask = async (id) => {
    try {
      await pb.collection('tasks').delete(id, { $autoCancel: false });
      setTasks(prev => prev.filter(t => t.id !== id));
    } catch (error) {
      console.error(error);
      toast.error('Erro ao excluir tarefa.');
      throw error;
    }
  };

  const completeTask = async (id, options = {}) => {
    const task = tasks.find((item) => item.id === id);
    if (!task) return { blocked: false, task: null };
    if (isTaskCompletedStatus(task.status)) return { blocked: false, task };

    const currentProgress = getTaskMicrotaskProgress(task);
    const shouldMarkRemaining = Boolean(options.markRemainingAsDone);
    const shouldForceComplete = Boolean(options.forceComplete);

    if (currentProgress.pending > 0 && !shouldMarkRemaining && !shouldForceComplete) {
      return {
        blocked: true,
        task,
        totalMicrotasks: currentProgress.total,
        completedMicrotasks: currentProgress.completed,
        pendingMicrotasks: currentProgress.pending,
        nextPendingMicrotask: currentProgress.nextPending
      };
    }

    let workingTask = task;
    let pendingSnapshot = [];

    if (currentProgress.pending > 0) {
      pendingSnapshot = currentProgress.normalized.filter((microtask) => !microtask.completed);
    }

    if (shouldMarkRemaining && currentProgress.pending > 0) {
      const completedMicrotasks = completeAllMicrotasks(task);
      workingTask = await updateTask(id, {
        microtarefas: completedMicrotasks,
        lastActiveSubtaskId: ''
      });
      addTaskHistoryEvent({
        taskId: id,
        projectId: task?.project || 'Pessoal',
        type: 'microtasks_completed_in_batch',
        message: 'Microtarefas pendentes marcadas como concluídas'
      });
    }

    let registeredMinutes = 0;
    const activeSession = getActiveWorkSession();
    const hasActiveSessionForTask = Boolean(activeSession?.id && activeSession.taskId === id);

    if (hasActiveSessionForTask) {
      const finishedSession = finishActiveWorkSessionForTask(id);
      registeredMinutes = Number(finishedSession?.durationMinutes || 0);
    } else if (options.timeMode === 'planned') {
      const plannedMinutes = Number(workingTask?.timeEstimate || 0);
      if (plannedMinutes > 0) {
        addManualWorkSession({
          projectId: workingTask?.project || 'Pessoal',
          taskId: id,
          durationMinutes: plannedMinutes,
          title: `Conclusão: ${workingTask?.title || 'Tarefa'}`,
          notes: 'Tempo registrado ao concluir tarefa (tempo planejado).'
        });
        registeredMinutes = plannedMinutes;
      }
    } else if (options.timeMode === 'custom') {
      const customMinutes = Number(options.customMinutes || 0);
      if (customMinutes > 0) {
        addManualWorkSession({
          projectId: workingTask?.project || 'Pessoal',
          taskId: id,
          durationMinutes: customMinutes,
          title: `Conclusão: ${workingTask?.title || 'Tarefa'}`,
          notes: 'Tempo registrado ao concluir tarefa (valor informado).'
        });
        registeredMinutes = customMinutes;
      }
    }

    const completedTask = await updateTask(id, {
      status: TASK_STATUS.CONCLUIDA,
      completedAt: new Date().toISOString(),
      lastActiveSubtaskId: ''
    });
    if (workingTask?.project) {
      appendProjectHistory(workingTask.project, 'Tarefa concluída', workingTask.title || 'Tarefa sem título');
    }
    addTaskHistoryEvent({
      taskId: id,
      projectId: workingTask?.project || 'Pessoal',
      type: shouldForceComplete && pendingSnapshot.length > 0 ? 'task_completed_with_pending_microtasks' : 'task_completed',
      message: shouldForceComplete && pendingSnapshot.length > 0
        ? 'Tarefa concluída manualmente com microtarefas pendentes.'
        : `Tarefa concluída em ${new Date().toLocaleString('pt-BR')}`
    });

    if (shouldForceComplete && pendingSnapshot.length > 0) {
      const pendingTitles = pendingSnapshot.map((item) => item.title).filter(Boolean).join('; ');
      addTaskHistoryEvent({
        taskId: id,
        projectId: workingTask?.project || 'Pessoal',
        type: 'pending_microtasks_snapshot',
        message: pendingTitles
          ? `Microtarefas pendentes na conclusão manual: ${pendingTitles}`
          : 'A tarefa foi concluída manualmente com microtarefas pendentes.'
      });
    }

    if (registeredMinutes > 0) {
      addTaskHistoryEvent({
        taskId: id,
        projectId: workingTask?.project || 'Pessoal',
        type: 'time_registered',
        message: `Tempo registrado (${registeredMinutes} min)`
      });
    }

    const nextDate = getNextRecurringDate(workingTask);

    if (!nextDate) {
      return {
        blocked: false,
        task: completedTask,
        pendingSnapshot,
        registeredMinutes
      };
    }

    try {
      await addTask({
        title: workingTask.title,
        nextAction: workingTask.nextAction,
        dueDate: workingTask.dueDate,
        project: workingTask.project,
        taskType: workingTask.taskType,
        timeEstimate: workingTask.timeEstimate,
        energyLevel: workingTask.energyLevel,
        importance: workingTask.importance,
        urgency: workingTask.urgency,
        description: workingTask.description,
        dataLimite: workingTask.dataLimite,
        periodoSugerido: workingTask.scheduledPeriod || workingTask.periodoSugerido,
        energiaNecessaria: workingTask.energiaNecessaria,
        microtarefas: resetMicrotasks(workingTask.microtarefas),
        scheduledDate: nextDate,
        dataSugeridaExecucao: nextDate,
        scheduledPeriod: workingTask.scheduledPeriod || workingTask.periodoSugerido,
        scheduledLabel: null,
        isBusinessTask: Boolean(workingTask.isBusinessTask),
        isClientTask: Boolean(workingTask.isClientTask),
        executionDifficulty: workingTask.executionDifficulty,
        recurrenceFrequency: workingTask.recurrenceFrequency,
        recurrenceAnchorDate: nextDate,
        status: getStatusForScheduledDate(nextDate)
      });
      toast.success(`Próxima ocorrência ${workingTask.recurrenceFrequency.toLocaleLowerCase('pt-BR')} criada para ${new Date(`${nextDate}T12:00:00`).toLocaleDateString('pt-BR')}.`);
    } catch (error) {
      console.error('Erro ao criar próxima ocorrência:', error);
      toast.error('A tarefa foi concluída, mas não foi possível criar a próxima ocorrência.');
    }

    return {
      blocked: false,
      task: completedTask,
      pendingSnapshot,
      registeredMinutes
    };
  };

  const startTask = async (id, options = {}) => {
    const task = tasks.find((item) => item.id === id);
    if (!task) return null;

    const previousStatus = normalizeTaskStatus(task.status);
    const progress = getTaskMicrotaskProgress(task);
    const nextSubtaskId = progress.nextPending?.id || task.lastActiveSubtaskId || '';

    const activeSession = getActiveWorkSession();
    if (activeSession?.id && activeSession.taskId && activeSession.taskId !== id) {
      finishActiveWorkSessionForTask(null, {
        notes: 'Sessão encerrada ao iniciar outra tarefa.'
      });
    }

    if (options.trackTime !== false) {
      startTimerWorkSession({
        projectId: task.project || 'Pessoal',
        taskId: task.id,
        title: task.title || 'Sessão de trabalho'
      });
    }

    const updatedTask = await updateTask(id, {
      status: TASK_STATUS.EM_ANDAMENTO,
      lastActiveSubtaskId: nextSubtaskId
    });

    addTaskHistoryEvent({
      taskId: id,
      projectId: task?.project || 'Pessoal',
      type: previousStatus === TASK_STATUS.PAUSADA ? 'task_resumed' : 'task_started',
      message: previousStatus === TASK_STATUS.PAUSADA
        ? 'Tarefa retomada'
        : 'Tarefa iniciada'
    });

    return updatedTask;
  };

  const pauseTask = async (id, options = {}) => {
    const task = tasks.find((item) => item.id === id);
    if (!task) return null;

    const progress = getTaskMicrotaskProgress(task);
    const nextSubtaskId = progress.nextPending?.id || task.lastActiveSubtaskId || '';
    const note = String(options.note || '').trim();

    const finishedSession = finishActiveWorkSessionForTask(id, {
      notes: note || 'Tarefa pausada'
    });
    const registeredMinutes = Number(finishedSession?.durationMinutes || 0);

    const updatedTask = await updateTask(id, {
      status: TASK_STATUS.PAUSADA,
      lastActiveSubtaskId: nextSubtaskId,
      pauseNote: note
    });

    addTaskHistoryEvent({
      taskId: id,
      projectId: task?.project || 'Pessoal',
      type: 'task_paused',
      message: 'Tarefa pausada'
    });

    if (registeredMinutes > 0) {
      addTaskHistoryEvent({
        taskId: id,
        projectId: task?.project || 'Pessoal',
        type: 'time_registered',
        message: `Tempo registrado (${registeredMinutes} min)`
      });
    }

    return {
      task: updatedTask,
      registeredMinutes
    };
  };

  const resumeTask = async (id, options = {}) => {
    return startTask(id, options);
  };

  const reopenTask = async (id, destination = 'Pendente') => {
    const task = tasks.find((item) => item.id === id);
    if (!task) return null;

    const reopened = await updateTask(id, { status: normalizeTaskStatus(destination) });
    addTaskHistoryEvent({
      taskId: id,
      projectId: task?.project || 'Pessoal',
      type: 'task_reopened',
      message: `Tarefa reaberta em ${new Date().toLocaleString('pt-BR')} para ${destination}`
    });
    if (task?.project) {
      appendProjectHistory(task.project, 'Tarefa reaberta', task.title || 'Tarefa');
    }
    return reopened;
  };
  const deferTask = (id) => updateTask(id, { status: TASK_STATUS.AGUARDANDO_RETORNO });

  const getTaskWorkedMinutes = (taskId) => {
    const safeId = String(taskId || '').trim();
    if (!safeId) return 0;
    return listWorkSessions()
      .filter((session) => session.taskId === safeId)
      .reduce((sum, session) => sum + Number(session.durationMinutes || 0), 0);
  };

  const getTaskNotes = async (taskId) => {
    return pb.collection('taskNotes').getFullList({
      filter: `taskId = "${taskId}"`,
      sort: '-created',
      $autoCancel: false
    });
  };

  const addTaskNote = async (taskId, content) => {
    const accountId = currentUser?.currentAccountId || getCurrentAccountId();
    return pb.collection('taskNotes').create({
      taskId,
      content,
      userId: currentUser?.id,
      ...(accountId ? { accountId } : {})
    }, { $autoCancel: false });
  };

  const getFocusSessions = async (taskId) => {
    return pb.collection('focusSessions').getFullList({
      filter: `taskId = "${taskId}"`,
      sort: '-created',
      $autoCancel: false
    });
  };

  const recordFocusSession = async (session) => {
    const accountId = currentUser?.currentAccountId || getCurrentAccountId();
    return pb.collection('focusSessions').create({
      ...session,
      userId: currentUser?.id,
      ...(accountId ? { accountId } : {})
    }, { $autoCancel: false });
  };

  return (
    <TaskContext.Provider value={{ 
      tasks, 
      addTask, 
      updateTask, 
      deleteTask, 
      completeTask, 
      startTask,
      pauseTask,
      resumeTask,
      reopenTask,
      deferTask,
      getTaskWorkedMinutes,
      getTaskNotes,
      addTaskNote,
      getFocusSessions,
      recordFocusSession,
      refreshTasks,
      isLoading,
      selectedTask,
      setSelectedTask,
      checkIn,
      setCheckIn: saveDailyCheckIn,
      hasTodayCheckIn,
      isCheckInEditing,
      openCheckInEditor,
      clearDailyCheckIn
    }}>
      {children}
    </TaskContext.Provider>
  );
}
