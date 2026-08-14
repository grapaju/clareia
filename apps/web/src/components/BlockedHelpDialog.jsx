import React, { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { createWaitingReturn, listWaitingReturns, syncWaitingReturnsWithCloud } from '@/services/waitingReturnService.js';
import { addTaskHistoryEvent } from '@/services/taskHistoryService.js';

const BLOCK_REASONS = [
  {
    id: 'nao-sei-comecar',
    label: 'Nao sei começar',
    recommendation: 'Execute apenas a primeira ação por 5 minutos.',
    apply: async ({ task, updateTask }) => {
      const firstAction = task?.nextAction || task?.microtarefas?.[0]?.descricao || `Abrir a tarefa e escrever o primeiro passo por 5 minutos`;
      await updateTask(task.id, {
        nextAction: `${firstAction} (apenas 5 minutos)`
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

export default function BlockedHelpDialog({ task, isOpen, onOpenChange, onRequestBreakDown, updateTaskById, createSupportTask }) {
  const [selectedId, setSelectedId] = useState(BLOCK_REASONS[0].id);
  const [isApplying, setIsApplying] = useState(false);
  const [noPriorityDestination, setNoPriorityDestination] = useState('esta-semana');

  const selectedReason = useMemo(() => BLOCK_REASONS.find((item) => item.id === selectedId) || BLOCK_REASONS[0], [selectedId]);

  const moveTaskToWaitingReturn = async ({ reason }) => {
    if (!task?.id) return;

    const marker = `[taskId:${task.id}]`;
    const existing = listWaitingReturns().find((item) => String(item.observations || '').includes(marker) && item.status !== 'Concluido');

    if (!existing) {
      const created = createWaitingReturn({
        title: `Dependencia: ${task.title || 'Tarefa'}`,
        project: task.project || 'Pessoal',
        contactName: 'A definir',
        waitingFor: task.nextAction || task.title || 'Retorno para continuidade da tarefa',
        nextFollowUp: 'Definir responsavel e data de retorno',
        observations: `Criado automaticamente via Estou travada (${reason}). ${marker}`,
        status: 'Aguardando retorno'
      });

      if (!created) {
        throw new Error('Nao foi possivel criar item em aguardando retorno.');
      }

      syncWaitingReturnsWithCloud();
    }

    // Usa um status válido da agenda para evitar falha de persistência em tarefas.
    await updateTaskById(task.id, { status: 'Backlog' });
    addTaskHistoryEvent({
      taskId: task.id,
      projectId: task.project || 'Pessoal',
      type: 'task_moved_to_waiting_return',
      message: 'Tarefa movida para aguardando retorno'
    });
  };

  const handleApply = async () => {
    if (!task?.id || !selectedReason) return;
    setIsApplying(true);
    try {
      if (selectedReason.id === 'falta-informacao') {
        if (createSupportTask) {
          await createSupportTask({
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
        }
        await moveTaskToWaitingReturn({ reason: 'Falta informação' });
      } else if (selectedReason.id === 'depende-de-alguem') {
        await moveTaskToWaitingReturn({ reason: 'Depende de alguem' });
      } else if (selectedReason.id === 'nao-prioridade') {
        await updateTaskById(task.id, {
          status: noPriorityDestination === 'arquivar' ? 'Backlog' : 'Esta semana'
        });
      } else {
        await selectedReason.apply({
          task,
          updateTask: updateTaskById,
          onRequestBreakDown
        });
      }

      toast.success(selectedReason.recommendation);
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

        {selectedReason.id === 'nao-prioridade' && (
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs font-medium uppercase text-muted-foreground mb-2">Destino</p>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={noPriorityDestination === 'esta-semana' ? 'default' : 'outline'}
                onClick={() => setNoPriorityDestination('esta-semana')}
              >
                Esta semana
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
