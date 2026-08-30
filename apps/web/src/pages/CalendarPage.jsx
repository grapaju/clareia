import React, { useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Link as LinkIcon,
  Plus
} from 'lucide-react';
import Header from '@/components/Header.jsx';
import Sidebar from '@/components/Sidebar.jsx';
import MobileNav from '@/components/MobileNav.jsx';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useTaskContext } from '@/hooks/useTaskContext.js';
import { useTheme } from '@/contexts/ThemeContext.jsx';
import { listWaitingReturns } from '@/services/waitingReturnService.js';
import { listWorkSessions } from '@/services/workSessionService.js';
import {
  createCalendarCommitment,
  deleteCalendarCommitment,
  listCalendarCommitments,
  updateCalendarCommitment
} from '@/services/calendarCommitmentService.js';
import {
  availableMinutesFromCheckIn,
  classifyDayLoad,
  plannedMinutesForDate,
  suggestCalendarSlotForTask
} from '@/services/calendarPlanningService.js';
import { getCalendarPreferences, isAllowedDayForTask } from '@/services/calendarPreferencesService.js';
import { toIsoDate } from '@/lib/localDate.js';
import CreateFollowUpFromTaskDialog from '@/components/CreateFollowUpFromTaskDialog.jsx';
import TaskDetailsModal from '@/components/TaskDetailsModal.jsx';
import { isTaskOpenStatus, normalizeTaskStatus, TASK_STATUS } from '@/lib/taskExecution.js';
import TaskPendingMicrotasksDialog from '@/components/TaskPendingMicrotasksDialog.jsx';
import TaskPauseDialog from '@/components/TaskPauseDialog.jsx';

function formatDate(value) {
  if (!value) return '-';
  return new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });
}

function startOfWeek(date) {
  const day = new Date(date);
  const weekDay = day.getDay();
  const diff = weekDay === 0 ? -6 : 1 - weekDay;
  day.setDate(day.getDate() + diff);
  day.setHours(0, 0, 0, 0);
  return day;
}

function weekDays(baseDate) {
  const start = startOfWeek(baseDate);
  return Array.from({ length: 7 }).map((_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

function monthGrid(baseDate) {
  const firstDay = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
  const firstWeekDay = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(firstDay);
  gridStart.setDate(firstDay.getDate() - firstWeekDay);

  return Array.from({ length: 42 }).map((_, index) => {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + index);
    return day;
  });
}

function periodFromTime(startTime) {
  if (!startTime) return 'manhã';
  const hour = Number(String(startTime).split(':')[0] || 9);
  if (hour >= 18) return 'noite';
  if (hour >= 12) return 'tarde';
  return 'manhã';
}

function getLoadVisual(load) {
  if (load === 'sobrecarregado') {
    return {
      badge: 'bg-red-100 text-red-800 border-red-300',
      card: 'border-red-300/70 bg-red-50/40',
      bar: 'bg-red-500'
    };
  }
  if (load === 'cheio') {
    return {
      badge: 'bg-amber-100 text-amber-800 border-amber-300',
      card: 'border-amber-300/70 bg-amber-50/30',
      bar: 'bg-amber-500'
    };
  }
  if (load === 'ok') {
    return {
      badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      card: 'border-emerald-300/70 bg-emerald-50/30',
      bar: 'bg-emerald-500'
    };
  }
  return {
    badge: 'bg-sky-100 text-sky-800 border-sky-300',
    card: 'border-sky-300/70 bg-sky-50/30',
    bar: 'bg-sky-500'
  };
}

function formatMinutesLabel(totalMinutes = 0) {
  const safe = Math.max(0, Number(totalMinutes) || 0);
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  if (hours === 0) return `${minutes}min`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h${String(minutes).padStart(2, '0')}`;
}

function formatWeekRangeLong(baseDate) {
  const week = weekDays(baseDate);
  const start = week[0];
  const end = week[6];
  const startDay = start.toLocaleDateString('pt-BR', { day: '2-digit' });
  const endDay = end.toLocaleDateString('pt-BR', { day: '2-digit' });
  const month = end.toLocaleDateString('pt-BR', { month: 'long' });
  const year = end.toLocaleDateString('pt-BR', { year: 'numeric' });
  return `Semana de ${startDay} a ${endDay} de ${month} de ${year}`;
}

function formatWeekRangeShort(baseDate) {
  const week = weekDays(baseDate);
  const start = week[0].toLocaleDateString('pt-BR', { day: '2-digit' });
  const end = week[6].toLocaleDateString('pt-BR', { day: '2-digit' });
  const month = week[6].toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
  const year = week[6].toLocaleDateString('pt-BR', { year: 'numeric' });
  return `${start}-${end} ${month}. ${year}`;
}

function getItemVisual(type) {
  const map = {
    task: { dot: 'bg-slate-500', badge: 'bg-slate-100 text-slate-700 border-slate-300' },
    compromisso: { dot: 'bg-slate-700', badge: 'bg-slate-100 text-slate-700 border-slate-300' },
    followup: { dot: 'bg-slate-400', badge: 'bg-slate-100 text-slate-700 border-slate-300' },
    rotina: { dot: 'bg-slate-600', badge: 'bg-slate-100 text-slate-700 border-slate-300' },
    foco: { dot: 'bg-slate-800', badge: 'bg-slate-100 text-slate-700 border-slate-300' },
    prazo: { dot: 'bg-slate-900', badge: 'bg-slate-100 text-slate-700 border-slate-300' }
  };
  return map[type] || { dot: 'bg-muted-foreground', badge: 'bg-muted text-foreground border-border' };
}

export default function CalendarPage() {
  const navigate = useNavigate();
  const {
    tasks,
    checkIn,
    completeTask,
    reopenTask,
    updateTask,
    setSelectedTask,
    startTask,
    resumeTask,
    pauseTask
  } = useTaskContext();
  const { lowStimulationMode } = useTheme();

  const [viewMode, setViewMode] = useState('semana');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [commitmentsVersion, setCommitmentsVersion] = useState(0);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showCommitmentDialog, setShowCommitmentDialog] = useState(false);
  const [showFollowUpDialog, setShowFollowUpDialog] = useState(false);
  const [pendingCompletionData, setPendingCompletionData] = useState(null);
  const [pendingCompletionPayload, setPendingCompletionPayload] = useState(null);
  const [isPauseDialogOpen, setIsPauseDialogOpen] = useState(false);
  const [editDate, setEditDate] = useState('');
  const [editPeriod, setEditPeriod] = useState('manhã');
  const [newCommitment, setNewCommitment] = useState({
    title: '',
    projectId: 'Pessoal',
    date: toIsoDate(new Date()),
    startTime: '09:00',
    endTime: '10:00'
  });
  const [detailsTask, setDetailsTask] = useState(null);
  const [draggedTaskId, setDraggedTaskId] = useState('');
  const [selectedDayIso, setSelectedDayIso] = useState('');
  const commitmentTriggerRef = useRef(null);

  const followups = useMemo(() => listWaitingReturns(), [tasks.length]);
  const focusSessions = useMemo(() => listWorkSessions(), [tasks.length]);
  const commitments = useMemo(() => listCalendarCommitments(), [commitmentsVersion]);
  const calendarPreferences = useMemo(() => getCalendarPreferences(), [currentDate, commitmentsVersion, tasks.length]);

  const calendarItems = useMemo(() => {
    const taskItems = tasks
      .filter((task) => isTaskOpenStatus(task.status) && toIsoDate(task.scheduledDate || task.dataSugeridaExecucao))
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
        sourceType: 'task'
      }));

    const dueItems = tasks
      .filter((task) => isTaskOpenStatus(task.status) && toIsoDate(task.dueDate || task.dataLimite))
      .map((task) => ({
        id: `due-${task.id}`,
        title: `Prazo: ${task.title}`,
        projectId: task.project || 'Pessoal',
        type: 'prazo',
        date: toIsoDate(task.dueDate || task.dataLimite),
        estimatedMinutes: 0,
        status: task.status || 'Pendente',
        sourceId: task.id,
        sourceType: 'task_due'
      }));

    const followupItems = followups
      .filter((item) => toIsoDate(item.nextFollowUpDate || item.reminderDate))
      .map((item) => ({
        id: `followup-${item.id}`,
        title: item.title,
        projectId: item.project || 'Pessoal',
        type: 'followup',
        date: toIsoDate(item.nextFollowUpDate || item.reminderDate),
        period: 'tarde',
        estimatedMinutes: 15,
        status: item.status || 'Aguardando retorno',
        sourceId: item.id,
        sourceType: 'waiting_return'
      }));

    const routineItems = tasks
      .filter((task) => isTaskOpenStatus(task.status) && ['Semanal', 'Mensal'].includes(task.recurrenceFrequency))
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
        sourceType: 'task_routine'
      }))
      .filter((item) => item.date);

    const focoItems = focusSessions
      .filter((session) => toIsoDate(session.startedAt))
      .map((session) => ({
        id: `focus-${session.id}`,
        title: session.title || 'Bloco de foco',
        projectId: session.projectId || 'Pessoal',
        type: 'foco',
        date: toIsoDate(session.startedAt),
        startTime: session.startedAt ? new Date(session.startedAt).toTimeString().slice(0, 5) : '',
        endTime: session.endedAt ? new Date(session.endedAt).toTimeString().slice(0, 5) : '',
        period: periodFromTime(session.startedAt ? new Date(session.startedAt).toTimeString().slice(0, 5) : ''),
        estimatedMinutes: Number(session.durationMinutes || 0),
        status: session.endedAt ? 'Concluído' : 'Planejado',
        sourceId: session.id,
        taskId: session.taskId || '',
        sourceType: 'work_session'
      }));

    const commitmentItems = commitments.map((item) => ({
      id: `commitment-${item.id}`,
      title: item.title,
      projectId: item.projectId || 'Pessoal',
      type: 'compromisso',
      date: item.date,
      startTime: item.startTime,
      endTime: item.endTime,
      period: periodFromTime(item.startTime),
      estimatedMinutes: Number(item.estimatedMinutes || 60),
      status: item.status || 'Confirmado',
      sourceId: item.id,
      sourceType: 'calendar_commitment',
      googleCalendarEventId: item.googleCalendarEventId || '',
      externalCalendarProvider: item.externalCalendarProvider || '',
      syncStatus: item.syncStatus || 'local_only'
    }));

    return [
      ...taskItems,
      ...dueItems,
      ...followupItems,
      ...routineItems,
      ...focoItems,
      ...commitmentItems
    ].sort((a, b) => {
      const aTs = new Date(`${a.date}T${a.startTime || '12:00'}:00`).getTime();
      const bTs = new Date(`${b.date}T${b.startTime || '12:00'}:00`).getTime();
      return aTs - bTs;
    });
  }, [tasks, followups, commitments, focusSessions]);

  const currentIso = toIsoDate(currentDate);
  const availableMinutes = availableMinutesFromCheckIn(checkIn);

  const dayItems = useMemo(() => calendarItems.filter((item) => item.date === currentIso), [calendarItems, currentIso]);

  const plannedTodayMinutes = useMemo(() => {
    return plannedMinutesForDate({
      dateIso: currentIso,
      tasks,
      followups,
      focusBlocks: focusSessions
    }) + commitments
      .filter((item) => item.date === currentIso)
      .reduce((sum, item) => sum + Number(item.estimatedMinutes || 60), 0);
  }, [currentIso, tasks, followups, focusSessions, commitments]);

  const remainingMinutes = Math.max(0, availableMinutes - plannedTodayMinutes);
  const todayLoad = classifyDayLoad(plannedTodayMinutes, availableMinutes);
  const todayLoadVisual = getLoadVisual(todayLoad);
  const todayLoadRatio = availableMinutes > 0 ? Math.min(100, Math.round((plannedTodayMinutes / availableMinutes) * 100)) : 0;

  const weekData = useMemo(() => {
    return weekDays(currentDate).map((day) => {
      const iso = toIsoDate(day);
      const items = calendarItems.filter((item) => item.date === iso);
      const minutes = plannedMinutesForDate({ dateIso: iso, tasks, followups, focusBlocks: focusSessions })
        + commitments.filter((item) => item.date === iso).reduce((sum, item) => sum + Number(item.estimatedMinutes || 60), 0);
      return {
        date: day,
        iso,
        items,
        plannedMinutes: minutes,
        load: classifyDayLoad(minutes, availableMinutes)
      };
    });
  }, [currentDate, calendarItems, tasks, followups, focusSessions, commitments, availableMinutes]);

  const weekSummary = useMemo(() => {
    const planned = weekData.reduce((sum, day) => sum + day.plannedMinutes, 0);
    const availableDays = weekData.filter((day) => isAllowedDayForTask(day.date, { project: 'Cliente', taskType: 'Cliente' }, { preferences: calendarPreferences })).length;
    const available = availableDays * availableMinutes;
    const free = Math.max(0, available - planned);
    const heavyDays = weekData.filter((day) => day.load === 'cheio' || day.load === 'sobrecarregado').length;
    return { planned, available, free, heavyDays };
  }, [weekData, availableMinutes, calendarPreferences]);

  const monthDays = useMemo(() => monthGrid(currentDate), [currentDate]);

  const markersByDate = useMemo(() => {
    return calendarItems.reduce((acc, item) => {
      if (!acc[item.date]) acc[item.date] = { compromisso: 0, prazo: 0, followup: 0, rotina: 0, task: 0, foco: 0 };
      if (acc[item.date][item.type] !== undefined) acc[item.date][item.type] += 1;
      return acc;
    }, {});
  }, [calendarItems]);

  const moveDate = (deltaDays) => {
    const next = new Date(currentDate);
    next.setDate(next.getDate() + deltaDays);
    setCurrentDate(next);
  };

  const handleSelectItem = (item) => {
    setSelectedItem(item);
    setEditDate(item.date);
    setEditPeriod(item.period || 'manhã');
  };

  const handleSaveItemDate = async () => {
    if (!selectedItem?.sourceId || !editDate) return;
    const todayIso = toIsoDate(new Date());
    if (editDate < todayIso) {
      toast.error('Escolha hoje ou uma data futura.');
      return;
    }

    if (selectedItem.type === 'task' || selectedItem.type === 'rotina') {
      const estimate = Number(tasks.find((task) => task.id === selectedItem.sourceId)?.timeEstimate || 30);
      const previewLoad = plannedMinutesForDate({ dateIso: editDate, tasks, followups, focusBlocks: focusSessions }) + estimate;
      if (previewLoad > availableMinutes) {
        toast.warning('Esse dia está ficando pesado. Quer mover algo para outro dia?');
      }

      await updateTask(selectedItem.sourceId, {
        scheduledDate: editDate,
        dataSugeridaExecucao: editDate,
        scheduledPeriod: editPeriod,
        periodoSugerido: editPeriod,
        manualSchedule: true
      });
      toast.success('Data atualizada.');
      setSelectedItem(null);
      return;
    }

    if (selectedItem.type === 'prazo') {
      await updateTask(selectedItem.sourceId, { dueDate: editDate });
      toast.success('Prazo atualizado.');
      setSelectedItem(null);
      return;
    }

    if (selectedItem.type === 'compromisso') {
      updateCalendarCommitment(selectedItem.sourceId, {
        date: editDate,
        startTime: selectedItem.startTime || '09:00',
        endTime: selectedItem.endTime || '10:00',
        syncStatus: 'pending_sync'
      });
      setCommitmentsVersion((value) => value + 1);
      toast.success('Compromisso atualizado.');
      setSelectedItem(null);
    }
  };

  const handleMoveToAnotherDay = async (daysAhead = 1) => {
    if (!selectedItem?.sourceId) return;
    const current = new Date(`${selectedItem.date}T12:00:00`);
    current.setDate(current.getDate() + daysAhead);
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    if (current < today) current.setTime(today.getTime());
    const nextIso = toIsoDate(current);

    if (selectedItem.type === 'task' || selectedItem.type === 'rotina') {
      await updateTask(selectedItem.sourceId, {
        scheduledDate: nextIso,
        dataSugeridaExecucao: nextIso,
        scheduledPeriod: editPeriod,
        periodoSugerido: editPeriod,
        manualSchedule: true
      });
      toast.success('Item movido para outro dia.');
      setSelectedItem(null);
      return;
    }

    if (selectedItem.type === 'prazo') {
      await updateTask(selectedItem.sourceId, { dueDate: nextIso });
      toast.success('Prazo movido para outro dia.');
      setSelectedItem(null);
      return;
    }

    if (selectedItem.type === 'compromisso') {
      updateCalendarCommitment(selectedItem.sourceId, { date: nextIso, syncStatus: 'pending_sync' });
      setCommitmentsVersion((value) => value + 1);
      toast.success('Compromisso movido para outro dia.');
      setSelectedItem(null);
    }
  };

  const handleStartTask = async () => {
    if (!selectedItem?.sourceId) return;
    const task = tasks.find((item) => item.id === selectedItem.sourceId);
    if (!task) return;
    const updatedTask = normalizeTaskStatus(task.status) === TASK_STATUS.PAUSADA
      ? await resumeTask(task.id)
      : await startTask(task.id);
    setSelectedTask(updatedTask || task);
    navigate('/foco');
  };

  const handleCompleteTask = async () => {
    if (!selectedItem?.sourceId) return;
    const payload = { timeMode: 'planned' };
    setPendingCompletionPayload(payload);
    const result = await completeTask(selectedItem.sourceId, payload);
    if (result?.blocked) {
      setPendingCompletionData(result);
      return;
    }
    toast.success('Tarefa concluída.');
  };

  const handlePauseFromPending = async (note) => {
    if (!pendingCompletionData?.task?.id) return;
    await pauseTask(pendingCompletionData.task.id, { note });
    setIsPauseDialogOpen(false);
    setPendingCompletionData(null);
    setPendingCompletionPayload(null);
    toast.success('Tarefa pausada.');
  };

  const handleMarkRemainingAsDone = async () => {
    if (!pendingCompletionData?.task?.id) return;
    const result = await completeTask(pendingCompletionData.task.id, {
      ...(pendingCompletionPayload || {}),
      markRemainingAsDone: true
    });
    if (!result?.blocked) {
      setPendingCompletionData(null);
      setPendingCompletionPayload(null);
      toast.success('Tarefa concluída.');
    }
  };

  const handleForceComplete = async () => {
    if (!pendingCompletionData?.task?.id) return;
    const result = await completeTask(pendingCompletionData.task.id, {
      ...(pendingCompletionPayload || {}),
      forceComplete: true
    });
    if (!result?.blocked) {
      setPendingCompletionData(null);
      setPendingCompletionPayload(null);
      toast.success('Tarefa concluída manualmente.');
    }
  };

  const handleReopenTask = async () => {
    if (!selectedItem?.sourceId) return;
    await reopenTask(selectedItem.sourceId, 'Pendente');
    toast.success('Tarefa reaberta.');
  };

  const handleAutoFitTask = async () => {
    if (!selectedItem?.sourceId) return;
    const task = tasks.find((item) => item.id === selectedItem.sourceId);
    if (!task) return;

    const suggestion = suggestCalendarSlotForTask(task, {
      tasks,
      checkIn,
      followups,
      focusBlocks: focusSessions,
      commitments,
      preferences: calendarPreferences,
      startDate: new Date()
    });

    if (!suggestion?.date) {
      toast.error('Não foi possível sugerir um encaixe no calendário.');
      return;
    }

    await updateTask(task.id, {
      scheduledDate: suggestion.date,
      dataSugeridaExecucao: suggestion.date,
      scheduledPeriod: suggestion.period,
      periodoSugerido: suggestion.period,
      manualSchedule: false
    });

    if (suggestion.isOverloaded) {
      toast.warning('Esse dia está ficando pesado. Quer mover algo para outro dia?');
    } else {
      toast.success(`Tarefa encaixada para ${new Date(`${suggestion.date}T12:00:00`).toLocaleDateString('pt-BR')} (${suggestion.period}).`);
    }
  };

  const handleCreateCommitment = () => {
    const created = createCalendarCommitment({
      title: newCommitment.title,
      projectId: newCommitment.projectId,
      date: newCommitment.date,
      startTime: newCommitment.startTime,
      endTime: newCommitment.endTime,
      estimatedMinutes: 60,
      status: 'Confirmado',
      googleCalendarEventId: '',
      externalCalendarProvider: '',
      syncStatus: 'local_only'
    });

    if (!created) {
      toast.error('Preencha título, data e horário do compromisso.');
      return;
    }

    setCommitmentsVersion((value) => value + 1);
    setShowCommitmentDialog(false);
    setNewCommitment({
      title: '',
      projectId: 'Pessoal',
      date: toIsoDate(new Date()),
      startTime: '09:00',
      endTime: '10:00'
    });
    toast.success('Compromisso criado no calendário.');
  };

  const handleOpenTaskDetails = () => {
    const taskId = selectedItem?.type === 'foco' ? selectedItem.taskId : selectedItem?.sourceId;
    if (!taskId) return;
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;
    setDetailsTask(task);
  };

  const handleReorganizeHeavyDay = async (dateIso) => {
    const dayTasks = tasks.filter((task) => toIsoDate(task.scheduledDate || task.dataSugeridaExecucao) === dateIso);
    if (dayTasks.length === 0) {
      toast.message('Sem tarefas flexíveis para reorganizar neste dia.');
      return;
    }

    const movable = dayTasks.filter((task) => {
      const status = String(task.status || '').toLowerCase();
      if (status === 'concluída' || status === 'concluida' || status === 'concluido') return false;
      const dueIso = toIsoDate(task.dueDate || task.dataLimite);
      if (dueIso && dueIso <= dateIso) return false;
      const tomorrow = new Date(`${dateIso}T12:00:00`);
      tomorrow.setDate(tomorrow.getDate() + 1);
      if (dueIso && dueIso <= toIsoDate(tomorrow)) return false;
      return true;
    });

    if (movable.length === 0) {
      toast.message('As tarefas deste dia têm prioridade/prazo e não foram movidas.');
      return;
    }

    let movedCount = 0;
    const nextDay = new Date(`${dateIso}T12:00:00`);
    nextDay.setDate(nextDay.getDate() + 1);

    for (const task of movable) {
      const suggestion = suggestCalendarSlotForTask(task, {
        tasks,
        checkIn,
        followups,
        focusBlocks: focusSessions,
        commitments,
        preferences: calendarPreferences,
        startDate: nextDay
      });

      if (!suggestion?.date || suggestion.date === dateIso) continue;

      await updateTask(task.id, {
        scheduledDate: suggestion.date,
        dataSugeridaExecucao: suggestion.date,
        scheduledPeriod: suggestion.period,
        periodoSugerido: suggestion.period,
        manualSchedule: false
      });
      movedCount += 1;
    }

    if (movedCount === 0) {
      toast.message('Não foi possível redistribuir tarefas automaticamente.');
      return;
    }

    toast.success(`${movedCount} tarefa(s) movida(s) para aliviar o dia.`);
  };

  const handleReorganizeWeek = async () => {
    const overloadedDays = weekData
      .filter((day) => day.load === 'sobrecarregado' || day.load === 'cheio')
      .sort((a, b) => b.plannedMinutes - a.plannedMinutes);

    if (overloadedDays.length === 0) {
      toast.message('Sua semana já está equilibrada.');
      return;
    }

    let moved = 0;

    for (const day of overloadedDays) {
      const dayTasks = tasks
        .filter((task) => toIsoDate(task.scheduledDate || task.dataSugeridaExecucao) === day.iso)
        .filter((task) => {
          const status = String(task.status || '').toLowerCase();
          if (status === 'concluída' || status === 'concluida' || status === 'concluido') return false;
          const dueIso = toIsoDate(task.dueDate || task.dataLimite);
          const tomorrow = new Date(`${day.iso}T12:00:00`);
          tomorrow.setDate(tomorrow.getDate() + 1);
          if (dueIso && dueIso <= toIsoDate(tomorrow)) return false;
          return true;
        })
        .sort((a, b) => {
          const aDue = toIsoDate(a.dueDate || a.dataLimite) || '9999-12-31';
          const bDue = toIsoDate(b.dueDate || b.dataLimite) || '9999-12-31';
          return aDue.localeCompare(bDue);
        });

      for (const task of dayTasks) {
        const startDate = new Date(`${day.iso}T12:00:00`);
        startDate.setDate(startDate.getDate() + 1);

        const suggestion = suggestCalendarSlotForTask(task, {
          tasks,
          checkIn,
          followups,
          focusBlocks: focusSessions,
          commitments,
          preferences: calendarPreferences,
          startDate
        });

        if (!suggestion?.date || suggestion.date === day.iso) continue;

        await updateTask(task.id, {
          scheduledDate: suggestion.date,
          dataSugeridaExecucao: suggestion.date,
          scheduledPeriod: suggestion.period,
          periodoSugerido: suggestion.period,
          manualSchedule: false
        });
        moved += 1;
      }
    }

    if (moved === 0) {
      toast.message('Não foi possível redistribuir automaticamente nesta semana.');
      return;
    }

    toast.success(`${moved} tarefa(s) redistribuída(s) na semana.`);
  };

  const suggestPeriodForDate = (dateIso) => {
    const hasMorningCommitment = commitments.some((item) => item.date === dateIso && item.startTime && Number(item.startTime.split(':')[0]) < 12);
    const hasAfternoonCommitment = commitments.some((item) => item.date === dateIso && item.startTime && Number(item.startTime.split(':')[0]) >= 12 && Number(item.startTime.split(':')[0]) < 18);
    if (hasMorningCommitment && !hasAfternoonCommitment) return 'tarde';
    if (hasMorningCommitment && hasAfternoonCommitment) return 'noite';
    return 'manhã';
  };

  const handleFitTaskOnDate = async (dateIso) => {
    const targetDate = new Date(`${dateIso}T12:00:00`);
    const candidates = tasks
      .filter((task) => {
        const status = String(task.status || '').toLowerCase();
        if (status === 'concluída' || status === 'concluida' || status === 'concluido') return false;
        const dueIso = toIsoDate(task.dueDate || task.dataLimite);
        if (dueIso && dueIso < dateIso) return false;
        return isAllowedDayForTask(targetDate, task, { preferences: calendarPreferences, manual: true });
      })
      .sort((a, b) => {
        const aDue = toIsoDate(a.dueDate || a.dataLimite) || '9999-12-31';
        const bDue = toIsoDate(b.dueDate || b.dataLimite) || '9999-12-31';
        return aDue.localeCompare(bDue);
      });

    if (candidates.length === 0) {
      toast.message('Sem tarefa elegível para encaixar neste dia.');
      return;
    }

    const baseMinutes = plannedMinutesForDate({ dateIso, tasks, followups, focusBlocks: focusSessions })
      + commitments.filter((item) => item.date === dateIso).reduce((sum, item) => sum + Number(item.estimatedMinutes || 60), 0);

    const target = candidates.find((task) => (baseMinutes + Number(task.timeEstimate || 30)) <= availableMinutes) || candidates[0];
    const period = suggestPeriodForDate(dateIso);

    await updateTask(target.id, {
      scheduledDate: dateIso,
      dataSugeridaExecucao: dateIso,
      scheduledPeriod: period,
      periodoSugerido: period,
      manualSchedule: true
    });

    toast.success(`Tarefa "${target.title}" encaixada em ${new Date(`${dateIso}T12:00:00`).toLocaleDateString('pt-BR')}.`);
  };

  const handleDragStart = (event, item) => {
    if (!item?.sourceId || !['task', 'rotina', 'prazo'].includes(item.type)) return;
    const payload = JSON.stringify({ taskId: item.sourceId, type: item.type, period: item.period || 'manhã' });
    event.dataTransfer.setData('text/plain', payload);
    setDraggedTaskId(item.sourceId);
  };

  const handleDropOnDay = async (event, fallbackDateIso) => {
    event.preventDefault();
    try {
      const dropDateIso = event.currentTarget?.dataset?.droppableId || fallbackDateIso;
      if (!dropDateIso) return;
      if (dropDateIso < toIsoDate(new Date())) {
        toast.error('Não é possível planejar uma tarefa em um dia anterior.');
        return;
      }

      const payload = JSON.parse(event.dataTransfer.getData('text/plain') || '{}');
      if (!payload.taskId) return;
      const task = tasks.find((item) => item.id === payload.taskId);
      if (!task) return;

      await updateTask(task.id, {
        scheduledDate: dropDateIso,
        dataSugeridaExecucao: dropDateIso,
        scheduledPeriod: payload.period || 'manhã',
        periodoSugerido: payload.period || 'manhã',
        manualSchedule: true
      });
      toast.success('Tarefa movida no calendário.');
    } catch {
      toast.error('Não foi possível mover essa tarefa.');
    } finally {
      setDraggedTaskId('');
    }
  };

  const handleDragEnd = () => {
    setDraggedTaskId('');
  };

  const handleDeleteCommitment = () => {
    if (selectedItem?.type !== 'compromisso') return;
    deleteCalendarCommitment(selectedItem.sourceId);
    setCommitmentsVersion((value) => value + 1);
    setSelectedItem(null);
    toast.success('Compromisso removido.');
  };

  const dayGrouped = useMemo(() => {
    const groups = { manhã: [], tarde: [], noite: [] };
    dayItems.forEach((item) => {
      const key = item.startTime ? periodFromTime(item.startTime) : (item.period || 'tarde');
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return groups;
  }, [dayItems]);

  const renderItemBadge = (type) => {
    const map = {
      task: 'Tarefa',
      compromisso: 'Compromisso',
      prazo: 'Prazo',
      followup: 'Follow-up',
      rotina: 'Rotina',
      foco: 'Foco'
    };
    return map[type] || type;
  };

  const buildItemMetaLine = (item) => {
    const project = item.projectId || 'Pessoal';
    const duration = formatMinutesLabel(item.estimatedMinutes || 0);
    return `${project} · ${duration}`;
  };

  const selectedDayData = useMemo(() => {
    if (!selectedDayIso) return null;
    return weekData.find((day) => day.iso === selectedDayIso) || null;
  }, [weekData, selectedDayIso]);

  return (
    <>
      <Helmet><title>Calendário - Clareia</title></Helmet>
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex">
          <Sidebar compact />
          <main className="flex-1 pb-20 md:pb-8">
            <div className="page-container section-spacing max-w-[1800px] px-3 md:px-4 lg:px-6 space-y-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h1 className="text-3xl font-medium text-foreground flex items-center gap-2"><CalendarDays className="w-7 h-7 text-primary" /> Calendário</h1>
                  <p className="text-sm text-muted-foreground">Visão calma da agenda. A tela Hoje continua sendo sua execução principal.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant={viewMode === 'dia' ? 'default' : 'outline'} onClick={() => setViewMode('dia')}>Dia</Button>
                  <Button variant={viewMode === 'semana' ? 'default' : 'outline'} onClick={() => setViewMode('semana')}>Semana</Button>
                  <Button variant={viewMode === 'mes' ? 'default' : 'outline'} onClick={() => setViewMode('mes')}>Mês</Button>
                  <Button ref={commitmentTriggerRef} variant="outline" onClick={() => setShowCommitmentDialog(true)}><Plus className="w-4 h-4 mr-2" /> Novo compromisso</Button>
                  <Button variant="outline" disabled title="Integração futura">
                    <LinkIcon className="w-4 h-4 mr-2" /> Conectar Google Calendar
                  </Button>
                </div>
              </div>

              <Card className="bg-card border-border">
                <CardContent className="p-4 flex items-center justify-between">
                  <Button variant="outline" size="sm" onClick={() => moveDate(viewMode === 'mes' ? -30 : -1)}><ChevronLeft className="w-4 h-4" /></Button>
                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground">
                      {viewMode === 'dia' && currentDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                      {viewMode === 'mes' && currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                      {viewMode === 'semana' && formatWeekRangeLong(currentDate)}
                    </p>
                    {viewMode === 'semana' ? <p className="text-xs text-muted-foreground">{formatWeekRangeShort(currentDate)}</p> : null}
                  </div>
                  <Button variant="outline" size="sm" onClick={() => moveDate(viewMode === 'mes' ? 30 : 1)}><ChevronRight className="w-4 h-4" /></Button>
                </CardContent>
              </Card>

              {viewMode === 'dia' && (
                <div className="space-y-4">
                  <Card className={`bg-card ${todayLoadVisual.card}`}>
                    <CardContent className="p-5">
                      <p className="text-lg font-medium text-foreground">Hoje: {Math.round(plannedTodayMinutes / 60 * 10) / 10}h planejadas de {Math.round(availableMinutes / 60 * 10) / 10}h disponíveis</p>
                      <div className="mt-3 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-[10px] rounded-full border px-2 py-0.5 ${todayLoadVisual.badge}`}>{todayLoad}</span>
                          <span className="text-[10px] text-muted-foreground">{formatMinutesLabel(plannedTodayMinutes)} / {formatMinutesLabel(availableMinutes)}</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                          <div className={`h-full ${todayLoadVisual.bar}`} style={{ width: `${todayLoadRatio}%` }} />
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">Restam {formatMinutesLabel(remainingMinutes)}</p>
                      {todayLoad === 'sobrecarregado' && (
                        <div className="mt-3">
                          <Button variant="outline" onClick={() => handleReorganizeHeavyDay(currentIso)}>
                            Reorganizar dia pesado
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {['manhã', 'tarde', 'noite'].map((period) => (
                    <Card key={period} className="bg-card border-border">
                      <CardContent className="p-5 space-y-2">
                        <h3 className="text-lg font-medium capitalize">{period}</h3>
                        {(dayGrouped[period] || []).length === 0 ? (
                          <p className="text-sm text-muted-foreground">Sem itens para este período.</p>
                        ) : (
                          (dayGrouped[period] || []).map((item) => (
                            <button key={item.id} className="w-full text-left rounded-lg border border-border p-3 hover:bg-muted/50" onClick={() => handleSelectItem(item)}>
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-medium text-foreground">{item.title}</p>
                                <span className="text-xs text-muted-foreground">{renderItemBadge(item.type)}</span>
                              </div>
                              <p className="text-xs text-muted-foreground">{item.projectId || 'Pessoal'} {item.startTime ? `• ${item.startTime}${item.endTime ? `-${item.endTime}` : ''}` : ''}</p>
                            </button>
                          ))
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {viewMode === 'semana' && (
                <div className="space-y-3">
                  <Card className="bg-card border-border">
                    <CardContent className="p-4 space-y-3">
                      <p className="text-sm text-muted-foreground">
                        {formatMinutesLabel(weekSummary.planned)} planejadas de {formatMinutesLabel(weekSummary.available)} disponíveis - {formatMinutesLabel(weekSummary.free)} livres
                      </p>
                      <p className="text-xs text-muted-foreground">{weekSummary.heavyDays} dia(s) cheio(s) ou sobrecarregado(s)</p>
                      {weekSummary.heavyDays > 0 && <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-medium text-muted-foreground">Carga semanal:</span>
                        <span className="rounded-full border px-2 py-0.5 bg-sky-100 text-sky-800 border-sky-300">leve</span>
                        <span className="rounded-full border px-2 py-0.5 bg-emerald-100 text-emerald-800 border-emerald-300">ok</span>
                        <span className="rounded-full border px-2 py-0.5 bg-amber-100 text-amber-800 border-amber-300">cheio</span>
                        <span className="rounded-full border px-2 py-0.5 bg-red-100 text-red-800 border-red-300">sobrecarregado</span>
                      </div>}
                      {weekSummary.heavyDays > 0 && <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={handleReorganizeWeek}>Reorganizar semana</Button>
                      </div>}
                    </CardContent>
                  </Card>

                  <div className="space-y-3 md:hidden">
                    {weekData.map((day) => (
                      <section key={`mobile-${day.iso}`} className={`border-b border-border pb-4 ${day.iso === toIsoDate(new Date()) ? 'border-l-4 border-l-primary pl-3' : ''}`}>
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <div><h3 className="text-base">{day.date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })}</h3><p className="text-sm text-muted-foreground">{formatMinutesLabel(day.plannedMinutes)} planejados · {day.load}</p></div>
                          <Button size="sm" variant="outline" onClick={() => handleFitTaskOnDate(day.iso)}>+ Planejar aqui</Button>
                        </div>
                        {day.items.length === 0 ? <p className="text-sm text-muted-foreground">Sem itens planejados.</p> : <div className="space-y-2">{day.items.map((item) => <button key={item.id} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-md border border-border p-3 text-left" onClick={() => handleSelectItem(item)}><span className="min-w-0"><span className="block font-medium">{item.title}</span><span className="block text-sm text-muted-foreground">{buildItemMetaLine(item)}</span></span><span className="shrink-0 text-xs text-muted-foreground">{renderItemBadge(item.type)}</span></button>)}</div>}
                      </section>
                    ))}
                  </div>

                  <div className="hidden grid-cols-[repeat(7,minmax(0,1fr))] gap-2 md:grid">
                  {weekData.map((day) => {
                    const visual = getLoadVisual(day.load);
                    const ratio = availableMinutes > 0 ? Math.min(100, Math.round((day.plannedMinutes / availableMinutes) * 100)) : 0;
                    const maxVisibleItems = 2;
                    const visibleItems = day.items.slice(0, maxVisibleItems);
                    const hasMoreItems = day.items.length > visibleItems.length;
                    const dayCardClass = lowStimulationMode ? 'bg-card border-border' : `bg-card ${visual.card}`;
                    return (
                    <Card
                      key={day.iso}
                      className={`${dayCardClass} min-h-[220px] ${draggedTaskId ? 'ring-1 ring-primary/30' : ''}`}
                      data-droppable-id={day.iso}
                      onClick={() => setSelectedDayIso(day.iso)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => handleDropOnDay(event, day.iso)}
                    >
                      <CardContent className="p-2.5 space-y-2">
                        <div className="space-y-0.5">
                          <p className="text-[11px] text-muted-foreground">{day.date.toLocaleDateString('pt-BR', { weekday: 'short' })} {day.date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</p>
                          <p className="text-[11px] text-muted-foreground">{day.load} · {formatMinutesLabel(day.plannedMinutes)}/{formatMinutesLabel(availableMinutes)}</p>
                        </div>
                        {!lowStimulationMode && (
                          <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                            <div className={`h-full ${visual.bar}`} style={{ width: `${ratio}%` }} />
                          </div>
                        )}
                        {!lowStimulationMode && day.load === 'sobrecarregado' && (
                          <Button size="sm" variant="outline" className="w-full" onClick={() => handleReorganizeHeavyDay(day.iso)}>
                            Reorganizar
                          </Button>
                        )}
                        {day.items.length === 0 ? (
                          <button
                            className="text-[11px] text-muted-foreground hover:text-foreground"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleFitTaskOnDate(day.iso);
                            }}
                          >
                            + Planejar aqui
                          </button>
                        ) : (
                          <div className="space-y-1">
                            {visibleItems.map((item) => {
                              const itemVisual = getItemVisual(item.type);
                              const draggable = ['task', 'rotina', 'prazo'].includes(item.type);
                              return (
                                <button
                                  key={item.id}
                                  className="w-full text-left rounded-md border border-border px-2 py-1.5 hover:bg-muted/50"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleSelectItem(item);
                                  }}
                                  title={item.title}
                                  draggable={draggable}
                                  onDragStart={(event) => handleDragStart(event, item)}
                                  onDragEnd={handleDragEnd}
                                  data-item-type={item.type}
                                >
                                  <div className="flex items-start gap-1.5 border-l-2 pl-2 border-slate-300">
                                    <span className={`mt-1.5 h-1.5 w-1.5 rounded-full ${lowStimulationMode ? 'bg-slate-300' : itemVisual.dot}`} />
                                    <div className="min-w-0 flex-1 space-y-0.5">
                                      <p
                                        className="text-[11px] font-medium leading-4 text-foreground"
                                        style={{
                                          display: '-webkit-box',
                                          WebkitLineClamp: 2,
                                          WebkitBoxOrient: 'vertical',
                                          overflow: 'hidden'
                                        }}
                                      >
                                        {item.title}
                                      </p>
                                      <p className="text-[10px] text-muted-foreground truncate">
                                        {buildItemMetaLine(item)}
                                      </p>
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                            {hasMoreItems && (
                              <button
                                className="text-[11px] text-primary hover:underline"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setSelectedDayIso(day.iso);
                                }}
                              >
                                +{day.items.length - visibleItems.length} tarefas
                              </button>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );})}
                  </div>
                </div>
              )}

              {viewMode === 'mes' && (
                <div className="space-y-3">
                  <div className="space-y-3 md:hidden">
                    {monthDays.filter((day) => day.getMonth() === currentDate.getMonth()).map((day) => {
                      const iso = toIsoDate(day);
                      const items = calendarItems.filter((item) => item.date === iso);
                      if (items.length === 0) return null;
                      return <section key={`month-mobile-${iso}`} className="border-b border-border pb-3"><h3 className="mb-2 text-base">{day.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</h3><div className="space-y-2">{items.map((item) => <button key={item.id} className="min-h-11 w-full rounded-md border border-border p-3 text-left" onClick={() => handleSelectItem(item)}><span className="block font-medium">{item.title}</span><span className="text-sm text-muted-foreground">{buildItemMetaLine(item)}</span></button>)}</div></section>;
                    })}
                  </div>
                  <div className="hidden grid-cols-7 gap-2 text-xs text-muted-foreground md:grid">
                    {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'].map((label) => <div key={label} className="text-center">{label}</div>)}
                  </div>
                  <div className="hidden grid-cols-7 gap-2 md:grid">
                    {monthDays.map((day) => {
                      const iso = toIsoDate(day);
                      const markers = markersByDate[iso] || {};
                      const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                      const alertCount = Number(markers.prazo || 0) + Number(markers.followup || 0);

                      return (
                        <button
                          key={iso}
                          className={`min-h-[90px] rounded-lg border p-2 text-left ${isCurrentMonth ? 'border-border bg-card' : 'border-border/40 bg-muted/20'} ${iso === currentIso ? 'ring-2 ring-primary/50' : ''}`}
                          onClick={() => {
                            setCurrentDate(day);
                            if (lowStimulationMode) setViewMode('dia');
                          }}
                        >
                          <p className="text-xs font-medium">{day.getDate()}</p>
                          <div className="mt-2 space-y-1 text-[10px] text-muted-foreground">
                            {markers.compromisso ? <p>Reuniões: {markers.compromisso}</p> : null}
                            {markers.prazo ? <p>Prazos: {markers.prazo}</p> : null}
                            {markers.followup ? <p>Follow-ups: {markers.followup}</p> : null}
                            {markers.rotina ? <p>Rotinas: {markers.rotina}</p> : null}
                            {markers.foco ? <p>Foco: {markers.foco}</p> : null}
                            {markers.task && !lowStimulationMode ? <p>Tarefas: {markers.task}</p> : null}
                            {!lowStimulationMode && alertCount === 0 && markers.task === 0 ? <p>Sem alertas</p> : null}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </main>
        </div>
        <MobileNav />
      </div>

      <Dialog open={showCommitmentDialog} onOpenChange={setShowCommitmentDialog}>
        <DialogContent className="max-w-lg" onCloseAutoFocus={(event) => { event.preventDefault(); commitmentTriggerRef.current?.focus(); }}>
          <DialogHeader>
            <DialogTitle>Novo compromisso</DialogTitle>
            <DialogDescription>Compromissos têm horário fixo e aparecem destacados no calendário.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Título</Label><Input value={newCommitment.title} onChange={(event) => setNewCommitment((current) => ({ ...current, title: event.target.value }))} /></div>
            <div className="space-y-1"><Label>Projeto</Label><Input value={newCommitment.projectId} onChange={(event) => setNewCommitment((current) => ({ ...current, projectId: event.target.value }))} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1"><Label>Data</Label><Input type="date" value={newCommitment.date} onChange={(event) => setNewCommitment((current) => ({ ...current, date: event.target.value }))} /></div>
              <div className="space-y-1"><Label>Início</Label><Input type="time" value={newCommitment.startTime} onChange={(event) => setNewCommitment((current) => ({ ...current, startTime: event.target.value }))} /></div>
              <div className="space-y-1"><Label>Fim</Label><Input type="time" value={newCommitment.endTime} onChange={(event) => setNewCommitment((current) => ({ ...current, endTime: event.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCommitmentDialog(false)}>Cancelar</Button>
            <Button onClick={handleCreateCommitment}>Salvar compromisso</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedItem)} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedItem?.title || 'Detalhes do item'}</DialogTitle>
            <DialogDescription>{selectedItem ? `${renderItemBadge(selectedItem.type)} • ${formatDate(selectedItem.date)}` : '-'}</DialogDescription>
          </DialogHeader>

          {selectedItem && (
            <div className="space-y-3">
              <div className="rounded-lg border border-border p-3 text-sm text-muted-foreground">
                <p><span className="font-medium text-foreground">Projeto:</span> {selectedItem.projectId || 'Pessoal'}</p>
                <p><span className="font-medium text-foreground">Status:</span> {selectedItem.status || '-'}</p>
                {(selectedItem.startTime || selectedItem.endTime) && (
                  <p><span className="font-medium text-foreground">Horário:</span> {selectedItem.startTime || '--:--'} - {selectedItem.endTime || '--:--'}</p>
                )}
                {selectedItem.estimatedMinutes ? <p><span className="font-medium text-foreground">Estimativa:</span> {selectedItem.estimatedMinutes} min</p> : null}
              </div>

              {['task', 'rotina', 'prazo', 'compromisso'].includes(selectedItem.type) && (
                <div className={selectedItem.type === 'task' || selectedItem.type === 'rotina' ? 'grid grid-cols-2 gap-3' : ''}>
                  <div className="space-y-1"><Label>Data</Label><Input type="date" value={editDate} onChange={(event) => setEditDate(event.target.value)} /></div>
                  {(selectedItem.type === 'task' || selectedItem.type === 'rotina') && (
                    <div className="space-y-1"><Label>Período</Label><Select value={editPeriod} onValueChange={setEditPeriod}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="manhã">manhã</SelectItem><SelectItem value="tarde">tarde</SelectItem><SelectItem value="noite">noite</SelectItem></SelectContent></Select></div>
                  )}
                </div>
              )}

              {selectedItem.type === 'foco' && (
                <p className="border-y border-border py-3 text-sm text-muted-foreground">
                  Este é um registro de foco já realizado. Para mudar o planejamento, abra a tarefa vinculada.
                </p>
              )}

              {selectedItem.type === 'followup' && (
                <p className="border-y border-border py-3 text-sm text-muted-foreground">
                  A data deste acompanhamento é gerenciada em Aguardando retorno.
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                {['task', 'rotina', 'prazo', 'compromisso'].includes(selectedItem.type) && (
                  <>
                    <Button variant="outline" onClick={handleSaveItemDate}>Editar data</Button>
                    <Button variant="outline" onClick={() => handleMoveToAnotherDay(1)}>Mover para outro dia</Button>
                  </>
                )}

                {(selectedItem.type === 'task' || selectedItem.type === 'prazo' || selectedItem.type === 'rotina') && (
                  <>
                    <Button variant="outline" onClick={handleOpenTaskDetails}>Abrir tarefa</Button>
                    <Button onClick={handleStartTask}><Clock3 className="w-4 h-4 mr-2" /> Começar</Button>
                    <Button variant="outline" onClick={handleCompleteTask}>Concluir</Button>
                    <Button variant="outline" onClick={handleAutoFitTask}>Encaixar no calendário</Button>
                    <Button variant="outline" onClick={() => setShowFollowUpDialog(true)}>Criar acompanhamento</Button>
                    <Button variant="outline" onClick={handleReopenTask}>Reabrir</Button>
                  </>
                )}

                {selectedItem.type === 'foco' && selectedItem.taskId && (
                  <Button variant="outline" onClick={handleOpenTaskDetails}>Abrir tarefa vinculada</Button>
                )}

                {selectedItem.type === 'followup' && (
                  <Button variant="outline" onClick={() => navigate('/aguardando-retorno')}>Abrir acompanhamentos</Button>
                )}

                {selectedItem.type === 'compromisso' && (
                  <Button variant="outline" className="text-destructive" onClick={handleDeleteCommitment}>Excluir compromisso</Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedDayData)} onOpenChange={(open) => !open && setSelectedDayIso('')}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedDayData ? selectedDayData.date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) : 'Detalhes do dia'}</DialogTitle>
            <DialogDescription>
              {selectedDayData ? `${selectedDayData.load} · ${formatMinutesLabel(selectedDayData.plannedMinutes)} planejadas de ${formatMinutesLabel(availableMinutes)} disponíveis` : '-'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {!selectedDayData || selectedDayData.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem itens neste dia.</p>
            ) : (
              selectedDayData.items.map((item) => {
                const itemVisual = getItemVisual(item.type);
                return (
                  <button
                    key={item.id}
                    className="w-full rounded-md border border-border px-3 py-2 text-left hover:bg-muted/40"
                    onClick={() => handleSelectItem(item)}
                  >
                    <div className="flex items-start gap-2 border-l-2 border-slate-300 pl-2">
                      <span className={`mt-1.5 h-1.5 w-1.5 rounded-full ${lowStimulationMode ? 'bg-slate-300' : itemVisual.dot}`} />
                      <div className="min-w-0 space-y-0.5">
                        <p className="text-sm font-medium leading-5 text-foreground">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{renderItemBadge(item.type)} · {buildItemMetaLine(item)}</p>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (!selectedDayData?.iso) return;
                handleFitTaskOnDate(selectedDayData.iso);
              }}
            >
              Adicionar tarefa
            </Button>
            <Button
              onClick={() => {
                if (!selectedDayData?.iso) return;
                handleReorganizeHeavyDay(selectedDayData.iso);
              }}
            >
              Reorganizar este dia
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CreateFollowUpFromTaskDialog
        isOpen={showFollowUpDialog}
        onOpenChange={setShowFollowUpDialog}
        task={selectedItem ? tasks.find((task) => task.id === selectedItem.sourceId) : null}
        onConfirmMarkTaskDone={async () => {
          if (!selectedItem?.sourceId) return;
          const payload = { timeMode: 'planned' };
          setPendingCompletionPayload(payload);
          const result = await completeTask(selectedItem.sourceId, payload);
          if (result?.blocked) {
            setPendingCompletionData(result);
          }
        }}
      />

      <TaskPendingMicrotasksDialog
        isOpen={Boolean(pendingCompletionData)}
        onOpenChange={(open) => {
          if (!open) setPendingCompletionData(null);
        }}
        pendingData={pendingCompletionData}
        onPause={() => setIsPauseDialogOpen(true)}
        onBack={() => setPendingCompletionData(null)}
        onMarkRemaining={handleMarkRemainingAsDone}
        onForceComplete={handleForceComplete}
      />

      <TaskPauseDialog
        isOpen={isPauseDialogOpen}
        onOpenChange={setIsPauseDialogOpen}
        defaultValue={pendingCompletionData?.task?.pauseNote || ''}
        onConfirm={handlePauseFromPending}
      />

      {detailsTask && (
        <TaskDetailsModal
          task={detailsTask}
          isOpen={Boolean(detailsTask)}
          onClose={() => setDetailsTask(null)}
        />
      )}
    </>
  );
}
