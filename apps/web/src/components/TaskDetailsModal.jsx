import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, CheckCircle2, Pencil, Archive, Trash2, MoreHorizontal, Timer, CircleHelp } from 'lucide-react';
import { useTaskContext } from '@/hooks/useTaskContext.js';
import MicrotaskList from '@/components/MicrotaskList.jsx';
import EditTaskModal from '@/components/EditTaskModal.jsx';
import TaskActivityPanel from '@/components/TaskActivityPanel.jsx';
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
import { toast } from 'sonner';
import { getScheduledLabelForTask } from '@/lib/schedulingRules.js';
import { listProjectFiles, listTaskRelatedFiles, updateProjectFile } from '@/services/projectFileService.js';
import { listProjectLinks, listTaskRelatedLinks, updateProjectLink } from '@/services/projectLinkService.js';
import { listProjectNotes, listTaskRelatedNotes, updateProjectNote } from '@/services/projectNoteService.js';
import BlockedHelpDialog from '@/components/BlockedHelpDialog.jsx';
import { listProjectAccesses, listTaskRelatedAccesses, updateProjectAccess } from '@/services/projectAccessService.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { listTaskHistory } from '@/services/taskHistoryService.js';
import ManualTimeDialog from '@/components/ManualTimeDialog.jsx';
import { addTaskHistoryEvent } from '@/services/taskHistoryService.js';
import TaskCompletionDialog from '@/components/TaskCompletionDialog.jsx';
import CreateFollowUpFromTaskDialog from '@/components/CreateFollowUpFromTaskDialog.jsx';
import { normalizeTaskStatus, TASK_STATUS, upsertMicrotaskCompletion } from '@/lib/taskExecution.js';
import TaskPendingMicrotasksDialog from '@/components/TaskPendingMicrotasksDialog.jsx';
import TaskPauseDialog from '@/components/TaskPauseDialog.jsx';

export default function TaskDetailsModal({ task, isOpen, onClose }) {
  const navigate = useNavigate();
  const { addTask, updateTask, completeTask, reopenTask, deleteTask, setSelectedTask, startTask, resumeTask, pauseTask } = useTaskContext();
  const [microtasks, setMicrotasks] = useState(Array.isArray(task?.microtarefas) ? task.microtarefas : []);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isBlockedDialogOpen, setIsBlockedDialogOpen] = useState(false);
  const [isReopenOpen, setIsReopenOpen] = useState(false);
  const [isCompletionDialogOpen, setIsCompletionDialogOpen] = useState(false);
  const [isFollowUpDialogOpen, setIsFollowUpDialogOpen] = useState(false);
  const [isManualTimeOpen, setIsManualTimeOpen] = useState(false);
  const [pendingCompletionData, setPendingCompletionData] = useState(null);
  const [pendingCompletionPayload, setPendingCompletionPayload] = useState(null);
  const [isPauseDialogOpen, setIsPauseDialogOpen] = useState(false);
  const [relatedMaterials, setRelatedMaterials] = useState({ files: [], links: [], accesses: [], notes: [] });
  const [linkSelection, setLinkSelection] = useState({ fileId: 'none', linkId: 'none', accessId: 'none', noteId: 'none' });
  const [taskHistory, setTaskHistory] = useState([]);

  useEffect(() => {
    setMicrotasks(Array.isArray(task?.microtarefas) ? task.microtarefas : []);
  }, [task]);

  useEffect(() => {
    if (!task?.id) {
      setRelatedMaterials({ files: [], links: [], accesses: [], notes: [] });
      return;
    }

    setRelatedMaterials({
      files: listTaskRelatedFiles(task.id),
      links: listTaskRelatedLinks(task.id),
      accesses: listTaskRelatedAccesses(task.id),
      notes: listTaskRelatedNotes(task.id)
    });
    setTaskHistory(listTaskHistory(task.id));
  }, [task?.id]);

  const projectMaterials = {
    files: listProjectFiles(task?.project || '').filter((item) => !item.relatedTaskIds?.includes(task?.id)),
    links: listProjectLinks(task?.project || '').filter((item) => !item.relatedTaskIds?.includes(task?.id)),
    accesses: listProjectAccesses(task?.project || '').filter((item) => !item.relatedTaskIds?.includes(task?.id)),
    notes: listProjectNotes(task?.project || '').filter((item) => !item.relatedTaskIds?.includes(task?.id))
  };

  const refreshMaterials = () => {
    if (!task?.id) return;
    setRelatedMaterials({
      files: listTaskRelatedFiles(task.id),
      links: listTaskRelatedLinks(task.id),
      accesses: listTaskRelatedAccesses(task.id),
      notes: listTaskRelatedNotes(task.id)
    });
  };

  const linkMaterial = () => {
    if (!task?.id) return;

    if (linkSelection.fileId !== 'none') {
      const file = projectMaterials.files.find((item) => item.id === linkSelection.fileId);
      if (file) updateProjectFile(file.id, { relatedTaskIds: [...(file.relatedTaskIds || []), task.id] });
    }

    if (linkSelection.linkId !== 'none') {
      const link = projectMaterials.links.find((item) => item.id === linkSelection.linkId);
      if (link) updateProjectLink(link.id, { relatedTaskIds: [...(link.relatedTaskIds || []), task.id] });
    }

    if (linkSelection.accessId !== 'none') {
      const access = projectMaterials.accesses.find((item) => item.id === linkSelection.accessId);
      if (access) updateProjectAccess(access.id, { relatedTaskIds: [...(access.relatedTaskIds || []), task.id] });
    }

    if (linkSelection.noteId !== 'none') {
      const note = projectMaterials.notes.find((item) => item.id === linkSelection.noteId);
      if (note) updateProjectNote(note.id, { relatedTaskIds: [...(note.relatedTaskIds || []), task.id] });
    }

    setLinkSelection({ fileId: 'none', linkId: 'none', accessId: 'none', noteId: 'none' });
    refreshMaterials();
    toast.success('Materiais vinculados à tarefa.');
  };

  const handleToggleMicrotask = async (id, checked) => {
    if (!task?.id) return;

    const updated = upsertMicrotaskCompletion(microtasks, id, checked, task.id);

    setMicrotasks(updated);

    try {
      await updateTask(task.id, { microtarefas: updated });
      addTaskHistoryEvent({
        taskId: task.id,
        projectId: task.project || 'Pessoal',
        type: 'microtask_toggled',
        message: checked ? 'Microtarefa concluída' : 'Microtarefa reaberta'
      });
      setTaskHistory(listTaskHistory(task.id));
    } catch {
      // ignore toast duplication from context
    }
  };

  const handleStart = async () => {
    if (!task) return;
    const status = normalizeTaskStatus(task.status);
    const updated = status === TASK_STATUS.PAUSADA
      ? await resumeTask(task.id)
      : await startTask(task.id);
    setSelectedTask({ ...(updated || task), microtarefas: microtasks });
    onClose();
    navigate('/foco');
  };

  const handleComplete = async (payload) => {
    if (!task?.id) return;
    setPendingCompletionPayload(payload);
    const result = await completeTask(task.id, payload);
    if (result?.blocked) {
      setIsCompletionDialogOpen(false);
      setPendingCompletionData(result);
      return;
    }
    onClose();
  };

  const handleArchive = async () => {
    if (!task?.id) return;
    await updateTask(task.id, { status: TASK_STATUS.ARQUIVADA });
    toast.success('Tarefa arquivada no backlog.');
    onClose();
  };

  const handleMarkRemainingAsDone = async () => {
    if (!task?.id) return;
    const result = await completeTask(task.id, {
      ...(pendingCompletionPayload || {}),
      markRemainingAsDone: true
    });
    if (!result?.blocked) {
      setPendingCompletionData(null);
      setPendingCompletionPayload(null);
      onClose();
    }
  };

  const handleForceComplete = async () => {
    if (!task?.id) return;
    const result = await completeTask(task.id, {
      ...(pendingCompletionPayload || {}),
      forceComplete: true
    });
    if (!result?.blocked) {
      setPendingCompletionData(null);
      setPendingCompletionPayload(null);
      onClose();
    }
  };

  const handlePauseFromPending = async (note) => {
    if (!task?.id) return;
    await pauseTask(task.id, { note });
    setPendingCompletionData(null);
    setPendingCompletionPayload(null);
    setIsPauseDialogOpen(false);
    onClose();
  };

  const handleDelete = async () => {
    if (!task?.id) return;
    await deleteTask(task.id);
    toast.success('Tarefa excluída.');
    setIsDeleteOpen(false);
    onClose();
  };

  const handleReopen = async (destination) => {
    if (!task?.id) return;
    await reopenTask(task.id, destination);
    toast.success(`Tarefa reaberta para ${destination}.`);
    setIsReopenOpen(false);
    onClose();
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] max-w-[760px] overflow-x-hidden overflow-y-auto bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-xl text-foreground">Ver detalhes</DialogTitle>
          </DialogHeader>

          {task && (
            <div className="min-w-0 space-y-4">
              <div>
                <h3 className="text-lg font-medium text-foreground mb-2">{task.title}</h3>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{task.project || 'Pessoal'}</Badge>
                  <Badge variant="outline">{task.timeEstimate || 30} min</Badge>
                  <Badge variant="outline">{task.energiaNecessaria || 'Média'} energia</Badge>
                  {task.executionDifficulty && <Badge variant="outline">{task.executionDifficulty}</Badge>}
                  <Badge variant="outline">{task.whenToExecute || getScheduledLabelForTask(task, new Date())}</Badge>
                </div>
              </div>

              <Tabs defaultValue="execucao" className="min-w-0">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="execucao">Execução</TabsTrigger>
                  <TabsTrigger value="materiais">Materiais</TabsTrigger>
                  <TabsTrigger value="historico">Histórico</TabsTrigger>
                </TabsList>

                <TabsContent value="execucao" className="space-y-4 pt-2">

              {task.description && (
                <div className="rounded-lg border border-border bg-muted/20 p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Contexto inicial</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{task.description}</p>
                </div>
              )}

              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-1">Primeira ação</p>
                <p className="text-sm text-foreground">{task.nextAction || task.microtarefas?.[0]?.title || task.microtarefas?.[0]?.descricao || 'Definir o primeiro passo prático'}</p>
              </div>

              <MicrotaskList
                microtasks={microtasks}
                taskType={task.taskType}
                onToggle={handleToggleMicrotask}
              />

                </TabsContent>

                <TabsContent value="materiais" className="pt-2">

              <div className="rounded-xl border border-border bg-muted/20 p-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2">Materiais relacionados</p>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Arquivos vinculados ({relatedMaterials.files.length})</p>
                    {relatedMaterials.files.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Nenhum arquivo vinculado.</p>
                    ) : (
                      <ul className="mt-1 space-y-1">
                        {relatedMaterials.files.slice(0, 5).map((item) => (
                          <li key={item.id} className="text-xs text-foreground">{item.name}</li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div>
                    <p className="text-sm font-medium text-foreground">Links vinculados ({relatedMaterials.links.length})</p>
                    {relatedMaterials.links.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Nenhum link vinculado.</p>
                    ) : (
                      <ul className="mt-1 space-y-1">
                        {relatedMaterials.links.slice(0, 5).map((item) => (
                          <li key={item.id} className="text-xs text-foreground truncate">{item.title}</li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div>
                    <p className="text-sm font-medium text-foreground">Acessos vinculados ({relatedMaterials.accesses.length})</p>
                    {relatedMaterials.accesses.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Nenhum acesso vinculado.</p>
                    ) : (
                      <ul className="mt-1 space-y-1">
                        {relatedMaterials.accesses.slice(0, 5).map((item) => (
                          <li key={item.id} className="text-xs text-foreground truncate">{item.title}</li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div>
                    <p className="text-sm font-medium text-foreground">Notas vinculadas ({relatedMaterials.notes.length})</p>
                    {relatedMaterials.notes.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Nenhuma nota vinculada.</p>
                    ) : (
                      <ul className="mt-1 space-y-1">
                        {relatedMaterials.notes.slice(0, 5).map((item) => (
                          <li key={item.id} className="text-xs text-foreground">{item.title || 'Nota sem titulo'}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {task.project && (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2">
                    <Select value={linkSelection.fileId} onValueChange={(value) => setLinkSelection((current) => ({ ...current, fileId: value }))}>
                      <SelectTrigger><SelectValue placeholder="Vincular arquivo" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem arquivo</SelectItem>
                        {projectMaterials.files.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
                      </SelectContent>
                    </Select>

                    <Select value={linkSelection.linkId} onValueChange={(value) => setLinkSelection((current) => ({ ...current, linkId: value }))}>
                      <SelectTrigger><SelectValue placeholder="Vincular link" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem link</SelectItem>
                        {projectMaterials.links.map((item) => <SelectItem key={item.id} value={item.id}>{item.title}</SelectItem>)}
                      </SelectContent>
                    </Select>

                    <Select value={linkSelection.accessId} onValueChange={(value) => setLinkSelection((current) => ({ ...current, accessId: value }))}>
                      <SelectTrigger><SelectValue placeholder="Vincular acesso" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem acesso</SelectItem>
                        {projectMaterials.accesses.map((item) => <SelectItem key={item.id} value={item.id}>{item.title}</SelectItem>)}
                      </SelectContent>
                    </Select>

                    <Select value={linkSelection.noteId} onValueChange={(value) => setLinkSelection((current) => ({ ...current, noteId: value }))}>
                      <SelectTrigger><SelectValue placeholder="Vincular nota" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem nota</SelectItem>
                        {projectMaterials.notes.map((item) => <SelectItem key={item.id} value={item.id}>{item.title || 'Nota sem titulo'}</SelectItem>)}
                      </SelectContent>
                    </Select>

                    <div className="md:col-span-2">
                      <Button size="sm" variant="outline" onClick={linkMaterial}>Vincular materiais selecionados</Button>
                    </div>
                  </div>
                )}
              </div>

                </TabsContent>

                <TabsContent value="historico" className="space-y-4 pt-2">

              <TaskActivityPanel taskId={task.id} />

              <div className="rounded-xl border border-border bg-muted/20 p-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2">Histórico da tarefa</p>
                {taskHistory.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Sem eventos registrados ainda.</p>
                ) : (
                  <ul className="space-y-1">
                    {taskHistory.slice(0, 8).map((event) => (
                      <li key={event.id} className="text-xs text-foreground">
                        {new Date(event.createdAt).toLocaleString('pt-BR')} - {event.message}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
                </TabsContent>
              </Tabs>
            </div>
          )}

          <DialogFooter className="flex-row items-center justify-between gap-2 sm:space-x-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Mais ações da tarefa" title="Mais ações da tarefa">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => setIsEditOpen(true)}>
                  <Pencil className="h-4 w-4" /> Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsFollowUpDialogOpen(true)}>
                  <CheckCircle2 className="h-4 w-4" /> Criar acompanhamento
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsManualTimeOpen(true)}>
                  <Timer className="h-4 w-4" /> Adicionar tempo manual
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setIsBlockedDialogOpen(true)}>
                  <CircleHelp className="h-4 w-4" /> Estou travada
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleArchive}>
                  <Archive className="h-4 w-4" /> Arquivar tarefa
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setIsDeleteOpen(true)} className="text-destructive focus:text-destructive">
                  <Trash2 className="h-4 w-4" /> Excluir tarefa
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
              {normalizeTaskStatus(task?.status) === TASK_STATUS.CONCLUIDA && (
                <Button variant="outline" onClick={() => setIsReopenOpen(true)} className="shrink-0">
                  Reabrir tarefa
                </Button>
              )}
              <Button variant="outline" onClick={() => setIsCompletionDialogOpen(true)} className="shrink-0">
                <CheckCircle2 className="mr-2 h-4 w-4" /> Concluir
              </Button>
              <Button onClick={handleStart} className="shrink-0">
                <Play className="mr-2 h-4 w-4" /> {normalizeTaskStatus(task?.status) === TASK_STATUS.PAUSADA ? 'Continuar de onde parei' : 'Começar'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EditTaskModal
        task={task}
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
      />

      <ManualTimeDialog
        isOpen={isManualTimeOpen}
        onOpenChange={setIsManualTimeOpen}
        defaultProject={task?.project || 'Pessoal'}
        defaultTaskId={task?.id || 'none'}
        tasks={task ? [task] : []}
        onSaved={() => setTaskHistory(task?.id ? listTaskHistory(task.id) : [])}
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
        deleteSupportTask={deleteTask}
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

      <Dialog open={isReopenOpen} onOpenChange={setIsReopenOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Deseja reabrir esta tarefa?</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-2">
            <Button onClick={() => handleReopen('Hoje')}>Reabrir para hoje</Button>
            <Button variant="outline" onClick={() => handleReopen('Esta semana')}>Reabrir para esta semana</Button>
            <Button variant="outline" onClick={() => handleReopen('Pendente')}>Reabrir como pendente</Button>
            <Button variant="ghost" onClick={() => setIsReopenOpen(false)}>Cancelar</Button>
          </div>
        </DialogContent>
      </Dialog>

      <TaskCompletionDialog
        isOpen={isCompletionDialogOpen}
        onOpenChange={setIsCompletionDialogOpen}
        task={task}
        onConfirm={handleComplete}
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
        defaultValue={task?.pauseNote || ''}
        onConfirm={handlePauseFromPending}
      />

      <CreateFollowUpFromTaskDialog
        isOpen={isFollowUpDialogOpen}
        onOpenChange={setIsFollowUpDialogOpen}
        task={task}
        onConfirmMarkTaskDone={() => setIsCompletionDialogOpen(true)}
      />
    </>
  );
}
