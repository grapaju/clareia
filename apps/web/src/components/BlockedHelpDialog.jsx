import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { createWaitingReturn, deleteWaitingReturnEverywhere, listWaitingReturns, syncWaitingReturnsWithCloud } from '@/services/waitingReturnService.js';
import { addTaskHistoryEvent } from '@/services/taskHistoryService.js';
import { getTaskNextActionPresentation } from '@/lib/todayViewLogic.js';

const BLOCK_REASONS = [
  {
    id: 'nao-sei-comecar',
    label: 'Nao sei começar',
    recommendation: 'Execute apenas a primeira ação por 5 minutos.',
    apply: async ({ task, updateTask }) => {
      const firstAction = getTaskNextActionPresentation(task).action || 'Abrir a tarefa e escrever o primeiro passo';
      await updateTask(task.id, {
        nextAction: firstAction,
        nextActionMinutes: 5
      });
    }
  },
  {
    id: 'grande-demais',
    label: 'Está grande demais',
    recommendation: 'Vamos quebrar em microtarefas menores.',
    apply: async ({ onRequestBreakDown }) => {
      onRequestBreakDown?.();
    }
  },
  {
    id: 'falta-informacao',
    label: 'Falta informação',
    recommendation: 'Crie uma próxima ação para localizar ou pedir a informação.',
    apply: async ({ updateTask }) => {
      await updateTask?.();
    }
  },
  {
    id: 'depende-de-alguem',
    label: 'Depende de alguém',
    recommendation: 'Mover para Aguardando retorno.'
  },
  {
    id: 'sem-energia',
    label: 'Estou sem energia',
    recommendation: 'Reagendar para outro período e escolher uma tarefa leve.',
    apply: async ({ task, updateTask }) => {
      await updateTask(task.id, { status: 'Esta semana', scheduledPeriod: 'tarde', energiaNecessaria: 'Baixa' });
    }
  },
  {
    id: 'medo-errar',
    label: 'Estou com medo de errar',
    recommendation: 'Criar um rascunho ou versão preliminar antes da versão final.',
    apply: async ({ task, updateTask }) => {
      const current = String(task?.nextAction || '').trim();
      const prefix = 'Criar rascunho simples da solução';
      await updateTask(task.id, { nextAction: current ? `${prefix}. Depois: ${current}` : prefix });
    }
  },
  {
    id: 'nao-prioridade',
    label: 'Não é prioridade agora',
    recommendation: 'Mover para Esta semana ou Arquivar.',
    apply: async ({ task, updateTask }) => {
      await updateTask(task.id, { status: 'Esta semana' });
    }
  }
];

export default function BlockedHelpDialog({ task, isOpen, onOpenChange, onRequestBreakDown, updateTaskById, createSupportTask, deleteSupportTask }) {
  const [selectedId, setSelectedId] = useState(BLOCK_REASONS[0].id);
  const [isApplying, setIsApplying] = useState(false);
  const [noPriorityDestination, setNoPriorityDestination] = useState('reagendar');
  const [dependencyContact, setDependencyContact] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setDependencyContact('');
    setFollowUpDate('');
    setNoPriorityDestination('reagendar');
  }, [isOpen, task?.id]);

  const selectedReason = useMemo(() => BLOCK_REASONS.find((item) => item.id === selectedId) || BLOCK_REASONS[0], [selectedId]);

  const moveTaskToWaitingReturn = async ({ reason }) => {
    if (!task?.id) return;

    const marker = `[taskId:${task.id}]`;
    const existing = listWaitingReturns().find((item) => String(item.observations || '').includes(marker) && item.status !== 'Concluido');

    if (!existing) {
      const created = createWaitingReturn({
        title: `Dependencia: ${task.title || 'Tarefa'}`,
        project: task.project || 'Pessoal',
        contactName: dependencyContact,
        waitingFor: task.nextAction || task.title || 'Retorno para continuidade da tarefa',
        reminderDate: followUpDate,
        nextFollowUpDate: followUpDate,
        nextFollowUp: `Retomar contato com ${dependencyContact}`,
        observations: `Criado automaticamente via Estou travada (${reason}). ${marker}`,
        status: 'Aguardando retorno'
      });

      if (!created) {
        throw new Error('Nao foi possivel criar item em aguardando retorno.');
      }

      await syncWaitingReturnsWithCloud();
      await updateTaskById(task.id, { status: 'aguardando_retorno' });
      addTaskHistoryEvent({
        taskId: task.id,
        projectId: task.project || 'Pessoal',
        type: 'task_moved_to_waiting_return',
        message: `Aguardando retorno de ${dependencyContact} em ${followUpDate}`
      });
      return { createdWaitingId: created.id };
    }

    await updateTaskById(task.id, { status: 'aguardando_retorno' });
    addTaskHistoryEvent({
      taskId: task.id,
      projectId: task.project || 'Pessoal',
      type: 'task_moved_to_waiting_return',
      message: `Aguardando retorno de ${dependencyContact} em ${followUpDate}`
    });
    return { createdWaitingId: null };
  };

  const handleApply = async () => {
    if (!task?.id || !selectedReason) return;
    const requiresDependencyDetails = selectedReason.id === 'falta-informacao' || selectedReason.id === 'depende-de-alguem';
    if (requiresDependencyDetails && (!dependencyContact.trim() || !followUpDate)) {
      toast.error('Informe a pessoa e a data para acompanhar o retorno.');
      return;
    }
    if (selectedReason.id === 'nao-prioridade' && noPriorityDestination === 'reagendar' && !followUpDate) {
      toast.error('Escolha a nova data da tarefa.');
      return;
    }

    setIsApplying(true);
    const previousTask = {
      status: task.status,
      scheduledDate: task.scheduledDate || null,
      dataSugeridaExecucao: task.dataSugeridaExecucao || null,
      scheduledPeriod: task.scheduledPeriod || null,
      energiaNecessaria: task.energiaNecessaria || null,
      nextAction: task.nextAction || '',
      nextActionMinutes: task.nextActionMinutes || null
    };
    let createdWaitingId = null;
    let createdSupportTaskId = null;
    try {
      if (selectedReason.id === 'falta-informacao') {
        if (createSupportTask) {
          const supportTask = await createSupportTask({
            title: `Buscar informação: ${task.title}`,
            project: task.project || 'Pessoal',
            taskType: 'Administrativo',
            nextAction: 'Localizar ou pedir a informação que falta.',
            description: `Tarefa de apoio criada automaticamente a partir do bloqueio na tarefa: ${task.title}`,
            timeEstimate: 20,
            energiaNecessaria: 'Baixa',
            status: 'Hoje',
            scheduledDate: new Date().toISOString().split('T')[0],
            scheduledPeriod: 'tarde'
          });
          createdSupportTaskId = supportTask?.id || null;
        }
        ({ createdWaitingId } = await moveTaskToWaitingReturn({ reason: 'Falta informação' }));
      } else if (selectedReason.id === 'depende-de-alguem') {
        ({ createdWaitingId } = await moveTaskToWaitingReturn({ reason: 'Depende de alguem' }));
      } else if (selectedReason.id === 'nao-prioridade') {
        await updateTaskById(task.id, {
          status: noPriorityDestination === 'arquivar' ? 'arquivada' : 'pendente',
          ...(noPriorityDestination === 'reagendar' ? {
            scheduledDate: followUpDate,
            dataSugeridaExecucao: followUpDate
          } : {})
        });
      } else {
        await selectedReason.apply({
          task,
          updateTask: updateTaskById,
          onRequestBreakDown
        });
      }

      toast.success(selectedReason.recommendation, {
        action: {
          label: 'Desfazer',
          onClick: async () => {
            await updateTaskById(task.id, previousTask);
            if (createdWaitingId) {
              await deleteWaitingReturnEverywhere(createdWaitingId);
            }
            if (createdSupportTaskId && deleteSupportTask) {
              await deleteSupportTask(createdSupportTaskId);
            }
          }
        }
      });
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível aplicar a sugestão agora.');
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>O que está dificultando?</DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          {BLOCK_REASONS.map((reason) => (
            <button
              key={reason.id}
              type="button"
              onClick={() => setSelectedId(reason.id)}
              className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${selectedId === reason.id ? 'border-primary bg-primary/10 text-foreground' : 'border-border bg-card text-muted-foreground hover:bg-muted'}`}
            >
              {reason.label}
            </button>
          ))}
        </div>

        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <p className="text-xs font-medium uppercase text-muted-foreground mb-1">Sugestão</p>
          <p className="text-sm text-foreground">{selectedReason.recommendation}</p>
        </div>

        {(selectedReason.id === 'falta-informacao' || selectedReason.id === 'depende-de-alguem') && (
          <div className="grid gap-3 rounded-lg border border-border bg-card p-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="blocked-contact">De quem depende?</Label>
              <Input id="blocked-contact" value={dependencyContact} onChange={(event) => setDependencyContact(event.target.value)} placeholder="Nome da pessoa" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="blocked-follow-up">Quando acompanhar?</Label>
              <Input id="blocked-follow-up" type="date" value={followUpDate} onChange={(event) => setFollowUpDate(event.target.value)} />
            </div>
          </div>
        )}

        {selectedReason.id === 'nao-prioridade' && (
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs font-medium uppercase text-muted-foreground mb-2">Destino</p>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={noPriorityDestination === 'reagendar' ? 'default' : 'outline'}
                onClick={() => setNoPriorityDestination('reagendar')}
              >
                Reagendar
              </Button>
              <Button
                type="button"
                size="sm"
                variant={noPriorityDestination === 'arquivar' ? 'default' : 'outline'}
                onClick={() => setNoPriorityDestination('arquivar')}
              >
                Arquivar
              </Button>
            </div>
            {noPriorityDestination === 'reagendar' && (
              <div className="mt-3 space-y-2">
                <Label htmlFor="blocked-reschedule-date">Nova data</Label>
                <Input id="blocked-reschedule-date" type="date" value={followUpDate} onChange={(event) => setFollowUpDate(event.target.value)} />
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button onClick={handleApply} disabled={isApplying}>Aplicar sugestão</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
