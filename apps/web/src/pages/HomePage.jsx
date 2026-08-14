
import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Play, CheckCircle2, MoreHorizontal, Eye, Pencil, Archive, Trash2 } from 'lucide-react';
import Header from '@/components/Header.jsx';
import Sidebar from '@/components/Sidebar.jsx';
import MobileNav from '@/components/MobileNav.jsx';
import TaskCard from '@/components/TaskCard.jsx';
import CheckInCard from '@/components/CheckInCard.jsx';
import TaskDetailsModal from '@/components/TaskDetailsModal.jsx';
import EditTaskModal from '@/components/EditTaskModal.jsx';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { useTaskContext } from '@/hooks/useTaskContext.js';
import { getTodayCapacity, reorganizeTasksByEnergy } from '@/lib/energyLogic.js';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useTheme } from '@/contexts/ThemeContext.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { listFollowUpsForDate, listWaitingReturns } from '@/services/waitingReturnService.js';
import { listUnsortedNotes } from '@/lib/unsortedNotesStorage.js';
import pb from '@/lib/pocketbaseClient.js';
import BlockedHelpDialog from '@/components/BlockedHelpDialog.jsx';
import { getNextRecurringDate, getStatusForScheduledDate } from '@/lib/recurrenceLogic.js';
import TaskCompletionDialog from '@/components/TaskCompletionDialog.jsx';
import CreateFollowUpFromTaskDialog from '@/components/CreateFollowUpFromTaskDialog.jsx';
import { getTaskMicrotaskProgress, normalizeTaskStatus, TASK_STATUS } from '@/lib/taskExecution.js';
import TaskPendingMicrotasksDialog from '@/components/TaskPendingMicrotasksDialog.jsx';
import TaskPauseDialog from '@/components/TaskPauseDialog.jsx';
import DailyWrapUpDialog from '@/components/DailyWrapUpDialog.jsx';
import { useAppMode } from '@/contexts/AppModeContext.jsx';

const WEEK_REVIEW_KEY = 'clareia_week_review_seen';

function getWeekStorageKey() {
  const now = new Date();
  const firstDayOfYear = new Date(now.getFullYear(), 0, 1);
  const pastDays = Math.floor((now.getTime() - firstDayOfYear.getTime()) / 86400000);
  const weekNumber = Math.ceil((pastDays + firstDayOfYear.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${weekNumber}`;
}

function readProjectHealth() {
  if (typeof window === 'undefined') return { staleProjectsCount: 0 };

  const profiles = JSON.parse(window.localStorage.getItem('clareia_project_profiles_v1') || '[]');
  const history = JSON.parse(window.localStorage.getItem('clareia_project_history_v1') || '{}');
  const tenDaysAgo = Date.now() - (10 * 24 * 60 * 60 * 1000);

  const staleProjects = (Array.isArray(profiles) ? profiles : []).filter((project) => {
    const events = history?.[project?.name] || [];
    if (events.length === 0) return true;
    const latest = new Date(events[0]?.createdAt || 0).getTime();
    return !latest || latest < tenDaysAgo;
  });

  return { staleProjectsCount: staleProjects.length };
}

function toIsoDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString().split('T')[0];
}

export default function HomePage() {
  const {
    tasks,
    addTask,
    completeTask,
    deleteTask,
    updateTask,
    checkIn,
    setSelectedTask,
    startTask,
    resumeTask,
    pauseTask,
    getTaskWorkedMinutes
  } = useTaskContext();
  const { lowStimulationMode } = useTheme();
  const { isDailyMode } = useAppMode();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const userId = currentUser?.id || pb.authStore?.model?.id || null;

  const [detailsTask, setDetailsTask] = useState(null);
  const [editTask, setEditTask] = useState(null);
  const [deleteTaskTarget, setDeleteTaskTarget] = useState(null);
  const [isReorganizingDay, setIsReorganizingDay] = useState(false);
  const [showOtherTasks, setShowOtherTasks] = useState(false);
  const [isBlockedDialogOpen, setIsBlockedDialogOpen] = useState(false);
  const [completionTaskTarget, setCompletionTaskTarget] = useState(null);
  const [followUpTaskTarget, setFollowUpTaskTarget] = useState(null);
  const [pendingCompletionData, setPendingCompletionData] = useState(null);
  const [pendingCompletionPayload, setPendingCompletionPayload] = useState(null);
  const [isPauseDialogOpen, setIsPauseDialogOpen] = useState(false);
  const [isWrapUpOpen, setIsWrapUpOpen] = useState(false);

  const { recommended, agora, depois, seSobrar, alertasImportantes = [], fallbackMessage } = reorganizeTasksByEnergy(tasks, checkIn);
  const todayCapacity = getTodayCapacity(tasks, checkIn);

  const todayIso = useMemo(() => new Date().toISOString().split('T')[0], []);

  const recurringTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (normalizeTaskStatus(task.status) === TASK_STATUS.CONCLUIDA) return false;
      return task.recurrenceFrequency === 'Semanal' || task.recurrenceFrequency === 'Mensal';
    });
  }, [tasks]);

  const overdueRecurring = useMemo(() => {
    return recurringTasks
      .filter((task) => {
        const scheduled = toIsoDate(task.scheduledDate || task.dataSugeridaExecucao);
        return Boolean(scheduled && scheduled < todayIso);
      })
      .sort((a, b) => {
        const aDate = new Date(`${toIsoDate(a.scheduledDate || a.dataSugeridaExecucao) || '2999-12-31'}T12:00:00`).getTime();
        const bDate = new Date(`${toIsoDate(b.scheduledDate || b.dataSugeridaExecucao) || '2999-12-31'}T12:00:00`).getTime();
        return aDate - bDate;
      });
  }, [recurringTasks, todayIso]);

  const recurringThisWeekCount = useMemo(() => {
    const start = new Date(`${todayIso}T12:00:00`);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    return recurringTasks.filter((task) => {
      const scheduled = toIsoDate(task.scheduledDate || task.dataSugeridaExecucao);
      if (!scheduled) return false;
      const date = new Date(`${scheduled}T12:00:00`);
      return date > start && date <= end;
    }).length;
  }, [recurringTasks, todayIso]);

  const followUpsToday = useMemo(() => listFollowUpsForDate(todayIso), [todayIso, tasks.length]);

  const weeklyReview = useMemo(() => {
    const overdueTasks = tasks.filter((task) => normalizeTaskStatus(task.status) !== TASK_STATUS.CONCLUIDA && task.dueDate && task.dueDate < todayIso).length;
    const stalledTasks = tasks.filter((task) => {
      if (normalizeTaskStatus(task.status) === TASK_STATUS.CONCLUIDA) return false;
      const updatedAt = new Date(task.updated || task.updatedAt || task.created || task.createdAt || 0).getTime();
      if (!updatedAt) return false;
      return updatedAt < Date.now() - (7 * 24 * 60 * 60 * 1000);
    }).length;
    const billingSoon = tasks.filter((task) => {
      const type = String(task.taskType || '').toLocaleLowerCase('pt-BR');
      if (!type.includes('cobran')) return false;
      if (!task.dueDate) return false;
      const diff = new Date(`${task.dueDate}T12:00:00`).getTime() - new Date(`${todayIso}T12:00:00`).getTime();
      const days = Math.floor(diff / (24 * 60 * 60 * 1000));
      return days >= 0 && days <= 7;
    }).length;
    const pendingInbox = listUnsortedNotes(userId, 'pendente').length;
    const waitingCount = listWaitingReturns().filter((item) => item.status !== 'Concluido').length;
    const { staleProjectsCount } = readProjectHealth();

    return { overdueTasks, stalledTasks, billingSoon, staleProjectsCount, pendingInbox, waitingCount };
  }, [tasks, todayIso, userId]);

  const showWeeklyReviewPrompt = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const seenWeek = window.localStorage.getItem(WEEK_REVIEW_KEY);
    return seenWeek !== getWeekStorageKey();
  }, [tasks.length]);

  const pausedTasks = useMemo(() => {
    return tasks.filter((task) => normalizeTaskStatus(task.status) === TASK_STATUS.PAUSADA);
  }, [tasks]);

  const handleStartTask = async (task) => {
    const updatedTask = normalizeTaskStatus(task?.status) === TASK_STATUS.PAUSADA
      ? await resumeTask(task.id)
      : await startTask(task.id);
    setSelectedTask(updatedTask || task);
    navigate('/foco');
  };

  const handleCompleteTask = async (payload) => {
    if (!completionTaskTarget?.id) return;
    setPendingCompletionPayload(payload);
    const result = await completeTask(completionTaskTarget.id, payload);
    if (result?.blocked) {
      setPendingCompletionData(result);
      setCompletionTaskTarget(null);
      return;
    }
    setCompletionTaskTarget(null);
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

  const handleArchiveTask = async (task) => {
    if (!task?.id) return;
    await updateTask(task.id, { status: TASK_STATUS.ARQUIVADA });
    toast.success('Tarefa arquivada no backlog.');
  };

  const handleDeleteTask = async () => {
    if (!deleteTaskTarget?.id) return;
    await deleteTask(deleteTaskTarget.id);
    toast.success('Tarefa excluída.');
    setDeleteTaskTarget(null);
  };

  const handleDismissWeekPrompt = () => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(WEEK_REVIEW_KEY, getWeekStorageKey());
  };

  const handleLightenDay = async () => {
    const todayTasks = tasks.filter((task) => normalizeTaskStatus(task.status) === TASK_STATUS.PENDENTE);
    if (todayTasks.length <= 2) {
      toast.message('Seu dia já está enxuto.');
      return;
    }

    setIsReorganizingDay(true);
    try {
      const mainTask = recommended || todayTasks[0];
      const lightTask = todayTasks.find((task) => task.id !== mainTask?.id && (task.energiaNecessaria === 'Baixa' || Number(task.timeEstimate || 0) <= 30));
      const keepIds = new Set([mainTask?.id, lightTask?.id].filter(Boolean));
      const toMove = todayTasks.filter((task) => !keepIds.has(task.id));

      for (const task of toMove) {
        await updateTask(task.id, {
          status: TASK_STATUS.PENDENTE,
          scheduledPeriod: 'tarde'
        });
      }

      toast.success('Vamos deixar o dia mais leve. Escolha apenas o próximo passo possível.');
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível reorganizar o dia agora.');
    } finally {
      setIsReorganizingDay(false);
    }
  };

  const handleScheduleRecurringToday = async (task) => {
    try {
      await updateTask(task.id, {
        scheduledDate: todayIso,
        dataSugeridaExecucao: todayIso,
        status: TASK_STATUS.PENDENTE
      });
      toast.success('Rotina agendada para hoje.');
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível agendar a rotina para hoje.');
    }
  };

  const handleDeferRecurring = async (task) => {
    try {
      const nextDate = getNextRecurringDate(task);
      if (!nextDate) {
        toast.error('Não foi possível calcular a próxima recorrência.');
        return;
      }

      await updateTask(task.id, {
        scheduledDate: nextDate,
        dataSugeridaExecucao: nextDate,
        status: getStatusForScheduledDate(nextDate),
        recurrenceAnchorDate: nextDate
      });
      toast.success('Rotina adiada para a próxima execução.');
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível adiar a rotina.');
    }
  };

  return (
    <>
      <Helmet><title>Hoje - Clareia</title></Helmet>
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 pb-20 md:pb-8">
            <div className="page-container section-spacing max-w-4xl">

              <div className="mb-10">
                <h1 className="text-3xl md:text-4xl font-medium text-foreground mb-3">Hoje</h1>
                <p className="text-lg text-muted-foreground max-w-2xl">{lowStimulationMode ? 'Uma coisa por vez. Vamos no próximo passo possível.' : 'Descarregue, organize e execute com foco no que importa agora.'}</p>
                {!!checkIn?.prioridadePrincipal && (
                  <p className="mt-2 text-sm text-foreground">Prioridade principal de hoje: <span className="font-medium">{checkIn.prioridadePrincipal}</span></p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {!isDailyMode && <Button variant="outline" onClick={() => navigate('/calendario')}>Ver no calendário</Button>}
                  <Button variant="outline" onClick={() => setIsWrapUpOpen(true)}>Encerrar dia</Button>
                </div>
              </div>

              <CheckInCard compact={lowStimulationMode} />

              {!lowStimulationMode && !isDailyMode && recurringThisWeekCount > 0 && (
                <div className="mb-6 rounded-xl border border-border bg-card px-4 py-3 flex items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    Rotinas: {recurringThisWeekCount} recorrência{recurringThisWeekCount > 1 ? 's' : ''} programada{recurringThisWeekCount > 1 ? 's' : ''} esta semana.
                  </p>
                  <Button size="sm" variant="outline" onClick={() => navigate('/rotinas')}>Ver rotinas</Button>
                </div>
              )}

              {!lowStimulationMode && !isDailyMode && overdueRecurring.length > 0 && (
                <div className="mb-6 rounded-xl border border-amber-300/50 bg-amber-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <p className="text-sm text-amber-900">
                    Rotina vencida: {overdueRecurring[0].title}
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleScheduleRecurringToday(overdueRecurring[0])}>Agendar para hoje</Button>
                    <Button size="sm" variant="outline" onClick={() => handleDeferRecurring(overdueRecurring[0])}>Adiar</Button>
                  </div>
                </div>
              )}

              {!lowStimulationMode && !isDailyMode && (
              <div className="mb-8 flex flex-col gap-1 border-l-2 border-primary/30 pl-4 text-sm sm:flex-row sm:items-center sm:justify-between">
                <p className="font-medium text-foreground">
                  Hoje: {todayCapacity.plannedMinutes} de {todayCapacity.availableMinutes} min planejados
                </p>
                <p className={todayCapacity.isOverCapacity ? 'text-destructive' : 'text-muted-foreground'}>
                  {todayCapacity.isOverCapacity
                    ? 'A agenda passou do seu tempo disponível.'
                    : `${todayCapacity.remainingMinutes} min de margem para imprevistos.`}
                </p>
              </div>
              )}

              {!lowStimulationMode && !isDailyMode && (
              <div className="mb-8 flex items-center justify-end">
                <Button variant="outline" onClick={handleLightenDay} disabled={isReorganizingDay}>
                  Cansei / Reorganizar meu dia
                </Button>
              </div>
              )}

              {!lowStimulationMode && !isDailyMode && showWeeklyReviewPrompt && (
                <div className="mb-10 rounded-2xl border border-border bg-card p-5">
                  <h2 className="text-base font-medium text-foreground">Quer revisar sua semana?</h2>
                  <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-2 text-sm text-muted-foreground">
                    <p>Tarefas vencidas: {weeklyReview.overdueTasks}</p>
                    <p>Tarefas paradas: {weeklyReview.stalledTasks}</p>
                    <p>Cobranças próximas: {weeklyReview.billingSoon}</p>
                    <p>Projetos sem movimento: {weeklyReview.staleProjectsCount}</p>
                    <p>Pendências guardadas: {weeklyReview.pendingInbox}</p>
                    <p>Aguardando retorno: {weeklyReview.waitingCount}</p>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button onClick={() => { handleDismissWeekPrompt(); navigate('/prioridades'); }}>Montar plano da semana</Button>
                    <Button variant="outline" onClick={handleDismissWeekPrompt}>Lembrar depois</Button>
                  </div>
                </div>
              )}

              {!lowStimulationMode && followUpsToday.length > 0 && (
                <div className="mb-10 rounded-2xl border border-border bg-card p-5">
                  <h2 className="text-base font-medium text-foreground">Aguardando retorno com follow-up hoje</h2>
                  <ul className="mt-3 space-y-2">
                    {followUpsToday.slice(0, lowStimulationMode ? 2 : 4).map((item) => (
                      <li key={item.id} className="text-sm text-foreground">
                        {item.title} - {item.contactName}
                      </li>
                    ))}
                  </ul>
                  <Button variant="outline" className="mt-4" onClick={() => navigate('/aguardando-retorno')}>Abrir Aguardando retorno</Button>
                </div>
              )}

              {pausedTasks.length > 0 && (
                <div className="mb-10 rounded-2xl border border-amber-300/50 bg-amber-50 p-5">
                  <h2 className="text-base font-medium text-amber-900">Continuar de onde parei</h2>
                  <div className="mt-3 space-y-3">
                    {pausedTasks.slice(0, lowStimulationMode ? 1 : 3).map((task) => {
                      const progress = getTaskMicrotaskProgress(task);
                      const workedMinutes = getTaskWorkedMinutes(task.id);
                      return (
                        <div key={task.id} className="rounded-xl border border-amber-200 bg-white p-3">
                          <p className="text-sm font-medium text-foreground">Continuar: {task.title}</p>
                          <p className="text-xs text-muted-foreground">Próximo passo: {progress.nextPending?.title || progress.nextPending?.descricao || 'Revisar contexto da tarefa'}</p>
                          <p className="text-xs text-muted-foreground">Tempo já trabalhado: {workedMinutes} min</p>
                          {task.pauseNote && (
                            <p className="text-xs text-muted-foreground">Onde parei: {task.pauseNote}</p>
                          )}
                          <div className="mt-2">
                            <Button size="sm" onClick={() => handleStartTask(task)}>Continuar de onde parei</Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {recommended ? (
                <div className="mb-12 animate-in fade-in duration-700">
                  {!lowStimulationMode && (
                    <h2 className="text-sm uppercase tracking-widest font-bold text-primary mb-4 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-primary animate-pulse" /> O que fazer agora
                    </h2>
                  )}
                  <div className="bg-card border-2 border-primary/20 shadow-lg rounded-3xl p-6 md:p-8">
                    <div className="mb-8">
                      <div>
                        <h3 className="text-2xl font-medium text-foreground mb-2">{recommended.title}</h3>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                          {recommended.project && <span className="bg-secondary text-secondary-foreground px-2 py-1 rounded-md font-medium">{recommended.project}</span>}
                          {!lowStimulationMode && <span>{recommended.timeEstimate} minutos</span>}
                          {!lowStimulationMode && <span className="capitalize text-xs font-medium border border-border px-2 py-0.5 rounded-full">{recommended.energiaNecessaria} energia</span>}
                          {!lowStimulationMode && recommended.executionDifficulty && <span className="text-xs font-medium border border-border px-2 py-0.5 rounded-full">{recommended.executionDifficulty}</span>}
                          {!lowStimulationMode && <span className="capitalize text-xs font-medium border border-border px-2 py-0.5 rounded-full">{recommended.whenToExecute || 'agora'}</span>}
                        </div>
                      </div>
                    </div>

                    {(recommended.firstAction || recommended.nextAction) && (
                      <div className="bg-secondary/40 rounded-2xl p-5 border border-border">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Primeira ação</p>
                        <p className="text-foreground text-lg">{recommended.firstAction || recommended.nextAction}</p>
                      </div>
                    )}

                    <div className="flex items-center gap-3 mt-6 flex-wrap">
                      <Button onClick={() => handleStartTask(recommended)} className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 min-w-[160px] flex-1 sm:flex-none">
                        <Play className="w-4 h-4 mr-2" /> Começar
                      </Button>

                      <Button variant="outline" onClick={() => setIsBlockedDialogOpen(true)} className="rounded-xl border-border hover:bg-muted text-foreground min-w-[160px] flex-1 sm:flex-none">
                        Estou travada
                      </Button>

                      <Button variant="outline" onClick={() => setCompletionTaskTarget(recommended)} className="rounded-xl border-border hover:bg-muted text-foreground min-w-[160px] flex-1 sm:flex-none">
                        <CheckCircle2 className="w-4 h-4 mr-2" /> Concluir
                      </Button>

                      {!lowStimulationMode && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" className="rounded-xl border-border hover:bg-muted text-foreground w-10 h-10 px-0" aria-label="Mais ações">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setDetailsTask(recommended)}>
                            <Eye className="w-4 h-4" /> Ver detalhes
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setEditTask(recommended)}>
                            <Pencil className="w-4 h-4" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setFollowUpTaskTarget(recommended)}>
                            <CheckCircle2 className="w-4 h-4" /> Criar acompanhamento
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setCompletionTaskTarget(recommended)}>
                            <CheckCircle2 className="w-4 h-4" /> Concluir
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleArchiveTask(recommended)}>
                            <Archive className="w-4 h-4" /> Arquivar tarefa
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setDeleteTaskTarget(recommended)} className="text-destructive focus:text-destructive">
                            <Trash2 className="w-4 h-4" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      )}
                    </div>
                  </div>

                  {lowStimulationMode && (
                    <div className="mt-4 flex justify-center">
                      <Button variant="outline" onClick={() => setShowOtherTasks((prev) => !prev)}>
                        {showOtherTasks ? 'Ocultar outras tarefas' : 'Ver outras tarefas'}
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-20 bg-card border border-border rounded-3xl shadow-sm mb-12">
                  <CheckCircle2 className="w-16 h-16 text-muted-foreground mx-auto mb-6 opacity-30" />
                  <h2 className="text-2xl font-medium text-foreground mb-3">Sem tarefa ideal para agora</h2>
                  <p className="text-lg text-muted-foreground mb-8">
                    {fallbackMessage || 'Nenhuma tarefa pesada para agora. Você pode revisar o plano ou registrar contexto no Descarregar mente.'}
                  </p>
                  <Button size="lg" onClick={() => navigate('/descarregar-mente')} className="rounded-2xl h-14">Registrar no Descarregar mente</Button>
                </div>
              )}

              {agora.length > 0 && (!lowStimulationMode || showOtherTasks) && (
                <div className="mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100 fill-mode-both">
                  <h3 className="text-xl font-medium text-foreground mb-6">Em seguida</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {agora.slice(0, lowStimulationMode ? 1 : agora.length).map((task) => (
                      <TaskCard key={task.id} task={task} minimal />
                    ))}
                  </div>
                </div>
              )}

              {depois.length > 0 && (!lowStimulationMode || showOtherTasks) && (
                <div className="mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200 fill-mode-both">
                  <h3 className="text-xl font-medium text-foreground mb-6 opacity-80">Se sobrar energia</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 opacity-80">
                    {depois.slice(0, lowStimulationMode ? 1 : depois.length).map((task) => (
                      <TaskCard key={task.id} task={task} minimal />
                    ))}
                  </div>
                </div>
              )}

              {seSobrar.length > 0 && (!lowStimulationMode || showOtherTasks) && (
                <div className="mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-400 fill-mode-both">
                  <h3 className="text-xl font-medium text-foreground mb-6 opacity-80">Esta semana</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 opacity-80">
                    {seSobrar.slice(0, lowStimulationMode ? 1 : 3).map((task) => (
                      <TaskCard key={task.id} task={task} minimal />
                    ))}
                  </div>
                </div>
              )}

              {alertasImportantes.filter((t) => t.id !== recommended?.id).length > 0 && (!lowStimulationMode || showOtherTasks) && (
                <div className="mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300 fill-mode-both">
                  <h3 className="text-xl font-medium text-foreground mb-6">Alertas importantes</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {alertasImportantes
                      .filter((task) => task.id !== recommended?.id)
                      .slice(0, lowStimulationMode ? 1 : 4)
                      .map((task) => (
                        <TaskCard key={task.id} task={task} />
                      ))}
                  </div>
                </div>
              )}

              {!isDailyMode && (
                <div className="text-center mt-12 pt-8 border-t border-border">
                  <Button variant="ghost" onClick={() => navigate('/plano-clareado')} className="text-primary hover:text-primary hover:bg-primary/5 rounded-xl h-12 px-6">
                    Abrir Plano Clareado
                  </Button>
                </div>
              )}

            </div>
          </main>
        </div>
        <MobileNav />

        {detailsTask && (
          <TaskDetailsModal
            task={detailsTask}
            isOpen={!!detailsTask}
            onClose={() => setDetailsTask(null)}
          />
        )}

        <BlockedHelpDialog
          task={recommended}
          isOpen={isBlockedDialogOpen}
          onOpenChange={setIsBlockedDialogOpen}
          onRequestBreakDown={() => {
            if (recommended) {
              setEditTask(recommended);
            }
            setIsBlockedDialogOpen(false);
          }}
          updateTaskById={updateTask}
          createSupportTask={addTask}
        />

        <TaskCompletionDialog
          isOpen={Boolean(completionTaskTarget)}
          onOpenChange={(open) => {
            if (!open) setCompletionTaskTarget(null);
          }}
          task={completionTaskTarget}
          onConfirm={handleCompleteTask}
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

        <CreateFollowUpFromTaskDialog
          isOpen={Boolean(followUpTaskTarget)}
          onOpenChange={(open) => {
            if (!open) setFollowUpTaskTarget(null);
          }}
          task={followUpTaskTarget}
          onConfirmMarkTaskDone={() => {
            setCompletionTaskTarget(followUpTaskTarget);
            setFollowUpTaskTarget(null);
          }}
        />

        {editTask && (
          <EditTaskModal
            task={editTask}
            isOpen={!!editTask}
            onClose={() => setEditTask(null)}
          />
        )}

        <AlertDialog open={!!deleteTaskTarget} onOpenChange={(open) => !open && setDeleteTaskTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Tem certeza que deseja excluir esta tarefa?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação remove a tarefa da agenda atual.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteTask} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Excluir tarefa
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <DailyWrapUpDialog open={isWrapUpOpen} onOpenChange={setIsWrapUpOpen} />
      </div>
    </>
  );
}
