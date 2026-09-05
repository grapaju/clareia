import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useTaskContext } from '@/hooks/useTaskContext.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { normalizeTaskStatus, TASK_STATUS } from '@/lib/taskExecution.js';
import { saveDailyWrapUp } from '@/services/dailyWrapUpService.js';
import { addManualWorkSession } from '@/services/workSessionService.js';
import { saveImprovementForLater } from '@/lib/improvementCapture.js';
import { useProfessionalJourney } from '@/contexts/ProfessionalJourneyContext.jsx';
import { isForgottenJourney } from '@/lib/professionalJourneyLogic.js';

function todayIso() {
  return new Date().toISOString().split('T')[0];
}

export default function DailyWrapUpDialog({ open, onOpenChange }) {
  const { currentUser } = useAuth();
  const {
    tasks,
    addTask,
    pauseTask
  } = useTaskContext();
  const { currentJourney, closeWork } = useProfessionalJourney();

  const [isSaving, setIsSaving] = useState(false);
  const [concluded, setConcluded] = useState('');
  const [paused, setPaused] = useState('');
  const [needsHourLog, setNeedsHourLog] = useState(false);
  const [loggedHours, setLoggedHours] = useState('');
  const [waitingReturn, setWaitingReturn] = useState('');
  const [improvementIdea, setImprovementIdea] = useState('');
  const [correctedEndAt, setCorrectedEndAt] = useState('');

  useEffect(() => {
    if (!open) return;
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    setCorrectedEndAt(now.toISOString().slice(0, 16));
  }, [open]);

  const inProgressTasks = useMemo(() => {
    return tasks.filter((task) => normalizeTaskStatus(task.status) === TASK_STATUS.EM_ANDAMENTO);
  }, [tasks]);

  const resetForm = () => {
    setConcluded('');
    setPaused('');
    setNeedsHourLog(false);
    setLoggedHours('');
    setWaitingReturn('');
    setImprovementIdea('');
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      for (const task of inProgressTasks) {
        await pauseTask(task.id, {
          note: paused || 'Pausada no fechamento do dia.'
        });
      }

      let hoursValue = Number(loggedHours || 0);
      if (!Number.isFinite(hoursValue) || hoursValue < 0) {
        hoursValue = 0;
      }

      if (needsHourLog && hoursValue > 0) {
        addManualWorkSession({
          projectId: 'Pessoal',
          title: 'Fechamento do dia',
          durationMinutes: Math.round(hoursValue * 60),
          notes: concluded || 'Horas registradas no encerramento do dia.'
        });
      }

      if (String(waitingReturn || '').trim()) {
        await addTask({
          title: `Aguardando retorno: ${String(waitingReturn).trim()}`,
          project: 'Pessoal',
          taskType: 'Atendimento',
          status: TASK_STATUS.AGUARDANDO_RETORNO,
          importance: 'Média',
          urgency: 'Baixa',
          description: 'Registrado durante o encerramento do dia.',
          scheduledDate: todayIso(),
          dataSugeridaExecucao: todayIso(),
          timeEstimate: 15,
          energiaNecessaria: 'Baixa'
        });
      }

      if (String(improvementIdea || '').trim()) {
        await saveImprovementForLater({
          addTask,
          title: String(improvementIdea).trim(),
          relatedScreen: 'Fechamento do dia',
          description: 'Ideia registrada no encerramento do dia.',
          priority: 'baixa',
          reviewWhen: 'algum_dia',
          includeInToday: false
        });
      }

      if (currentJourney?.id) {
        await closeWork(
          paused || concluded,
          isForgottenJourney(currentJourney) && correctedEndAt ? new Date(correctedEndAt).toISOString() : undefined
        );
      }

      saveDailyWrapUp(currentUser?.id, {
        date: todayIso(),
        concluded,
        paused,
        waitingReturn,
        needsHourLog,
        loggedHours: needsHourLog ? Number(loggedHours || 0) : 0,
        improvementIdea
      });

      toast.success('Dia encerrado. Resumo salvo com sucesso.');
      resetForm();
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível encerrar o dia agora.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Encerrar dia</DialogTitle>
          <DialogDescription>
            Feche o dia com um resumo executivo para manter continuidade amanhã.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!currentJourney && <div className="space-y-2">
            <Label htmlFor="wrapup-concluded">O que foi concluído hoje?</Label>
            <Textarea id="wrapup-concluded" value={concluded} onChange={(event) => setConcluded(event.target.value)} placeholder="Principais entregas e avanços do dia." rows={3} />
          </div>}

          <div className="space-y-2">
            <Label htmlFor="wrapup-paused">O que ficou pausado?</Label>
            <Textarea id="wrapup-paused" value={paused} onChange={(event) => setPaused(event.target.value)} placeholder="Registre onde você parou para retomar com clareza." rows={3} />
          </div>

          {currentJourney && isForgottenJourney(currentJourney) && (
            <div className="space-y-2 rounded-md border border-amber-300/60 bg-amber-50 p-3">
              <Label htmlFor="journey-real-end">Horário real de encerramento</Label>
              <Input id="journey-real-end" type="datetime-local" value={correctedEndAt} onChange={(event) => setCorrectedEndAt(event.target.value)} />
              <p className="text-sm text-amber-800">A jornada está aberta há mais tempo que o habitual. Confirme quando o trabalho realmente terminou.</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="wrapup-hours">Precisa registrar horas?</Label>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <Button type="button" variant={needsHourLog ? 'default' : 'outline'} onClick={() => setNeedsHourLog((prev) => !prev)}>
                {needsHourLog ? 'Registro ativo' : 'Ativar registro'}
              </Button>
              <Input
                id="wrapup-hours"
                type="number"
                min="0"
                step="0.5"
                value={loggedHours}
                onChange={(event) => setLoggedHours(event.target.value)}
                placeholder="Ex.: 2.5"
                disabled={!needsHourLog}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="wrapup-waiting">Alguma tarefa virou aguardando retorno?</Label>
            <Input
              id="wrapup-waiting"
              value={waitingReturn}
              onChange={(event) => setWaitingReturn(event.target.value)}
              placeholder="Ex.: Confirmação de proposta com cliente X"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="wrapup-improvement">Alguma melhoria do Clareia deve ser guardada para depois?</Label>
            <Input
              id="wrapup-improvement"
              value={improvementIdea}
              onChange={(event) => setImprovementIdea(event.target.value)}
              placeholder="Ex.: Simplificar card de projeto"
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancelar</Button>
          <Button type="button" onClick={handleSave} disabled={isSaving}>{isSaving ? 'Salvando...' : 'Salvar e encerrar dia'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
