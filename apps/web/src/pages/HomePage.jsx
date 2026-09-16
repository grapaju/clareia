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
import { useProfessionalJourney } from '@/contexts/ProfessionalJourneyContext.jsx';
import { reorganizeTasksByEnergy } from '@/lib/energyLogic.js';
import { buildTodayGroups, getTaskNextActionPresentation, getTodayHighlight, getTodayPresentation } from '@/lib/todayViewLogic.js';
import { isTaskActionableStatus, normalizeTaskStatus, TASK_STATUS } from '@/lib/taskExecution.js';
import { formatDurationFriendly, getCheckInAvailableMinutes } from '@/lib/reportFormatting.js';
import { selectTasksWithinDailyCapacity } from '@/lib/planningEngine.js';
import { toIsoDate } from '@/lib/localDate.js';
import { UI_COPY } from '@/lib/uiCopy.js';
import { getActiveWorkSession } from '@/services/workSessionService.js';
import { readUserPreferences } from '@/services/userPreferencesService.js';

function currentDateLabel() {
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
}

export default function HomePage() {
  const { tasks, addTask, updateTask, deleteTask, completeTask, reopenTask, startTask, resumeTask, pauseTask, setSelectedTask, checkIn, hasTodayCheckIn, isCheckInEditing, openCheckInEditor, getTaskWorkedMinutes, isLoading, loadError, refreshTasks } = useTaskContext();
  const { currentUser } = useAuth();
  const { lowStimulationMode, setLowStimulationMode } = useTheme();
  const { currentJourney } = useProfessionalJourney();
  const navigate = useNavigate();
  const location = useLocation();
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
  const declaredAvailableMinutes = getCheckInAvailableMinutes(checkIn?.tempo || '2h');
  const dailyPlan = useMemo(() => selectTasksWithinDailyCapacity(
    [...canonical.groups.overdue, ...canonical.groups.today],
    { availableMinutes: declaredAvailableMinutes },
  ), [canonical.groups.overdue, canonical.groups.today, declaredAvailableMinutes]);
  const visibleTodayTasks = dailyPlan.tasks;
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
  const highlightCandidates = useMemo(() => visibleTodayTasks.filter((task) => !dismissedHighlightIds.includes(task.id)), [dismissedHighlightIds, visibleTodayTasks]);
  const highlight = useMemo(() => getTodayHighlight(highlightCandidates, recommended, activeSession, checkIn), [activeSession?.id, activeSession?.taskId, checkIn, highlightCandidates, recommended]);
  const presentation = useMemo(() => getTodayPresentation(visibleTodayTasks, highlight, lowStimulationMode), [highlight, lowStimulationMode, visibleTodayTasks]);
  const highlightTask = presentation.highlight;
  const otherTasks = presentation.visibleTasks;
  const nextActionPresentation = highlightTask ? getTaskNextActionPresentation(highlightTask) : null;
  const highlightProgress = nextActionPresentation?.progress || null;
  const nextStep = nextActionPresentation?.action || '';
  const lastCompletedStep = highlightProgress?.normalized?.filter((item) => item.completed).at(-1)?.title || '';
  const isResumeHighlight = ['active_session', 'paused', 'started'].includes(highlight.reason);
  const showCompactDayPanel = hasTodayCheckIn && !isCheckInEditing;
  const isJourneyRunning = currentJourney?.status === 'active';
  const overdueCount = canonical.groups.overdue.length;
  const weeklyPlannedCount = useMemo(() => {
    const end = new Date();
    end.setDate(end.getDate() + 7);
    const endIso = toIsoDate(end);
    return canonical.groups.upcoming.filter((task) => toIsoDate(task.scheduledDate || task.dataSugeridaExecucao) <= endIso).length;
  }, [canonical.groups.upcoming]);
  const deadlineRisks = tasks.filter((task) => task.deadlineRisk && isTaskActionableStatus(task.status));

  const executeTaskStart = async (task, options = {}) => {
    const updated = normalizeTaskStatus(task.status) === TASK_STATUS.PAUSADA ? await resumeTask(task.id) : await startTask(task.id);
    setSelectedTask({ ...(updated || task), ...(options.blockMinutes ? { focusBlockMinutes: options.blockMinutes } : {}) });
    navigate('/foco');
  };
  const handleStartTask = executeTaskStart;
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
  const rowProps = (task) => ({ task, isRecommended: Boolean(recommended?.id === task.id && recommended.id !== highlightTask?.id), onStart: handleStartTask, onOpen: setDetailsTask, onEdit: setEditTask, onComplete: setCompletionTask, onReopen: (item) => reopenTask(item.id, 'Hoje'), onWaiting: (item) => updateTask(item.id, { status: TASK_STATUS.AGUARDANDO_RETORNO }), onArchive: (item) => updateTask(item.id, { status: TASK_STATUS.ARQUIVADA }), onDelete: setDeleteTaskTarget });

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
            <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
              {!lowStimulationMode && <PreferencesOnboarding />}
              {!lowStimulationMode && (
                <header className="mb-7 pt-1">
                  <h1 className="text-3xl font-semibold text-foreground">Hoje</h1>
                  <p className="mt-2 text-base font-medium capitalize text-foreground/80">{currentDateLabel()}</p>
                  <p className="mt-2 max-w-2xl text-base leading-relaxed text-muted-foreground">{UI_COPY.today.intro}</p>
                </header>
              )}

              {isLoading ? (
                <div className="space-y-3 py-6" role="status" aria-label="Carregando tarefas">
                  <div className="skeleton-pulse h-12 rounded bg-muted" />
                  <div className="skeleton-pulse h-48 rounded bg-muted" />
                  <div className="skeleton-pulse h-28 rounded bg-muted" />
                </div>
              ) : loadError ? (
                <div className="my-6 border-y border-destructive/30 py-6" role="alert">
                  <p className="font-medium text-foreground">{loadError}</p>
                  <Button className="mt-3" variant="outline" onClick={refreshTasks}>Tentar novamente</Button>
                </div>
              ) : (
                <>
                  {lowStimulationMode && <CheckInCard compact availableMinutes={declaredAvailableMinutes} />}
                  {!lowStimulationMode && !showCompactDayPanel && <CheckInCard availableMinutes={declaredAvailableMinutes} />}

                  {lowStimulationMode ? (
                    <section className="mx-auto max-w-2xl py-4" aria-labelledby="calm-mode-title">
                      <h1 ref={calmTitleRef} tabIndex={-1} id="calm-mode-title" className="text-2xl font-medium text-foreground focus:outline-none">Um passo de cada vez</h1>
                      <ProfessionalJourneyCard compact periodAvailableMinutes={declaredAvailableMinutes} />
                      {highlightTask ? (
                        <div key={highlightTask.id} className="content-fade-in mt-6 border-y border-border py-6">
                          <p className="text-sm text-muted-foreground">{isResumeHighlight ? 'Continue de onde parou' : 'Para começar agora'}</p>
                          <h2 className="mt-2 text-2xl font-medium text-foreground">{highlightTask.title}</h2>
                          <p className="mt-5 text-sm font-medium text-muted-foreground">Agora</p>
                          <p className="mt-1 text-base text-foreground">{nextStep}</p>
                          {nextActionPresentation.actionMinutes > 0 && <p className="mt-2 text-sm text-muted-foreground">Cerca de {formatDurationFriendly(nextActionPresentation.actionMinutes)}</p>}
                          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                            <Button className="press-feedback" onClick={() => handleStartTask(highlightTask)}><Play className="mr-1.5 h-4 w-4" aria-hidden="true" /> {isResumeHighlight ? 'Continuar' : 'Começar'}</Button>
                            <Button variant="outline" onClick={() => setIsBlockedDialogOpen(true)}>Não consigo agora</Button>
                            <Button variant="ghost" onClick={() => setLowStimulationMode(false)}>Ver todas as tarefas</Button>
                          </div>
                          <Button className="mt-4 px-0" variant="link" onClick={() => setIsHardDayOpen(true)}>Hoje está difícil</Button>
                        </div>
                      ) : (
                        <div className="mt-6 border-y border-border py-6">
                          <p className="text-foreground">{UI_COPY.today.empty}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{UI_COPY.today.emptyHelp}</p>
                          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                            <QuickCaptureDialog />
                            <Button variant="ghost" onClick={() => setLowStimulationMode(false)}>Sair do Modo tranquilo</Button>
                          </div>
                        </div>
                      )}
                    </section>
                  ) : (
                  <>
                  {(!showCompactDayPanel || isJourneyRunning) && <ProfessionalJourneyCard periodAvailableMinutes={declaredAvailableMinutes} />}
                  <div className={showCompactDayPanel ? 'grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-start' : ''}>
                  {showCompactDayPanel && (
                    <aside className="min-w-0 lg:sticky lg:top-24 lg:order-2" aria-label="Jornada e resumo do dia">
                      <CheckInCard availableMinutes={declaredAvailableMinutes} />
                      {!isJourneyRunning && <ProfessionalJourneyCard compact periodAvailableMinutes={declaredAvailableMinutes} />}
                    </aside>
                  )}
                  <div className="min-w-0 lg:order-1">
                  {(dailyPlan.tasks.length > 0 || deadlineRisks.length > 0) && (
                    <div className="mb-4 space-y-2" role="status">
                      {dailyPlan.tasks.length > 0 && <p className="text-sm text-muted-foreground">Planejado para hoje: <span className="font-medium text-foreground">{formatDurationFriendly(dailyPlan.plannedMinutes)}</span></p>}
                      {deadlineRisks.length > 0 && <p className="rounded-md bg-muted/60 px-4 py-3 text-sm text-foreground">{deadlineRisks[0].deadlineRiskMessage}</p>}
                    </div>
                  )}
                  {highlightTask && (
                    <section key={highlightTask.id} className="today-motion-card content-fade-in mb-7 rounded-lg border border-border border-l-4 border-l-primary bg-card p-5 shadow-sm transition-[border-color,box-shadow,transform] duration-300 sm:p-7" aria-labelledby="recommendation-title">
                      <p className="mb-2 text-sm font-semibold text-primary">{isResumeHighlight ? (highlight.reason === 'active_session' ? 'Sessão em andamento' : 'Você parou aqui') : 'Por onde começar'}</p>
                      <button type="button" className="block w-full rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setDetailsTask(highlightTask)}>
                        <h2 id="recommendation-title" className="text-2xl font-medium text-foreground">{highlightTask.title}</h2>
                        <p className="mt-2 text-sm text-muted-foreground">{highlightTask.project || 'Pessoal'}</p>
                      </button>
                      <div className="mt-4 rounded-md bg-muted/60 px-4 py-3">
                        {lastCompletedStep && isResumeHighlight && <p className="mb-1 text-xs text-muted-foreground">Último passo concluído: {lastCompletedStep}</p>}
                        <p className="text-xs font-medium text-muted-foreground">Próximo passo</p>
                        <p className="mt-1 text-sm text-foreground">{nextStep}</p>
                        {nextActionPresentation.actionMinutes > 0 && <p className="mt-1 text-xs text-muted-foreground">Cerca de {formatDurationFriendly(nextActionPresentation.actionMinutes)}</p>}
                        {!isResumeHighlight && nextActionPresentation.blockMinutes > 0 && <p className="mt-1 text-xs text-muted-foreground">Bloco de foco sugerido: {formatDurationFriendly(nextActionPresentation.blockMinutes)}</p>}
                        {nextActionPresentation.pauseNote && <p className="mt-2 text-sm text-muted-foreground">Onde você parou: {nextActionPresentation.pauseNote}</p>}
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <Button className="press-feedback" onClick={() => handleStartTask(highlightTask)}><Play className="mr-1.5 h-4 w-4" aria-hidden="true" /> {isResumeHighlight ? 'Continuar de onde parei' : 'Começar agora'}</Button>
                        <Button variant="outline" onClick={isResumeHighlight ? handleDismissHighlight : handleAnotherSuggestion}>Agora não</Button>
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

                  {(otherTasks.length > 0 || overdueCount > 0) && (
                    <section id="open-tasks" className="content-fade-in mb-6 scroll-mt-24" aria-labelledby="other-tasks-title">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Depois</p>
                      <h2 id="other-tasks-title" className="mt-1 text-lg font-medium text-foreground">O que pode ficar para depois</h2>
                      {overdueCount > 0 && (
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-md bg-muted/60 px-4 py-3">
                          <p className="text-sm text-foreground">Tem {overdueCount} {overdueCount === 1 ? 'coisa para reorganizar' : 'coisas para reorganizar'}</p>
                          <Button size="sm" variant="ghost" onClick={() => navigate('/calendario')}>Ver</Button>
                        </div>
                      )}
                      {otherTasks.length > 0 && (
                        <ul className="mt-4 overflow-hidden rounded-lg border border-border bg-card">
                          {otherTasks.map((task) => <TodayTaskRow key={task.id} {...rowProps(task)} />)}
                        </ul>
                      )}
                    </section>
                  )}

                  {weeklyPlannedCount > 0 && (
                    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-y border-border py-3">
                      <p className="text-sm text-muted-foreground">Mais {weeklyPlannedCount} {weeklyPlannedCount === 1 ? 'tarefa já distribuída' : 'tarefas já distribuídas'} para esta semana.</p>
                      <Button size="sm" variant="ghost" onClick={() => navigate('/calendario')}>Ver planejamento</Button>
                    </div>
                  )}

                  {canonical.completedToday.length > 0 && (
                    <details className="rounded-lg border border-border bg-card">
                      <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Concluídas hoje <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-semibold text-muted-foreground">{canonical.completedToday.length}</span></summary>
                      <ul className="border-t border-border">{canonical.completedToday.map((task) => <TodayTaskRow key={task.id} {...rowProps(task)} completed workedMinutes={getTaskWorkedMinutes(task.id)} />)}</ul>
                    </details>
                  )}

                  {!highlightTask && otherTasks.length === 0 && (
                    <div className="my-8 text-sm text-muted-foreground">
                      <p>{UI_COPY.today.empty}</p>
                      <p className="mt-1">{UI_COPY.today.emptyHelp}</p>
                    </div>
                  )}
                  </div>
                  </div>
                  </>
                  )}
                </>
              )}
            </div>
          </main>
        </div>
        <MobileNav />

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
        <AlertDialog open={Boolean(deleteTaskTarget)} onOpenChange={(open) => !open && setDeleteTaskTarget(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Remover “{deleteTaskTarget?.title}”?</AlertDialogTitle><AlertDialogDescription>A tarefa será removida para sempre e não poderá ser recuperada.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Agora não</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={async () => { await deleteTask(deleteTaskTarget.id); setDeleteTaskTarget(null); }}>Remover tarefa</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      </div>
    </>
  );
}
