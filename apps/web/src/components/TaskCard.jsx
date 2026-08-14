
import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, CheckCircle2, Clock, Eye, MoreHorizontal, Pencil, Trash2, Archive } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTaskContext } from '@/hooks/useTaskContext.js';
import TaskDetailsModal from '@/components/TaskDetailsModal.jsx';
import EditTaskModal from '@/components/EditTaskModal.jsx';
import TaskCompletionDialog from '@/components/TaskCompletionDialog.jsx';
import CreateFollowUpFromTaskDialog from '@/components/CreateFollowUpFromTaskDialog.jsx';
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
import { getScheduledLabelForTask } from '@/lib/schedulingRules.js';
import { toast } from 'sonner';
import { useTheme } from '@/contexts/ThemeContext.jsx';
import BlockedHelpDialog from '@/components/BlockedHelpDialog.jsx';
import { isFollowUpCandidateTask } from '@/lib/taskFollowUpSuggestions.js';
import { listWaitingReturns } from '@/services/waitingReturnService.js';
import { listWorkSessions } from '@/services/workSessionService.js';
import { listCalendarCommitments } from '@/services/calendarCommitmentService.js';
import { suggestCalendarSlotForTask } from '@/services/calendarPlanningService.js';
import { normalizeTaskStatus, TASK_STATUS } from '@/lib/taskExecution.js';
import TaskPendingMicrotasksDialog from '@/components/TaskPendingMicrotasksDialog.jsx';
import TaskPauseDialog from '@/components/TaskPauseDialog.jsx';
import { useAppMode } from '@/contexts/AppModeContext.jsx';

export default function TaskCard({ task, minimal }) {
  const navigate = useNavigate();
  const { addTask, completeTask, deleteTask, updateTask, setSelectedTask, tasks, checkIn, startTask, resumeTask, pauseTask } = useTaskContext();
  const { lowStimulationMode } = useTheme();
  const { isDailyMode } = useAppMode();
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isBlockedDialogOpen, setIsBlockedDialogOpen] = useState(false);
  const [isCompletionDialogOpen, setIsCompletionDialogOpen] = useState(false);
  const [isFollowUpDialogOpen, setIsFollowUpDialogOpen] = useState(false);
  const [pendingCompletionData, setPendingCompletionData] = useState(null);
  const [pendingCompletionPayload, setPendingCompletionPayload] = useState(null);
  const [isPauseDialogOpen, setIsPauseDialogOpen] = useState(false);

  const normalizedStatus = normalizeTaskStatus(task?.status);
  const isPaused = normalizedStatus === TASK_STATUS.PAUSADA;

  const handleStart = async () => {
    const nextTask = isPaused
      ? await resumeTask(task.id)
      : await startTask(task.id);
    setSelectedTask(nextTask || task);
    navigate('/foco');
  };

  const whenToExecute = task.whenToExecute || getScheduledLabelForTask(task, new Date());
  const firstAction = task.nextAction || task.microtarefas?.[0]?.title || task.microtarefas?.[0]?.descricao || '';

  const handleArchive = async () => {
    try {
      await updateTask(task.id, { status: TASK_STATUS.ARQUIVADA });
      toast.success('Tarefa arquivada no backlog.');
    } catch {
      // erros já tratados no contexto
    }
  };

  const handleDelete = async () => {
    try {
      await deleteTask(task.id);
      toast.success('Tarefa excluída.');
      setIsDeleteOpen(false);
    } catch {
      // erros já tratados no contexto
    }
  };

  const handleCompleteWithTime = async (payload) => {
    try {
      setPendingCompletionPayload(payload);
      const result = await completeTask(task.id, payload);
      if (result?.blocked) {
        setPendingCompletionData(result);
        setIsCompletionDialogOpen(false);
        return;
      }
      setIsCompletionDialogOpen(false);
      toast.success('Tarefa concluída.');
    } catch {
      // erros já tratados no contexto
    }
  };

  const handlePauseFromPending = async (note) => {
    try {
      await pauseTask(task.id, { note });
      setPendingCompletionData(null);
      setPendingCompletionPayload(null);
      setIsPauseDialogOpen(false);
      toast.success('Tarefa pausada.');
    } catch {
      // erros já tratados no contexto
    }
  };

  const handleMarkRemainingAsDone = async () => {
    const result = await completeTask(task.id, {
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
    const result = await completeTask(task.id, {
      ...(pendingCompletionPayload || {}),
      forceComplete: true
    });
    if (!result?.blocked) {
      setPendingCompletionData(null);
      setPendingCompletionPayload(null);
      toast.success('Tarefa concluída manualmente.');
    }
  };

  const handleFitIntoCalendar = async () => {
    try {
      const suggestion = suggestCalendarSlotForTask(task, {
        tasks,
        checkIn,
        followups: listWaitingReturns(),
        focusBlocks: listWorkSessions(),
        commitments: listCalendarCommitments(),
        startDate: new Date()
      });

      if (!suggestion?.date) {
        toast.error('Não foi possível sugerir encaixe no calendário.');
        return;
      }

      await updateTask(task.id, {
        scheduledDate: suggestion.date,
        dataSugeridaExecucao: suggestion.date,
        scheduledPeriod: suggestion.period,
        periodoSugerido: suggestion.period
      });

      if (suggestion.isOverloaded) {
        toast.warning('Esse dia está ficando pesado. Quer mover algo para outro dia?');
      } else {
        toast.success(`Tarefa encaixada para ${new Date(`${suggestion.date}T12:00:00`).toLocaleDateString('pt-BR')} (${suggestion.period}).`);
      }
    } catch {
      toast.error('Erro ao encaixar tarefa no calendário.');
    }
  };

  return (
    <>
      <Card className="card-hover flex flex-col h-full rounded-2xl overflow-hidden bg-card border-border shadow-sm">
        <CardContent className="p-5 flex flex-col h-full gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-card-foreground text-lg leading-snug mb-2">{task.title}</h3>
            
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {normalizedStatus === TASK_STATUS.EM_ANDAMENTO && (
                <span className="text-xs font-medium px-2 py-1 rounded-md bg-primary/10 text-primary">
                  Em andamento
                </span>
              )}
              {isPaused && (
                <span className="text-xs font-medium px-2 py-1 rounded-md bg-amber-100 text-amber-800">
                  Pausada
                </span>
              )}
              {task.project && (
                <span className="text-xs font-medium px-2 py-1 rounded-md bg-secondary text-secondary-foreground">
                  {task.project}
                </span>
              )}
              {task.timeEstimate && (
                <span className={`text-xs flex items-center gap-1 text-muted-foreground border border-border px-2 py-1 rounded-md ${lowStimulationMode ? 'secondary-badge' : ''}`}>
                  <Clock className="w-3 h-3" /> {task.timeEstimate} min
                </span>
              )}
              {task.energiaNecessaria && (
                <span className={`text-xs text-muted-foreground border border-border px-2 py-1 rounded-md ${lowStimulationMode ? 'secondary-badge' : ''}`}>
                  {task.energiaNecessaria} energia
                </span>
              )}
              {whenToExecute && (
                <span className="text-xs text-muted-foreground capitalize border border-border px-2 py-1 rounded-md">
                  {whenToExecute}
                </span>
              )}
            </div>
          </div>

          {firstAction && !minimal && (
            <div className="bg-muted/50 rounded-xl p-3 border border-border">
              <p className="text-sm text-foreground">
                <span className="font-medium text-muted-foreground block mb-0.5 text-xs uppercase tracking-wider">Primeira ação</span> 
                {firstAction}
              </p>
            </div>
          )}

          <div className="flex items-center gap-2 mt-auto pt-2 flex-wrap">
            <Button onClick={handleStart} className="bg-primary text-primary-foreground hover:bg-primary/90 h-10 rounded-xl shadow-sm flex-1 min-w-[140px]">
              <Play className="w-4 h-4 mr-1.5 fill-current" /> {isPaused ? 'Continuar de onde parei' : 'Começar'}
            </Button>

            {!isDailyMode && (
              <Button variant="outline" onClick={() => setIsBlockedDialogOpen(true)} className="h-10 rounded-xl border-border text-foreground hover:bg-muted">
                Estou travada
              </Button>
            )}

            {!isDailyMode && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-10 w-10 rounded-xl border-border text-foreground hover:bg-muted px-0 shrink-0" aria-label="Mais ações">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setIsDetailsOpen(true)}>
                    <Eye className="w-4 h-4" /> Ver detalhes
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsEditOpen(true)}>
                    <Pencil className="w-4 h-4" /> Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsCompletionDialogOpen(true)}>
                    <CheckCircle2 className="w-4 h-4" /> Concluir
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsFollowUpDialogOpen(true)}>
                    <CheckCircle2 className="w-4 h-4" /> Criar acompanhamento
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleFitIntoCalendar}>
                    <Clock className="w-4 h-4" /> Encaixar no calendário
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleArchive}>
                    <Archive className="w-4 h-4" /> Arquivar tarefa
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setIsDeleteOpen(true)} className="text-destructive focus:text-destructive">
                    <Trash2 className="w-4 h-4" /> Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {isFollowUpCandidateTask(task) && (
            <p className="text-xs text-muted-foreground">
              Sugestão: esta tarefa pode virar acompanhamento em Aguardando retorno.
            </p>
          )}
        </CardContent>
      </Card>
      
      <TaskDetailsModal 
        task={task} 
        isOpen={isDetailsOpen} 
        onClose={() => setIsDetailsOpen(false)} 
      />

      <BlockedHelpDialog
        task={task}
        isOpen={isBlockedDialogOpen}
        onOpenChange={setIsBlockedDialogOpen}
        onRequestBreakDown={() => {
          setIsBlockedDialogOpen(false);
          setIsEditOpen(true);
        }}
        updateTaskById={updateTask}
        createSupportTask={addTask}
      />

      <EditTaskModal
        task={task}
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
      />

      <TaskCompletionDialog
        isOpen={isCompletionDialogOpen}
        onOpenChange={setIsCompletionDialogOpen}
        task={task}
        onConfirm={handleCompleteWithTime}
      />

      <CreateFollowUpFromTaskDialog
        isOpen={isFollowUpDialogOpen}
        onOpenChange={setIsFollowUpDialogOpen}
        task={task}
        onConfirmMarkTaskDone={() => setIsCompletionDialogOpen(true)}
      />

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza que deseja excluir esta tarefa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove a tarefa da agenda atual.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir tarefa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TaskPendingMicrotasksDialog
        isOpen={Boolean(pendingCompletionData)}
        onOpenChange={(open) => {
          if (!open) {
            setPendingCompletionData(null);
          }
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
        defaultValue={task?.pauseNote || ''}
        onConfirm={handlePauseFromPending}
      />
    </>
  );
}
