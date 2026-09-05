
import React, { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { Focus, Play, Pause, CheckCircle2, ArrowLeft, RefreshCw, Pencil } from 'lucide-react';
import Header from '@/components/Header.jsx';
import Sidebar from '@/components/Sidebar.jsx';
import MobileNav from '@/components/MobileNav.jsx';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useTaskContext } from '@/hooks/useTaskContext.js';
import MicrotaskList from '@/components/MicrotaskList.jsx';
import EditTaskModal from '@/components/EditTaskModal.jsx';
import BlockedHelpDialog from '@/components/BlockedHelpDialog.jsx';
import { useTheme } from '@/contexts/ThemeContext.jsx';
import { addTaskHistoryEvent } from '@/services/taskHistoryService.js';
import TaskCompletionDialog from '@/components/TaskCompletionDialog.jsx';
import {
  getTaskMicrotaskProgress,
  normalizeTaskStatus,
  TASK_STATUS,
  upsertMicrotaskCompletion
} from '@/lib/taskExecution.js';
import TaskPendingMicrotasksDialog from '@/components/TaskPendingMicrotasksDialog.jsx';
import TaskPauseDialog from '@/components/TaskPauseDialog.jsx';
import { getActiveWorkSession } from '@/services/workSessionService.js';
import { getTaskNextActionPresentation } from '@/lib/todayViewLogic.js';
import { useProfessionalJourney } from '@/contexts/ProfessionalJourneyContext.jsx';

export default function FocusPage() {
  const navigate = useNavigate();
  const {
    selectedTask,
    addTask,
    completeTask,
    setSelectedTask,
    setCheckIn,
    checkIn,
    tasks,
    updateTask,
    recordFocusSession,
    startTask,
    pauseTask,
    resumeTask
  } = useTaskContext();
  const { lowStimulationMode } = useTheme();
  const { currentJourney, startActivity } = useProfessionalJourney();
  
  const [phase, setPhase] = useState(selectedTask ? 'setup' : 'none');
  const [objective, setObjective] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [timeTotal, setTimeTotal] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [activeMicrotasks, setActiveMicrotasks] = useState(selectedTask?.microtarefas || []);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isBlockedDialogOpen, setIsBlockedDialogOpen] = useState(false);
  const [sessionResult, setSessionResult] = useState('');
  const [nextActionAfterSession, setNextActionAfterSession] = useState('');
  const [isCompletionDialogOpen, setIsCompletionDialogOpen] = useState(false);
  const [pendingCompletionData, setPendingCompletionData] = useState(null);
  const [pendingCompletionPayload, setPendingCompletionPayload] = useState(null);
  const [isPauseDialogOpen, setIsPauseDialogOpen] = useState(false);
  const [microtaskTransition, setMicrotaskTransition] = useState(null);
  const [showAllMicrotasks, setShowAllMicrotasks] = useState(false);
  const [showTimer, setShowTimer] = useState(!lowStimulationMode);
  const sessionRecordedRef = useRef(false);
  const focusBlockMinutes = Number(selectedTask?.focusBlockMinutes || selectedTask?.timeEstimate || 30);

  // Sync selectedTask when global tasks change (after edit)
  useEffect(() => {
    if (selectedTask) {
      const updatedTask = tasks.find(t => t.id === selectedTask.id);
      if (updatedTask) {
        setSelectedTask(updatedTask);
        setActiveMicrotasks(updatedTask.microtarefas || []);
      }
    }
  }, [tasks, selectedTask, setSelectedTask]);

  useEffect(() => {
    if (!selectedTask?.id || phase !== 'setup') return;
    const activeSession = getActiveWorkSession();
    if (!activeSession?.id || activeSession.taskId !== selectedTask.id) return;

    const totalSeconds = focusBlockMinutes * 60;
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - new Date(activeSession.startedAt).getTime()) / 1000));
    setTimeTotal(totalSeconds);
    setTimeRemaining(Math.max(0, totalSeconds - elapsedSeconds));
    setPhase(elapsedSeconds >= totalSeconds ? 'completed' : 'working');
    setIsPaused(false);
  }, [focusBlockMinutes, phase, selectedTask]);

  useEffect(() => {
    if (!selectedTask?.id || objective.trim()) return;
    const presentation = getTaskNextActionPresentation(selectedTask);
    const suggestedObjective = presentation.action || `Avançar de forma concreta em: ${selectedTask.title}`;
    setObjective(suggestedObjective);
  }, [objective, selectedTask]);

  useEffect(() => {
    setShowTimer(!lowStimulationMode);
  }, [lowStimulationMode]);

  useEffect(() => {
    let interval;
    if (phase === 'working' && !isPaused && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            setPhase('completed');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [phase, isPaused, timeRemaining]);

  const handleStart = async () => {
    const totalSecs = focusBlockMinutes * 60;
    setTimeTotal(totalSecs);
    setTimeRemaining(totalSecs);
    setSessionResult('');
    setNextActionAfterSession('');
    sessionRecordedRef.current = false;
    setPhase('working');
    setIsPaused(false);

    if (selectedTask?.id) {
      try {
        const status = normalizeTaskStatus(selectedTask.status);
        const updatedTask = status === TASK_STATUS.PAUSADA
          ? await resumeTask(selectedTask.id)
          : await startTask(selectedTask.id);

        if (updatedTask) {
          setSelectedTask(updatedTask);
          setActiveMicrotasks(updatedTask.microtarefas || []);
        }
        if (currentJourney?.status === 'active' && currentJourney.projectName === (selectedTask.project || 'Pessoal')) {
          await startActivity({ title: selectedTask.title, taskId: selectedTask.id, source: 'task' });
        }
      } catch (error) {
        console.error('Erro ao iniciar sessão de trabalho:', error);
      }
    }
  };

  const persistFocusSession = async (endReason) => {
    if (!selectedTask?.id || sessionRecordedRef.current || timeTotal <= 0) return;

    const durationSeconds = Math.max(0, timeTotal - timeRemaining);
    if (durationSeconds < 5) return;

    const activeSession = getActiveWorkSession();
    await recordFocusSession({
      taskId: selectedTask.id,
      idempotencyKey: activeSession?.taskId === selectedTask.id ? activeSession.id : undefined,
      durationSeconds,
      objective,
      result: sessionResult.trim(),
      endReason
    });

    sessionRecordedRef.current = true;
  };

  const persistNextAction = async () => {
    const nextAction = nextActionAfterSession.trim();
    if (!selectedTask?.id || !nextAction) return;

    const updatedTask = await updateTask(selectedTask.id, { nextAction });
    setSelectedTask(updatedTask);
  };

  const handleCompleteTask = async (payload) => {
    if (!selectedTask) return;

    try {
      await persistNextAction();
      const durationSeconds = Math.max(0, timeTotal - timeRemaining);
      const completionPayload = {
        ...payload,
        ...(durationSeconds >= 5 ? {
          focusSession: {
            durationSeconds,
            objective,
            result: sessionResult.trim(),
            endReason: 'Tarefa concluída'
          }
        } : {})
      };
      setPendingCompletionPayload(completionPayload);
      const result = await completeTask(selectedTask.id, completionPayload);
      if (result?.blocked) {
        setPendingCompletionData(result);
        setIsCompletionDialogOpen(false);
        return;
      }
      setSelectedTask(null);
      navigate('/');
    } catch (error) {
      console.error('Erro ao registrar sessão de foco:', error);
    }
  };

  const handleMarkRemainingAsDone = async () => {
    if (!selectedTask?.id) return;
    const result = await completeTask(selectedTask.id, {
      ...(pendingCompletionPayload || {}),
      markRemainingAsDone: true
    });
    if (!result?.blocked) {
      setPendingCompletionData(null);
      setPendingCompletionPayload(null);
      setSelectedTask(null);
      navigate('/');
    }
  };

  const handleForceComplete = async () => {
    if (!selectedTask?.id) return;
    const result = await completeTask(selectedTask.id, {
      ...(pendingCompletionPayload || {}),
      forceComplete: true
    });
    if (!result?.blocked) {
      setPendingCompletionData(null);
      setPendingCompletionPayload(null);
      setSelectedTask(null);
      navigate('/');
    }
  };

  const handleBack = async () => {
    try {
      if (phase === 'working' || phase === 'completed') {
        await persistFocusSession('Sessão pausada');
        await persistNextAction();
        if (selectedTask?.id) {
          await pauseTask(selectedTask.id, { note: '' });
        }
      }
    } catch (error) {
      console.error('Erro ao pausar sessão de foco:', error);
    }
    setSelectedTask(null);
    navigate('/');
  };

  const addTime = () => {
    const added = 15 * 60;
    setTimeTotal(prev => prev + added);
    setTimeRemaining(prev => prev + added);
    setPhase('working');
    setIsPaused(false);
  };

  const handleReorganize = async () => {
    try {
      await persistFocusSession('Reorganizada por energia baixa');
      await persistNextAction();
    } catch (error) {
      console.error('Erro ao reorganizar sessão de foco:', error);
    }
    setCheckIn({ ...checkIn, energia: 'Baixa', mente: 'Sobrecarregada' });
    if (selectedTask?.id) {
      await pauseTask(selectedTask.id, { note: 'Sessão reorganizada por energia baixa.' });
    }
    setSelectedTask(null);
    navigate('/');
  };

  const handleToggleMicrotask = async (id, checked, options = {}) => {
    if (!selectedTask?.id) return;

    const updatedMicrotasks = upsertMicrotaskCompletion(activeMicrotasks, id, checked, selectedTask.id);

    setActiveMicrotasks(updatedMicrotasks);

    try {
      const updatedTask = await updateTask(selectedTask.id, { microtarefas: updatedMicrotasks });
      setSelectedTask(updatedTask);
      if (checked && options.announce !== false) {
        const progress = getTaskMicrotaskProgress(updatedTask);
        setMicrotaskTransition({ completedId: id, nextStep: progress.nextPending?.title || '', allDone: progress.total > 0 && progress.pending === 0 });
        setShowAllMicrotasks(false);
      } else if (!checked) {
        setMicrotaskTransition(null);
      }
      addTaskHistoryEvent({
        taskId: selectedTask.id,
        projectId: selectedTask.project || 'Pessoal',
        type: checked ? 'microtask_completed' : 'microtask_reopened',
        message: checked ? 'Microtarefa concluída' : 'Microtarefa reaberta'
      });
    } catch {
      setActiveMicrotasks(activeMicrotasks);
    }
  };

  const handleUndoMicrotask = async () => {
    if (!microtaskTransition?.completedId) return;
    await handleToggleMicrotask(microtaskTransition.completedId, false, { announce: false });
  };

  const handlePauseTask = async (note, pauseOptions = {}) => {
    if (!selectedTask?.id) return;
    await persistFocusSession('Tarefa pausada');
    await persistNextAction();
    await pauseTask(selectedTask.id, { note, ...pauseOptions });
    setSelectedTask(null);
    navigate('/');
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const microtaskProgress = getTaskMicrotaskProgress({ ...selectedTask, microtarefas: activeMicrotasks });
  const nextPendingMicrotaskId = microtaskProgress.nextPending?.id || selectedTask?.lastActiveSubtaskId || '';
  const currentFocusStep = microtaskProgress.nextPending?.title || objective || getTaskNextActionPresentation(selectedTask).action;
  const hasCompletedAllSteps = microtaskProgress.total > 0 && microtaskProgress.pending === 0;

  if (phase === 'none' || !selectedTask) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-8 text-center mt-20">
            <div className="max-w-md mx-auto bg-card p-10 rounded-3xl border border-border shadow-sm">
              <Focus className="w-16 h-16 text-muted-foreground mx-auto mb-6 opacity-30" />
              <h1 className="text-2xl font-medium mb-4 text-foreground">Nenhuma tarefa selecionada</h1>
              <p className="text-muted-foreground mb-8">Para iniciar uma sessão de foco, escolha uma tarefa na tela "Hoje".</p>
              <Button onClick={() => navigate('/')} size="lg" className="w-full h-14 rounded-2xl">Voltar para Hoje</Button>
            </div>
          </main>
        </div>
        <MobileNav />
      </div>
    );
  }

  return (
    <>
      <Helmet><title>Foco - Clareia</title></Helmet>
      <div className="min-h-screen bg-background text-foreground">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 pb-20 md:pb-8 flex flex-col items-center p-4 pt-10 md:pt-16">
            
            {phase === 'setup' && (
              <Card className={`w-full ${lowStimulationMode ? 'max-w-xl' : 'max-w-2xl'} animate-in fade-in zoom-in-95 duration-500 border-border bg-card shadow-lg rounded-3xl relative`}>
                <CardContent className="p-8 md:p-10">
                  <div className="flex justify-between items-center mb-6">
                    <Button variant="ghost" onClick={handleBack} className="text-muted-foreground hover:text-foreground -ml-4">
                      <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setIsEditModalOpen(true)} className="text-muted-foreground hover:text-foreground">
                      <Pencil className="w-4 h-4 mr-2" /> Editar Tarefa
                    </Button>
                  </div>
                  
                  <div className="mb-8">
                    <h1 className="text-3xl font-medium text-foreground mb-2">Preparando o foco</h1>
                    {!lowStimulationMode && <p className="text-muted-foreground">O que você fará nos próximos {focusBlockMinutes} minutos.</p>}
                    {currentJourney?.projectName === (selectedTask.project || 'Pessoal') && (
                      <p className="mt-2 text-sm text-muted-foreground">{currentJourney.projectName} · jornada {currentJourney.status === 'paused' ? 'pausada' : 'em andamento'}</p>
                    )}
                  </div>

                  <div className="bg-secondary/30 p-6 rounded-2xl mb-8 border border-border">
                    <h2 className="text-xl font-medium text-foreground mb-1">{selectedTask.title}</h2>
                    {selectedTask.project && <p className="text-sm text-muted-foreground font-medium mb-4">{selectedTask.project}</p>}

                    {selectedTask.pauseNote && (
                      <div className="mb-4 rounded-xl border border-amber-300/50 bg-amber-50 p-3">
                        <p className="text-xs font-bold uppercase tracking-wider text-amber-800">Onde parei?</p>
                        <p className="text-sm text-amber-900">{selectedTask.pauseNote}</p>
                      </div>
                    )}
                    
                    {selectedTask.nextAction && !lowStimulationMode && (
                      <div className="bg-card rounded-xl p-4 border border-border">
                        <p className="text-xs uppercase tracking-wider font-bold text-muted-foreground mb-1">Primeiro passo</p>
                        <p className="text-foreground">{selectedTask.nextAction}</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-6">
                    <div>
                      <Label className="text-lg font-medium text-foreground mb-3 block">Objetivo deste bloco</Label>
                      <Input 
                        value={objective}
                        onChange={e => setObjective(e.target.value)}
                        placeholder="Ex: Ter enviado o email para os 3 clientes atrasados"
                        className="h-14 text-lg bg-card text-foreground px-4 rounded-xl"
                        autoFocus
                      />
                    </div>

                    <Button 
                      onClick={handleStart} 
                      disabled={!objective.trim()}
                      className="w-full bg-primary hover:bg-primary/90 text-primary-foreground text-lg h-16 rounded-2xl shadow-sm"
                    >
                      <Play className="w-5 h-5 mr-2 fill-current" /> Começar foco
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {phase === 'working' && (
              <div className={`w-full ${lowStimulationMode ? 'max-w-2xl' : 'max-w-4xl'} animate-in fade-in duration-500 py-4 flex flex-col ${lowStimulationMode ? '' : 'lg:flex-row'} gap-8 items-start relative`}>
                
                <div className="flex-1 w-full space-y-6">
                  <div className="bg-card border border-border rounded-3xl p-8 shadow-sm relative">
                    <div className="absolute top-8 right-8">
                      <Button variant="ghost" size="icon" onClick={() => setIsEditModalOpen(true)} className="text-muted-foreground hover:text-foreground">
                        <Pencil className="w-5 h-5" />
                      </Button>
                    </div>
                    <p className="text-primary uppercase tracking-widest text-xs font-bold mb-4 flex items-center"><span className="w-2 h-2 rounded-full bg-primary animate-pulse mr-2" /> Foco Ativo</p>
                    {currentJourney?.projectName === (selectedTask.project || 'Pessoal') && (
                      <p className="mb-2 text-sm text-muted-foreground">{currentJourney.projectName} · jornada {currentJourney.status === 'paused' ? 'pausada' : 'em andamento'}</p>
                    )}
                    <h1 className="text-2xl md:text-3xl font-medium text-foreground leading-tight mb-6 pr-12">{selectedTask.title}</h1>
                    
                    {!hasCompletedAllSteps && (
                      <div className="rounded-2xl border border-border bg-secondary/40 p-5">
                        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Agora faça isto</p>
                        <p className="text-lg font-medium text-foreground">{currentFocusStep}</p>
                        {microtaskProgress.nextPending && (
                          <Button
                            className="mt-4"
                            variant="outline"
                            onClick={() => handleToggleMicrotask(microtaskProgress.nextPending.id, true)}
                          >
                            <CheckCircle2 className="h-4 w-4" /> Marcar como feito
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                  {microtaskTransition?.allDone && (
                    <section className="rounded-lg border border-border bg-card p-5" aria-live="polite" aria-atomic="true">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="font-medium text-foreground">Todos os passos foram concluídos.</p>
                        <Button variant="ghost" onClick={handleUndoMicrotask}>Desfazer</Button>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button onClick={() => setIsCompletionDialogOpen(true)}>Concluir tarefa</Button>
                        <Button variant="outline" onClick={() => setMicrotaskTransition(null)}>Continuar trabalhando</Button>
                        <Button variant="ghost" onClick={() => setShowAllMicrotasks(true)}>Rever passos</Button>
                      </div>
                    </section>
                  )}

                  {activeMicrotasks.length > 0 && !hasCompletedAllSteps && (
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm text-muted-foreground">
                          Passo {Math.min(microtaskProgress.completed + 1, microtaskProgress.total)} de {microtaskProgress.total}
                        </p>
                        <Button variant="ghost" onClick={() => setShowAllMicrotasks((current) => !current)}>
                          {showAllMicrotasks ? 'Ocultar passos' : 'Ver todos os passos'}
                        </Button>
                      </div>
                      {showAllMicrotasks && (
                        <MicrotaskList
                          microtasks={activeMicrotasks}
                          taskType={selectedTask.taskType}
                          onToggle={handleToggleMicrotask}
                          highlightMicrotaskId={nextPendingMicrotaskId}
                        />
                      )}
                    </div>
                  )}
                </div>

                <div className={`w-full ${lowStimulationMode ? '' : 'lg:w-80 shrink-0 sticky top-24'} bg-card border border-border rounded-3xl p-8 shadow-sm flex flex-col items-center text-center`}>
                  {showTimer ? (
                    <>
                      <div className="mb-4 text-6xl font-medium leading-none tracking-tighter text-foreground tabular-nums md:text-7xl font-variant-numeric:tabular-nums">
                        {formatTime(timeRemaining)}
                      </div>
                      <div className={`text-sm font-medium text-muted-foreground ${lowStimulationMode ? 'mb-4' : 'mb-8'}`}>
                        Decorridos: {Math.floor((timeTotal - timeRemaining) / 60)} min / {Math.floor(timeTotal / 60)} min
                      </div>
                      {lowStimulationMode && <Button className="mb-4" variant="ghost" onClick={() => setShowTimer(false)}>Ocultar tempo</Button>}
                    </>
                  ) : (
                    <div className="mb-6">
                      <p className="font-medium text-foreground">Em andamento</p>
                      <p className="mt-1 text-sm text-muted-foreground">Você começou esta tarefa.</p>
                      <Button className="mt-3" variant="ghost" onClick={() => setShowTimer(true)}>Ver tempo</Button>
                    </div>
                  )}

                  <div className="w-full space-y-3">
                    <Button size="lg" variant="outline" onClick={() => setIsPauseDialogOpen(true)} className="w-full h-14 text-base rounded-2xl border-border bg-background text-foreground hover:bg-muted">
                      <Pause className="w-5 h-5 mr-2" />
                      Pausar
                    </Button>
                    <Button size="lg" variant="outline" onClick={() => setIsBlockedDialogOpen(true)} className="w-full h-14 text-base rounded-2xl border-border bg-background text-foreground hover:bg-muted">
                      Estou travada
                    </Button>
                    <Button size="lg" onClick={() => setIsCompletionDialogOpen(true)} className="w-full h-14 text-base bg-green-600 hover:bg-green-700 text-white rounded-2xl shadow-sm">
                      <CheckCircle2 className="w-5 h-5 mr-2" /> Concluir Tarefa
                    </Button>
                  </div>
                </div>

              </div>
            )}

            {phase === 'completed' && (
              <Card className="w-full max-w-xl animate-in zoom-in-95 duration-500 text-center border-border bg-card shadow-lg rounded-3xl">
                <CardContent className="p-10 space-y-8">
                  <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto text-primary">
                    <CheckCircle2 className="w-12 h-12" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-medium text-foreground mb-3">Tempo finalizado!</h2>
                    <p className="text-lg text-muted-foreground">
                      O bloco de foco acabou. Como você se sente para continuar?
                    </p>
                  </div>

                  <div className="space-y-4 text-left">
                    <div className="space-y-2">
                      <Label htmlFor="session-result">O que avançou neste bloco?</Label>
                      <Textarea
                        id="session-result"
                        value={sessionResult}
                        onChange={(event) => setSessionResult(event.target.value)}
                        placeholder="Ex.: corrigi o formulário e validei no celular."
                        className="min-h-24 bg-background"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="next-action-after-session">Próximo passo, se houver</Label>
                      <Input
                        id="next-action-after-session"
                        value={nextActionAfterSession}
                        onChange={(event) => setNextActionAfterSession(event.target.value)}
                        placeholder="Ex.: publicar a alteração após o retorno do cliente"
                        className="bg-background"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-3">
                    <Button size="lg" onClick={() => setIsCompletionDialogOpen(true)} className="h-14 text-lg rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90">
                      <CheckCircle2 className="w-5 h-5 mr-2" /> Concluir a tarefa inteira
                    </Button>
                    <Button size="lg" variant="outline" onClick={addTime} className="h-14 text-lg rounded-2xl border-border bg-card text-foreground hover:bg-muted">
                      Continuar mais 15 min
                    </Button>
                    <Button size="lg" variant="outline" onClick={handleReorganize} className="h-14 text-lg rounded-2xl border-border bg-secondary/50 text-foreground hover:bg-secondary">
                      <RefreshCw className="w-5 h-5 mr-2" /> Reorganizar agenda (cansei)
                    </Button>
                    <Button size="lg" variant="ghost" onClick={handleBack} className="h-14 text-lg text-muted-foreground hover:text-foreground">
                      Voltar para Hoje
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

          </main>
        </div>
        <MobileNav />

        <BlockedHelpDialog
          task={selectedTask}
          isOpen={isBlockedDialogOpen}
          onOpenChange={setIsBlockedDialogOpen}
          onRequestBreakDown={() => {
            setIsBlockedDialogOpen(false);
            setIsEditModalOpen(true);
          }}
          updateTaskById={updateTask}
          createSupportTask={addTask}
        />
      </div>

      <EditTaskModal 
        task={selectedTask} 
        isOpen={isEditModalOpen} 
        onClose={() => setIsEditModalOpen(false)} 
      />

      <TaskCompletionDialog
        isOpen={isCompletionDialogOpen}
        onOpenChange={setIsCompletionDialogOpen}
        task={selectedTask}
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
        defaultValue={selectedTask?.pauseNote || ''}
        task={selectedTask}
        onConfirm={handlePauseTask}
      />
    </>
  );
}
