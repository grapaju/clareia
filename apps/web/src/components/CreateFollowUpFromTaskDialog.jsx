import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { createWaitingReturn, syncWaitingReturnsWithCloud } from '@/services/waitingReturnService.js';
import { addTaskHistoryEvent } from '@/services/taskHistoryService.js';
import { buildFollowUpSuggestionFromTask } from '@/lib/taskFollowUpSuggestions.js';

export default function CreateFollowUpFromTaskDialog({
  isOpen,
  onOpenChange,
  task,
  onConfirmMarkTaskDone
}) {
  const [form, setForm] = useState(() => buildFollowUpSuggestionFromTask(task || {}));
  const [createdItem, setCreatedItem] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    setForm(buildFollowUpSuggestionFromTask(task || {}));
    setCreatedItem(null);
  }, [isOpen, task?.id]);

  const handleSave = () => {
    if (!task?.id) {
      toast.error('Selecione uma tarefa para criar acompanhamento.');
      return;
    }

    const created = createWaitingReturn({
      title: form.title,
      project: form.project,
      contactName: form.contactName,
      lastContactDate: form.lastContactDate,
      reminderDate: form.reminderDate,
      nextFollowUpDate: form.nextFollowUpDate || form.reminderDate,
      nextFollowUp: form.nextFollowUp,
      waitingFor: form.waitingFor,
      observations: form.observations,
      status: 'Aguardando retorno'
    });

    if (!created) {
      toast.error('Preencha título, projeto, pessoa/empresa e o que está aguardando.');
      return;
    }

    addTaskHistoryEvent({
      taskId: task?.id,
      projectId: task?.project || 'Pessoal',
      type: 'task_moved_to_waiting_return',
      message: 'Tarefa movida para aguardando retorno'
    });

    syncWaitingReturnsWithCloud();
    setCreatedItem(created);
    toast.success('Acompanhamento criado em Aguardando retorno.');
  };

  const handleClose = () => {
    setCreatedItem(null);
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Criar acompanhamento</DialogTitle>
            <DialogDescription>
              Campos preenchidos automaticamente para agilizar o follow-up.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2 md:col-span-2">
              <Label>Título</Label>
              <Input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
            </div>

            <div className="space-y-2">
              <Label>Projeto</Label>
              <Input value={form.project} onChange={(event) => setForm((current) => ({ ...current, project: event.target.value }))} />
            </div>

            <div className="space-y-2">
              <Label>Pessoa/empresa</Label>
              <Input value={form.contactName} onChange={(event) => setForm((current) => ({ ...current, contactName: event.target.value }))} />
            </div>

            <div className="space-y-2">
              <Label>Último contato</Label>
              <Input type="date" value={form.lastContactDate} onChange={(event) => setForm((current) => ({ ...current, lastContactDate: event.target.value }))} />
            </div>

            <div className="space-y-2">
              <Label>Lembrar em</Label>
              <Input type="date" value={form.reminderDate} onChange={(event) => setForm((current) => ({ ...current, reminderDate: event.target.value, nextFollowUpDate: event.target.value }))} />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Próximo follow-up</Label>
              <Input value={form.nextFollowUp} onChange={(event) => setForm((current) => ({ ...current, nextFollowUp: event.target.value }))} />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>O que estou aguardando</Label>
              <Textarea value={form.waitingFor} onChange={(event) => setForm((current) => ({ ...current, waitingFor: event.target.value }))} className="min-h-20" />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Observações</Label>
              <Textarea value={form.observations} onChange={(event) => setForm((current) => ({ ...current, observations: event.target.value }))} className="min-h-20" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!task?.id}>Salvar acompanhamento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(createdItem)} onOpenChange={(open) => !open && setCreatedItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deseja marcar a tarefa original como concluída?</AlertDialogTitle>
            <AlertDialogDescription>
              O acompanhamento já foi criado em Aguardando retorno.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleClose}>Agora não</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              onConfirmMarkTaskDone?.();
              handleClose();
            }}>
              Sim, concluir tarefa original
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
