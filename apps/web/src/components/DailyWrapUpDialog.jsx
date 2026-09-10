import React, { useEffect, useState } from 'react';
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
import { useAuth } from '@/contexts/AuthContext.jsx';
import {
  buildProfessionalJourneyClosingNote,
  buildProfessionalJourneyWrapUp,
  resolveProfessionalJourneyEndAt
} from '@/lib/professionalJourneyWrapUpLogic.js';
import { listDailyWrapUps, replaceDailyWrapUps, saveDailyWrapUp } from '@/services/dailyWrapUpService.js';
import { useProfessionalJourney } from '@/contexts/ProfessionalJourneyContext.jsx';
import { isAnomalousJourney } from '@/lib/professionalJourneyLogic.js';

function todayIso() {
  return localDateTimeValue().slice(0, 10);
}

function localDateTimeValue(date = new Date()) {
  const local = new Date(date);
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
  return local.toISOString().slice(0, 16);
}

export default function DailyWrapUpDialog({ open, onOpenChange }) {
  const { currentUser } = useAuth();
  const { currentJourney, closeWork } = useProfessionalJourney();

  const [isSaving, setIsSaving] = useState(false);
  const [concluded, setConcluded] = useState('');
  const [continueContext, setContinueContext] = useState('');
  const [waitingExternal, setWaitingExternal] = useState('');
  const [isCorrectingEndAt, setIsCorrectingEndAt] = useState(false);
  const [correctedEndAt, setCorrectedEndAt] = useState('');
  const anomalous = Boolean(currentJourney && isAnomalousJourney(currentJourney));

  useEffect(() => {
    if (!open) return;
    setConcluded('');
    setContinueContext('');
    setWaitingExternal('');
    setIsCorrectingEndAt(false);
    setCorrectedEndAt(localDateTimeValue());
  }, [open]);

  const handleSave = async () => {
    if (!currentJourney?.id) {
      toast.error('Não há uma jornada aberta para encerrar.');
      return;
    }

    const previousWrapUps = listDailyWrapUps(currentUser?.id);
    let contextSaved = false;
    setIsSaving(true);

    try {
      const context = buildProfessionalJourneyWrapUp({ concluded, continueContext, waitingExternal });
      const closingNote = buildProfessionalJourneyClosingNote(context);
      const endedAt = resolveProfessionalJourneyEndAt({
        anomalous,
        correctionEnabled: isCorrectingEndAt,
        correctedEndAt,
        now: new Date()
      });

      saveDailyWrapUp(currentUser?.id, {
        date: todayIso(),
        concluded: context.concluded,
        continueContext: context.continueContext,
        waitingExternal: context.waitingExternal,
        endedAt,
        journeyId: currentJourney.id,
        journeyProjectName: currentJourney.projectName
      });
      contextSaved = true;

      await closeWork(closingNote, endedAt);

      toast.success('Dia encerrado. O contexto ficou guardado para a próxima retomada.');
      onOpenChange(false);
    } catch (error) {
      if (contextSaved) replaceDailyWrapUps(currentUser?.id, previousWrapUps);
      console.error(error);
      toast.error('Não consegui encerrar o dia. Nenhuma alteração foi mantida; suas respostas continuam aqui.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Encerrar dia</DialogTitle>
          <DialogDescription>
            Registre o essencial da sua jornada para retomar depois com clareza.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="wrapup-concluded">O que você concluiu hoje?</Label>
            <Textarea
              id="wrapup-concluded"
              value={concluded}
              onChange={(event) => setConcluded(event.target.value)}
              placeholder={'Ex.:\nAtualização da página de Transparência\nRevisão dos documentos da licitação'}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">Registre as atividades que ficaram concluídas nesta jornada.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="wrapup-continue">O que ficou para continuar?</Label>
            <Textarea id="wrapup-continue" value={continueContext} onChange={(event) => setContinueContext(event.target.value)} placeholder="Ex.: continuar revisão do módulo de contratos." rows={3} />
            <p className="text-xs text-muted-foreground">Anote o que precisa ser retomado na próxima jornada.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="wrapup-waiting">Ficou algo aguardando retorno externo?</Label>
            <Textarea id="wrapup-waiting" value={waitingExternal} onChange={(event) => setWaitingExternal(event.target.value)} placeholder="Ex.: aguardando documento do setor financeiro." rows={3} />
            <p className="text-xs text-muted-foreground">Registre somente o que depende de outra pessoa ou setor para continuar.</p>
          </div>

          {anomalous && (
            <div className="space-y-2 rounded-md border border-amber-300/60 bg-amber-50 p-3 dark:bg-amber-950/30">
              <p className="text-sm text-amber-800 dark:text-amber-200">Essa jornada ficou aberta por mais tempo que o habitual.</p>
              {!isCorrectingEndAt ? (
                <Button type="button" variant="outline" size="sm" onClick={() => setIsCorrectingEndAt(true)}>Corrigir horário de encerramento</Button>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="journey-real-end">Horário corrigido</Label>
                  <Input id="journey-real-end" type="datetime-local" value={correctedEndAt} onChange={(event) => setCorrectedEndAt(event.target.value)} />
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Agora não</Button>
          <Button type="button" onClick={handleSave} disabled={isSaving || !currentJourney?.id || (anomalous && isCorrectingEndAt && !correctedEndAt)}>
            {isSaving ? 'Guardando...' : 'Guardar e encerrar o dia'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
