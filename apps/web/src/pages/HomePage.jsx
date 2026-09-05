import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Eye, ListTodo, MoreHorizontal, Play } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import Header from '@/components/Header.jsx';
import Sidebar from '@/components/Sidebar.jsx';
import MobileNav from '@/components/MobileNav.jsx';
import PreferencesOnboarding from '@/components/PreferencesOnboarding.jsx';
import CheckInCard from '@/components/CheckInCard.jsx';
import ProfessionalJourneyCard from '@/components/ProfessionalJourneyCard.jsx';
import TodayTaskRow from '@/components/TodayTaskRow.jsx';
import TaskDetailsModal from '@/components/TaskDetailsModal.jsx';
import EditTaskModal from '@/components/EditTaskModal.jsx';
import TaskCompletionDialog from '@/components/TaskCompletionDialog.jsx';
import TaskPendingMicrotasksDialog from '@/components/TaskPendingMicrotasksDialog.jsx';
import TaskPauseDialog from '@/components/TaskPauseDialog.jsx';
import TaskPickerDialog from '@/components/TaskPickerDialog.jsx';
import SmallerStepDialog from '@/components/SmallerStepDialog.jsx';
import BlockedHelpDialog from '@/components/BlockedHelpDialog.jsx';
import QuickCaptureDialog from '@/components/QuickCaptureDialog.jsx';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useTaskContext } from '@/hooks/useTaskContext.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useTheme } from '@/contexts/ThemeContext.jsx';
import { getTodayCapacity, reorganizeTasksByEnergy } from '@/lib/energyLogic.js';
import { buildTodayGroups, getOpenPlannedMinutes, getTaskNextActionPresentation, getTaskRowMetadata, getTodayCapacityState, getTodayHighlight, getTodayPresentation, getVisibleTodayTasks } from '@/lib/todayViewLogic.js';
import { getTaskMicrotaskProgress, isTaskActionableStatus, normalizeTaskStatus, TASK_STATUS } from '@/lib/taskExecution.js';
import { getActiveWorkSession } from '@/services/workSessionService.js';
import { readUserPreferences } from '@/services/userPreferencesService.js';
import { useProfessionalJourney } from '@/contexts/ProfessionalJourneyContext.jsx';

function formatMinutes(minutes) {
  const safe = Math.max(0, Number(minutes || 0));
  const hours = Math.floor(safe / 60);
  const rest = safe % 60;
  if (!hours) return `${rest} min`;
  return rest ? `${hours}h${String(rest).padStart(2, '0')}` : `${hours}h`;
}

function currentDateLabel() {
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
}

function pluralize(count, singular, plural) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export default function HomePage() {
  const { tasks, addTask, updateTask, deleteTask, completeTask, reopenTask, startTask, resumeTask, pauseTask, setSelectedTask, checkIn, openCheckInEditor, getTaskWorkedMinutes, isLoading, loadError, refreshTasks } = useTaskContext();
  const { currentUser } = useAuth();
  const { lowStimulationMode, setLowStimulationMode } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentJourney, professionalProjects, startWork, resumeWork, startActivity } = useProfessionalJourney();
  const userId = currentUser?.id || '';
  const [detailsTask, setDetailsTask] = useState(null);
  const [editTask, setEditTask] = useState(null);
  const [completionTask, setCompletionTask] = useState(null);
  const [deleteTaskTarget, setDeleteTaskTarget] = useState(null);
  const [pendingCompletionData, setPendingCompletionData] = useState(null);
  const [pendingCompletionPayload, setPendingCompletionPayload] = useState(null);
  const [isPauseDialogOpen, setIsPauseDialogOpen] = useState(false);
  const [isTaskPickerOpen, setIsTaskPickerOpen] = useState(false);
  const [smallStepTask, setSmallStepTask] = useState(null);
  const [smallStepMinutes, setSmallStepMinutes] = useState(null);
  const [isBlockedDialogOpen, setIsBlockedDialogOpen] = useState(false);
  const [skippedSuggestionIds, setSkippedSuggestionIds] = useState([]);
  const [selectedRecommendationId, setSelectedRecommendationId] = useState('');
  const [suggestionAnnouncement, setSuggestionAnnouncement] = useState('');
  const [dismissedHighlightIds, setDismissedHighlightIds] = useState([]);
  const [isHardDayOpen, setIsHardDayOpen] = useState(false);
  const [isNoAlternativeOpen, setIsNoAlternativeOpen] = useState(false);
  const [pendingProfessionalTask, setPendingProfessionalTask] = useState(null);
  const calmTitleRef = useRef(null);
  const openingPreferenceUserRef = useRef('');

  useEffect(() => {
    if (!userId || openingPreferenceUserRef.current === userId) return;
    openingPreferenceUserRef.current = userId;
    const openingPreference = readUserPreferences(userId).openingPreference;
    setLowStimulationMode(openingPreference === 'tranquilo', { persist: false });
  }, [setLowStimulationMode, userId]);

  useEffect(() => {
    setSkippedSuggestionIds([]);
    setSelectedRecommendationId('');
    setDismissedHighlightIds([]);
  }, [userId]);

  useEffect(() => {
    const taskId = new URLSearchParams(location.search).get('task');
    if (!taskId || isLoading) return;
    const task = tasks.find((item) => item.id === taskId);
    if (task) setDetailsTask(task);
  }, [isLoading, location.search, tasks]);

  useEffect(() => {
    if (!lowStimulationMode) return;
    window.requestAnimationFrame(() => calmTitleRef.current?.focus());
  }, [lowStimulationMode]);

  const canonical = useMemo(() => buildTodayGroups(tasks), [tasks]);
  const visibleTodayTasks = useMemo(() => getVisibleTodayTasks(canonical.groups), [canonical.groups]);
  const visibleTaskIds = useMemo(() => new Set(visibleTodayTasks.map((task) => task.id)), [visibleTodayTasks]);
  const { recommended: rankedRecommendation, agora = [] } = reorganizeTasksByEnergy(tasks, checkIn);
  const recommendationCandidates = useMemo(() => {
    const ranked = [rankedRecommendation, ...agora, ...visibleTodayTasks]
      .filter(Boolean)
      .filter((task) => visibleTaskIds.has(task.id) && isTaskActionableStatus(task.status));
    return [...new Map(ranked.map((task) => [task.id, task])).values()];
  }, [rankedRecommendation, agora, visibleTaskIds, visibleTodayTasks]);
  const recommended = useMemo(() => recommendationCandidates.find((task) => task.id === selectedRecommendationId) || recommendationCandidates.find((task) => !skippedSuggestionIds.includes(task.id)) || null, [recommendationCandidates, selectedRecommendationId, skippedSuggestionIds]);
  const activeSession = getActiveWorkSession();
  const highlightCandidates = useMemo(() => tasks.filter((task) => !dismissedHighlightIds.includes(task.id)), [dismissedHighlightIds, tasks]);
  const highlight = useMemo(() => getTodayHighlight(highlightCandidates, recommended, activeSession, checkIn), [activeSession?.id, activeSession?.taskId, checkIn, highlightCandidates, recommended]);
  const presentation = useMemo(() => getTodayPresentation(visibleTodayTasks, highlight, lowStimulationMode), [highlight, lowStimulationMode, visibleTodayTasks]);
  const highlightTask = presentation.highlight;
  const otherTasks = presentation.visibleTasks;
  const highlightMetadata = highlightTask ? getTaskRowMetadata(highlightTask) : null;
  const nextActionPresentation = highlightTask ? getTaskNextActionPresentation(highlightTask) : null;
  const highlightProgress = nextActionPresentation?.progress || null;
  const nextStep = nextActionPresentation?.action || '';
  const lastCompletedStep = highlightProgress?.normalized?.filter((item) => item.completed).at(-1)?.title || '';
  const isResumeHighlight = ['active_session', 'paused', 'started'].includes(highlight.reason);
  const workedMinutes = highlightTask ? getTaskWorkedMinutes(highlightTask.id) : 0;
  const capacity = getTodayCapacity(tasks, checkIn);
  const plannedMinutes = getOpenPlannedMinutes(canonical.groups);
  const capacityState = getTodayCapacityState(plannedMinutes, capacity.availableMinutes);
  const overdueCount = canonical.groups.overdue.length;
  const otherOpenCount = Math.max(0, visibleTodayTasks.length - overdueCount);
  const summaryItems = [
    overdueCount > 0 ? { label: pluralize(overdueCount, 'tarefa atrasada', 'tarefas atrasadas'), destination: 'tasks' } : null,
    overdueCount > 0 && otherOpenCount > 0
      ? { label: pluralize(otherOpenCount, 'outra tarefa aberta', 'outras tarefas abertas'), destination: 'tasks' }
      : overdueCount === 0 && visibleTodayTasks.length > 0
        ? { label: pluralize(visibleTodayTasks.length, 'tarefa aberta', 'tarefas abertas'), destination: 'tasks' }
        : null,
  ].filter(Boolean);
  const completedPlannedToday = canonical.completedToday.filter((task) => getTaskRowMetadata(task).situation.startsWith('Hoje')).length;
  const plannedTaskCount = canonical.groups.today.length + completedPlannedToday;

  const executeTaskStart = async (task, options = {}, journeyId = '') => {
    const updated = normalizeTaskStatus(task.status) === TASK_STATUS.PAUSADA ? await resumeTask(task.id) : await startTask(task.id);
    const taskProject = task.project || 'Pessoal';
    if (journeyId || (currentJourney?.status === 'active' && currentJourney.projectName === taskProject)) {
      await startActivity({ title: task.title, taskId: task.id, source: 'task', journeyId });
    }
    setSelectedTask({ ...(updated || task), ...(options.blockMinutes ? { focusBlockMinutes: options.blockMinutes } : {}) });
    navigate('/foco');
  };
  const handleStartTask = async (task, options = {}) => {
    const taskProject = task.project || 'Pessoal';
    const professionalProject = professionalProjects.find((profile) => profile.name === taskProject);
    if (professionalProject && currentJourney?.projectName === taskProject && currentJourney.status === 'paused') {
      setPendingProfessionalTask({ task, options, action: 'resume' });
      return;
    }
    if (professionalProject && currentJourney?.projectName !== taskProject) {
      setPendingProfessionalTask({ task, options, action: 'start' });
      return;
    }
    await executeTaskStart(task, options);
  };

  const handleStartTaskWithJourney = async () => {
    if (!pendingProfessionalTask) return;
    try {
      let journeyId = currentJourney?.id || '';
      if (pendingProfessionalTask.action === 'resume') {
        await resumeWork();
      } else {
        const started = await startWork(pendingProfessionalTask.task.project || 'Pessoal');
        journeyId = started?.id || '';
      }
      await executeTaskStart(pendingProfessionalTask.task, pendingProfessionalTask.options, journeyId);
      setPendingProfessionalTask(null);
    } catch (error) {
      toast.error(error?.message || 'Não foi possível iniciar a jornada.');
    }
  };
  const handleAnotherSuggestion = () => {
    if (!recommended || recommendationCandidates.length < 2) { setIsNoAlternativeOpen(true); return; }
    const updatedSkippedIds = [...new Set([...skippedSuggestionIds, recommended.id])];
    setSkippedSuggestionIds(updatedSkippedIds);
    setSelectedRecommendationId('');
    const next = recommendationCandidates.find((task) => !updatedSkippedIds.includes(task.id));
    setSuggestionAnnouncement(next ? `Nova sugestão: ${next.title}` : 'Sugestão atualizada.');
  };
  const handleCompleteTask = async (payload) => {
    if (!completionTask?.id) return;
    setPendingCompletionPayload(payload);
    const result = await completeTask(completionTask.id, payload);
    if (result?.blocked) { setPendingCompletionData(result); setCompletionTask(null); return; }
    setCompletionTask(null);
  };
  const handleMarkRemainingAsDone = async () => {
    const result = await completeTask(pendingCompletionData.task.id, { ...(pendingCompletionPayload || {}), markRemainingAsDone: true });
    if (!result?.blocked) setPendingCompletionData(null);
  };
  const handleForceComplete = async () => {
    const result = await completeTask(pendingCompletionData.task.id, { ...(pendingCompletionPayload || {}), forceComplete: true });
    if (!result?.blocked) setPendingCompletionData(null);
  };
  const rowProps = (task) => ({ task, onStart: handleStartTask, onOpen: setDetailsTask, onEdit: setEditTask, onComplete: setCompletionTask, onReopen: (item) => reopenTask(item.id, 'Hoje'), onWaiting: (item) => updateTask(item.id, { status: TASK_STATUS.AGUARDANDO_RETORNO }), onArchive: (item) => updateTask(item.id, { status: TASK_STATUS.ARQUIVADA }), onDelete: setDeleteTaskTarget });

  const handleDismissHighlight = () => {
    if (!highlightTask?.id) return;
    setDismissedHighlightIds((current) => [...new Set([...current, highlightTask.id])]);
    toast.info('A tarefa continua na lista para quando fizer sentido retomá-la.');
  };

  const handleLowEnergyChoice = () => {
    const lowEnergyTask = recommendationCandidates.find((task) => String(task.energiaNecessaria || task.energyLevel || '').toLocaleLowerCase('pt-BR').includes('baixa'));
    if (!lowEnergyTask) {
      toast.info('Não há outra tarefa de baixa energia disponível agora.');
      return;
    }
    setDismissedHighlightIds([]);
    setSelectedRecommendationId(lowEnergyTask.id);
    setSkippedSuggestionIds([]);
    setIsHardDayOpen(false);
    setSuggestionAnnouncement(`Tarefa de baixa energia: ${lowEnergyTask.title}`);
  };

  return (
    <>
      <Helmet><title>Hoje - Clareia</title></Helmet>
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="min-w-0 flex-1 pb-20 md:pb-8">
            <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
              {!lowStimulationMode && <PreferencesOnboarding />}
              {!lowStimulationMode && (
                <header className="mb-5">
                  <h1 className="text-3xl font-medium text-foreground">Hoje</h1>
                  <p className="mt-1 text-sm text-muted-foreground">{currentDateLabel()}</p>
                </header>
              )}

              {isLoading ? (
                <div className="space-y-3 py-6" role="status" aria-label="Carregando tarefas">
                  <div className="h-12 animate-pulse rounded bg-muted" />
                  <div className="h-48 animate-pulse rounded bg-muted" />
                  <div className="h-28 animate-pulse rounded bg-muted" />
                </div>
              ) : loadError ? (
                <div className="my-6 border-y border-destructive/30 py-6" role="alert">
                  <p className="font-medium text-foreground">{loadError}</p>
                  <Button className="mt-3" variant="outline" onClick={refreshTasks}>Tentar novamente</Button>
                </div>
              ) : (
                <>
                  <CheckInCard compact={lowStimulationMode} />
                  <ProfessionalJourneyCard compact={lowStimulationMode} />

                  {lowStimulationMode ? (
                    <section className="mx-auto max-w-2xl py-4" aria-labelledby="calm-mode-title">
                      <h1 ref={calmTitleRef} tabIndex={-1} id="calm-mode-title" className="text-2xl font-medium text-foreground focus:outline-none">Um passo de cada vez</h1>
                      {highlightTask ? (
                        <div className="mt-6 border-y border-border py-6">
                          <p className="text-sm text-muted-foreground">{isResumeHighlight ? 'Continue de onde parou' : 'Para começar agora'}</p>
                          <h2 className="mt-2 text-2xl font-medium text-foreground">{highlightTask.title}</h2>
                          <p className="mt-5 text-sm font-medium text-muted-foreground">Agora</p>
                          <p className="mt-1 text-base text-foreground">{nextStep}</p>
                          {nextActionPresentation.actionMinutes > 0 && <p className="mt-2 text-sm text-muted-foreground">Cerca de {nextActionPresentation.actionMinutes} minutos</p>}
                          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                            <Button onClick={() => handleStartTask(highlightTask)}><Play className="mr-1.5 h-4 w-4" aria-hidden="true" /> {isResumeHighlight ? 'Continuar' : 'Começar'}</Button>
                            <Button variant="outline" onClick={() => setIsBlockedDialogOpen(true)}>Não consigo agora</Button>
                            <Button variant="ghost" onClick={() => setLowStimulationMode(false)}>Ver todas as tarefas</Button>
                          </div>
                          <Button className="mt-4 px-0" variant="link" onClick={() => setIsHardDayOpen(true)}>Hoje está difícil</Button>
                        </div>
                      ) : (
                        <div className="mt-6 border-y border-border py-6">
                          <p className="text-foreground">Nenhuma tarefa para mostrar agora.</p>
                          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                            <QuickCaptureDialog />
                            <Button variant="ghost" onClick={() => setLowStimulationMode(false)}>Sair do Modo tranquilo</Button>
                          </div>
                        </div>
                      )}
                    </section>
                  ) : <>
                  {(summaryItems.length > 0 || plannedMinutes > 0 || completedPlannedToday > 0) && (
                    <section className="mb-6" aria-label="Resumo de hoje">
                      {summaryItems.length > 0 && (
                        <p className="text-sm text-foreground">
                          {summaryItems.map((item, index) => (
                            <React.Fragment key={`${item.destination}-${item.label}`}>
                              {index > 0 && <span aria-hidden="true"> · </span>}
                              <button type="button" className="rounded-sm underline decoration-border underline-offset-4 hover:decoration-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => document.getElementById('open-tasks')?.scrollIntoView({ behavior: 'smooth' })}>{item.label}</button>
                            </React.Fragment>
                          ))}
                        </p>
                      )}
                      {completedPlannedToday > 0 && plannedTaskCount > 1 && <p className="mt-1 text-sm text-muted-foreground">{completedPlannedToday} de {plannedTaskCount} tarefas planejadas concluídas</p>}
                      {plannedMinutes > 0 && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {formatMinutes(plannedMinutes)} planejadas · {formatMinutes(capacity.availableMinutes)} disponíveis
                          {capacityState.isNearCapacity && ' · Seu dia está quase completo.'}
                          {capacityState.isOverCapacity && ` · Seu dia passou ${formatMinutes(capacityState.differenceMinutes)} do tempo disponível.`}
                        </p>
                      )}
                    </section>
                  )}

                  {highlightTask && (
                    <section className="mb-7 rounded-lg border border-primary/25 bg-card p-5 shadow-sm" aria-labelledby="recommendation-title">
                      <p className="mb-2 text-sm font-semibold text-primary">{isResumeHighlight ? (highlight.reason === 'active_session' ? 'Sessão em andamento' : 'Você parou aqui') : 'Sugestão para começar'}</p>
                      <button type="button" className="block w-full rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setDetailsTask(highlightTask)}>
                        <h2 id="recommendation-title" className="text-2xl font-medium text-foreground">{highlightTask.title}</h2>
                        <p className="mt-2 flex flex-wrap gap-x-2 text-[13px] text-muted-foreground">
                          <span>{highlightTask.project || 'Pessoal'}</span>
                          {highlightMetadata.minutes > 0 && <span>{highlightMetadata.minutes} min no total</span>}
                          <span>{highlightMetadata.situation}</span>
                          {(highlightTask.energiaNecessaria || highlightTask.energyLevel) && <span>{highlightTask.energiaNecessaria || highlightTask.energyLevel} energia</span>}
                          {highlightMetadata.isRoutine && <span>Rotina</span>}
                          {workedMinutes > 0 && <span>{workedMinutes} min registrados</span>}
                        </p>
                      </button>
                      <div className="mt-4 rounded-md bg-muted/60 px-4 py-3">
                        {lastCompletedStep && isResumeHighlight && <p className="mb-1 text-xs text-muted-foreground">Último passo concluído: {lastCompletedStep}</p>}
                        <p className="text-xs font-medium text-muted-foreground">Próximo passo</p>
                        <p className="mt-1 text-sm text-foreground">{nextStep}</p>
                        {nextActionPresentation.actionMinutes > 0 && <p className="mt-1 text-xs text-muted-foreground">cerca de {nextActionPresentation.actionMinutes} minutos</p>}
                        {!isResumeHighlight && nextActionPresentation.blockMinutes > 0 && <p className="mt-1 text-xs text-muted-foreground">Bloco de foco sugerido: {nextActionPresentation.blockMinutes} minutos</p>}
                        {nextActionPresentation.pauseNote && <p className="mt-2 text-sm text-muted-foreground">Onde você parou: {nextActionPresentation.pauseNote}</p>}
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <Button onClick={() => handleStartTask(highlightTask)}><Play className="mr-1.5 h-4 w-4" aria-hidden="true" /> {isResumeHighlight ? 'Continuar de onde parei' : 'Começar agora'}</Button>
                        {!isResumeHighlight && <Button variant="outline" onClick={handleAnotherSuggestion}>Outra sugestão</Button>}
                        {isResumeHighlight && <Button variant="outline" onClick={handleDismissHighlight}>Não vou continuar agora</Button>}
                        <Button variant="ghost" onClick={() => setDetailsTask(highlightTask)}><Eye className="mr-1.5 h-4 w-4" aria-hidden="true" /> Ver contexto</Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" aria-label="Mais ações da sugestão"><MoreHorizontal className="h-4 w-4" aria-hidden="true" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setIsTaskPickerOpen(true)}><ListTodo className="h-4 w-4" /> Escolher outra tarefa</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setIsBlockedDialogOpen(true)}>Não consigo agora</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setSmallStepTask(highlightTask)}>Encontrar um passo menor</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => navigate('/calendario')}>Replanejar</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <p className="sr-only" aria-live="polite">{suggestionAnnouncement}</p>
                    </section>
                  )}

                  {otherTasks.length > 0 && (
                    <section id="open-tasks" className="mb-6 scroll-mt-24" aria-labelledby="other-tasks-title">
                      <h2 id="other-tasks-title" className="mb-2 text-lg font-medium text-foreground">{highlightTask ? 'Outras tarefas abertas' : 'Tarefas abertas'} ({otherTasks.length})</h2>
                      <ul className="overflow-hidden rounded-lg border border-border bg-card">
                        {otherTasks.map((task) => <TodayTaskRow key={task.id} {...rowProps(task)} />)}
                      </ul>
                    </section>
                  )}

                  {canonical.completedToday.length > 0 && (
                    <details className="rounded-lg border border-border bg-card">
                      <summary className="cursor-pointer px-4 py-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Concluídas hoje ({canonical.completedToday.length})</summary>
                      <ul className="border-t border-border">{canonical.completedToday.map((task) => <TodayTaskRow key={task.id} {...rowProps(task)} completed workedMinutes={getTaskWorkedMinutes(task.id)} />)}</ul>
                    </details>
                  )}

                  {!highlightTask && otherTasks.length === 0 && (
                    <p className="my-8 text-sm text-muted-foreground">Você não tem tarefas abertas. Se lembrar de algo, use Tirar da cabeça.</p>
                  )}
                  </>}
                </>
              )}
            </div>
          </main>
        </div>
        <MobileNav />

        <AlertDialog open={Boolean(pendingProfessionalTask)} onOpenChange={(open) => !open && setPendingProfessionalTask(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{pendingProfessionalTask?.action === 'resume' ? 'Retomar seu trabalho?' : 'Iniciar seu trabalho?'}</AlertDialogTitle>
              <AlertDialogDescription>
                {pendingProfessionalTask?.task?.project} usa jornada profissional. A jornada mede seu período trabalhado; o foco continua medindo apenas esta tarefa.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {
                const pending = pendingProfessionalTask;
                setPendingProfessionalTask(null);
                if (pending) executeTaskStart(pending.task, pending.options);
              }}>Agora não</AlertDialogCancel>
              <AlertDialogAction onClick={handleStartTaskWithJourney}>
                {pendingProfessionalTask?.action === 'resume' ? 'Retomar e continuar' : 'Iniciar e continuar'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {detailsTask && <TaskDetailsModal task={detailsTask} isOpen onClose={() => {
          setDetailsTask(null);
          if (new URLSearchParams(location.search).has('task')) navigate('/', { replace: true });
        }} />}
        {editTask && <EditTaskModal task={editTask} isOpen onClose={() => setEditTask(null)} />}
        <TaskCompletionDialog isOpen={Boolean(completionTask)} onOpenChange={(open) => !open && setCompletionTask(null)} task={completionTask} onConfirm={handleCompleteTask} />
        <TaskPendingMicrotasksDialog isOpen={Boolean(pendingCompletionData)} onOpenChange={(open) => !open && setPendingCompletionData(null)} pendingData={pendingCompletionData} onPause={() => setIsPauseDialogOpen(true)} onBack={() => setPendingCompletionData(null)} onMarkRemaining={handleMarkRemainingAsDone} onForceComplete={handleForceComplete} />
        <TaskPauseDialog isOpen={isPauseDialogOpen} onOpenChange={setIsPauseDialogOpen} defaultValue={pendingCompletionData?.task?.pauseNote || ''} task={pendingCompletionData?.task} onConfirm={async (note, pauseOptions) => { await pauseTask(pendingCompletionData.task.id, { note, ...pauseOptions }); setIsPauseDialogOpen(false); setPendingCompletionData(null); }} />
        <TaskPickerDialog open={isTaskPickerOpen} onOpenChange={setIsTaskPickerOpen} tasks={recommendationCandidates} onSelect={(task) => { setSelectedRecommendationId(task.id); setSkippedSuggestionIds([]); setIsTaskPickerOpen(false); }} onViewAll={() => setIsTaskPickerOpen(false)} />
        <SmallerStepDialog task={smallStepTask} open={Boolean(smallStepTask)} onOpenChange={(open) => { if (!open) { setSmallStepTask(null); setSmallStepMinutes(null); } }} onApply={(nextAction, options) => updateTask(smallStepTask.id, { nextAction, ...(smallStepMinutes ? { nextActionMinutes: options?.isUndo ? smallStepTask.nextActionMinutes || null : smallStepMinutes } : {}) })} />
        <BlockedHelpDialog task={highlightTask} isOpen={isBlockedDialogOpen} onOpenChange={setIsBlockedDialogOpen} onRequestBreakDown={() => { setSmallStepTask(highlightTask); setIsBlockedDialogOpen(false); }} updateTaskById={updateTask} createSupportTask={addTask} deleteSupportTask={deleteTask} />
        <Dialog open={isHardDayOpen} onOpenChange={setIsHardDayOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>O que ajudaria agora?</DialogTitle><DialogDescription>Escolha um ajuste temporário para este momento.</DialogDescription></DialogHeader>
            <div className="grid gap-2">
              <Button variant="outline" className="justify-start" onClick={() => { setSmallStepMinutes(5); setSmallStepTask(highlightTask); setIsHardDayOpen(false); }}>Mostrar algo bem pequeno</Button>
              <Button variant="outline" className="justify-start" onClick={handleLowEnergyChoice}>Escolher uma tarefa de baixa energia</Button>
              <Button variant="outline" className="justify-start" onClick={() => handleStartTask(highlightTask, { blockMinutes: 5 })}>Fazer apenas 5 minutos</Button>
              <QuickCaptureDialog triggerLabel="Só quero tirar coisas da cabeça" />
              <Button variant="outline" className="justify-start" onClick={() => navigate('/calendario')}>Replanejar o restante do dia</Button>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={isNoAlternativeOpen} onOpenChange={setIsNoAlternativeOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Estas são as tarefas disponíveis para este momento.</DialogTitle><DialogDescription>Você pode ajustar o contexto ou reduzir a quantidade de decisões na tela.</DialogDescription></DialogHeader>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button onClick={() => { setIsNoAlternativeOpen(false); openCheckInEditor(); }}>Ajustar energia e tempo</Button>
              <Button variant="outline" onClick={() => { setIsNoAlternativeOpen(false); document.getElementById('open-tasks')?.scrollIntoView({ behavior: 'smooth' }); }}>Ver todas</Button>
              <Button variant="ghost" onClick={() => { setIsNoAlternativeOpen(false); setLowStimulationMode(true); }}>Ativar Modo tranquilo</Button>
            </div>
          </DialogContent>
        </Dialog>
        <AlertDialog open={Boolean(deleteTaskTarget)} onOpenChange={(open) => !open && setDeleteTaskTarget(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir esta tarefa?</AlertDialogTitle><AlertDialogDescription>Esta ação remove a tarefa da sua conta.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={async () => { await deleteTask(deleteTaskTarget.id); setDeleteTaskTarget(null); }}>Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      </div>
    </>
  );
}