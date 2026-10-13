import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
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
  normalizeWrapUpActivities,
  resolveProfessionalJourneyEndAt
} from '@/lib/professionalJourneyWrapUpLogic.js';
import { listDailyWrapUps, replaceDailyWrapUps, saveDailyWrapUp } from '@/services/dailyWrapUpService.js';
import { useProfessionalJourney } from '@/contexts/ProfessionalJourneyContext.jsx';
import { getZonedDateKey, isAnomalousJourney } from '@/lib/professionalJourneyLogic.js';
import { getJourneyReview, saveJourneyReview } from '@/services/journeyReviewService.js';
import { listJourneyQuickNotes } from '@/services/journeyQuickNoteService.js';
import { useTaskContext } from '@/hooks/useTaskContext.js';
import { listWorkSessions } from '@/services/workSessionService.js';
import { listAllTaskHistory } from '@/services/taskHistoryService.js';

function todayIso() {
  return localDateTimeValue().slice(0, 10);
}

function localDateTimeValue(date = new Date()) {
  const local = new Date(date);
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
  return local.toISOString().slice(0, 16);
}

function emptyActivity() {
  return {
    id: `wrapup-activity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    description: '',
    projectOrFront: '',
    taskReference: '',
    status: 'concluida',
    nextStep: '',
    waitingOn: '',
    durationMinutes: '',
    deliveryLink: '',
  };
}

function dedupeActivities(items = []) {
  const map = new Map();
  items.forEach((item) => {
    const key = `${String(item.description || '').trim().toLocaleLowerCase('pt-BR')}|${String(item.taskReference || '').trim().toLocaleLowerCase('pt-BR')}|${String(item.projectOrFront || '').trim().toLocaleLowerCase('pt-BR')}`;
    if (!key || key === '||') return;
    if (!map.has(key)) map.set(key, item);
  });
  return [...map.values()];
}

export default function DailyWrapUpDialog({ open, onOpenChange, journeyForReview = null }) {
  const { currentUser } = useAuth();
  const { tasks } = useTaskContext();
  const { currentJourney, closeWork } = useProfessionalJourney();

  const [isSaving, setIsSaving] = useState(false);
  const [concluded, setConcluded] = useState('');
  const [continueContext, setContinueContext] = useState('');
  const [waitingExternal, setWaitingExternal] = useState('');
  const [activities, setActivities] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [isCorrectingEndAt, setIsCorrectingEndAt] = useState(false);
  const [correctedEndAt, setCorrectedEndAt] = useState('');

  const effectiveJourney = useMemo(() => (
    journeyForReview || currentJourney || null
  ), [journeyForReview, currentJourney]);
  const effectiveDate = useMemo(() => {
    if (journeyForReview?.date) return journeyForReview.date;
    if (effectiveJourney?.startedAt) return getZonedDateKey(effectiveJourney.startedAt, effectiveJourney?.timezone || 'America/Sao_Paulo');
    return todayIso();
  }, [effectiveJourney, journeyForReview?.date]);
  const anomalous = Boolean(currentJourney && isAnomalousJourney(currentJourney));
  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);

  useEffect(() => {
    if (!open) return;
    setConcluded('');
    setContinueContext('');
    setWaitingExternal('');
    setActivities([]);
    setSuggestions([]);
    setIsCorrectingEndAt(false);
    setCorrectedEndAt(localDateTimeValue());

    if (!effectiveJourney?.id) return;
    setIsLoadingSuggestions(true);
    Promise.all([
      getJourneyReview(effectiveJourney.id),
      listJourneyQuickNotes({
        journeyId: effectiveJourney.id,
        projectName: effectiveJourney.projectName || '',
        date: effectiveDate,
      }),
    ])
      .then(([review, quickNotes]) => {
        if (review) {
          setConcluded(review.concluded || '');
          setContinueContext(review.continueContext || '');
          setWaitingExternal(review.waitingExternal || '');
          setActivities(normalizeWrapUpActivities(review.activities || []));
        }

        const sessionSuggestions = listWorkSessions()
          .filter((session) => (
            String(session.projectId || '').trim().toLocaleLowerCase('pt-BR') === String(effectiveJourney.projectName || '').trim().toLocaleLowerCase('pt-BR')
            && getZonedDateKey(session.startedAt, 'America/Sao_Paulo') === effectiveDate
          ))
          .map((session) => {
            const task = session.taskId ? taskById.get(session.taskId) : null;
            return {
              id: `session-${session.id}`,
              description: task?.title || session.title || 'Sessão de trabalho',
              projectOrFront: session.projectId || effectiveJourney.projectName || '',
              taskReference: task?.id || session.taskId || '',
              status: 'concluida',
              nextStep: '',
              waitingOn: '',
              durationMinutes: Number(session.durationMinutes || 0) || null,
              deliveryLink: '',
            };
          });

        const completionSuggestions = listAllTaskHistory()
          .filter((event) => (
            event.type === 'task_completed'
            && String(event.projectId || '').trim().toLocaleLowerCase('pt-BR') === String(effectiveJourney.projectName || '').trim().toLocaleLowerCase('pt-BR')
            && getZonedDateKey(event.createdAt, 'America/Sao_Paulo') === effectiveDate
          ))
          .map((event) => {
            const task = taskById.get(event.taskId);
            return {
              id: `done-${event.id || event.taskId}`,
              description: task?.title || event.message || 'Tarefa concluída',
              projectOrFront: event.projectId || effectiveJourney.projectName || '',
              taskReference: event.taskId || '',
              status: 'concluida',
              nextStep: '',
              waitingOn: '',
              durationMinutes: null,
              deliveryLink: '',
            };
          });

        const noteSuggestions = quickNotes.map((note) => ({
          id: `note-${note.id}`,
          description: note.description,
          projectOrFront: note.projectOrFront || note.journeyProjectName || effectiveJourney.projectName || '',
          taskReference: note.taskReference,
          status: note.status || 'em_andamento',
          nextStep: note.nextStep || '',
          waitingOn: note.waitingOn || '',
          durationMinutes: null,
          deliveryLink: note.deliveryLink || '',
        }));

        setSuggestions(dedupeActivities([...noteSuggestions, ...sessionSuggestions, ...completionSuggestions]));
      })
      .catch((error) => {
        console.error(error);
        toast.error('Não consegui carregar as sugestões do dia. Você ainda pode revisar manualmente.');
      })
      .finally(() => setIsLoadingSuggestions(false));
  }, [effectiveDate, effectiveJourney?.id, effectiveJourney?.projectName, open, taskById]);

  const handleSave = async () => {
    if (!effectiveJourney?.id) {
      toast.error('Não há jornada para revisar.');
      return;
    }

    const previousWrapUps = listDailyWrapUps(currentUser?.id);
    let contextSaved = false;
    setIsSaving(true);

    try {
      const normalizedActivities = normalizeWrapUpActivities(activities);
      const context = buildProfessionalJourneyWrapUp({ concluded, continueContext, waitingExternal, activities: normalizedActivities });
      const closingNote = buildProfessionalJourneyClosingNote(context);
      const endedAt = journeyForReview?.endedAt || resolveProfessionalJourneyEndAt({
        anomalous,
        correctionEnabled: isCorrectingEndAt,
        correctedEndAt,
        now: new Date()
      });

      saveDailyWrapUp(currentUser?.id, {
        date: effectiveDate,
        concluded: context.concluded,
        continueContext: context.continueContext,
        waitingExternal: context.waitingExternal,
        activities: normalizedActivities,
        endedAt,
        journeyId: effectiveJourney.id,
        journeyProjectName: effectiveJourney.projectName || journeyForReview?.projectName || ''
      });
      contextSaved = true;

      await saveJourneyReview({
        journeyId: effectiveJourney.id,
        date: effectiveDate,
        journeyProjectName: effectiveJourney.projectName || journeyForReview?.projectName || '',
        endedAt,
        concluded: context.concluded,
        continueContext: context.continueContext,
        waitingExternal: context.waitingExternal,
        activities: normalizedActivities,
        status: 'finalized',
      });

      if (!journeyForReview && currentJourney?.id) {
        await closeWork(closingNote, endedAt);
      }

      toast.success('Revisão do dia salva.');
      onOpenChange(false);
    } catch (error) {
      if (contextSaved) replaceDailyWrapUps(currentUser?.id, previousWrapUps);
      console.error(error);
      toast.error('Não consegui salvar a revisão. As informações continuam no formulário para nova tentativa.');
    } finally {
      setIsSaving(false);
    }
  };

  const addSuggestion = (item) => {
    setActivities((current) => dedupeActivities([...current, { ...item, id: `activity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` }]));
  };

  const updateActivity = (id, updates) => {
    setActivities((current) => current.map((item) => (item.id === id ? { ...item, ...updates } : item)));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Revisar atividades do dia</DialogTitle>
          <DialogDescription>
            Confirme o relato da jornada sem alterar o horário encerrado.
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="wrapup-continue">O que ficou para continuar?</Label>
            <Textarea id="wrapup-continue" value={continueContext} onChange={(event) => setContinueContext(event.target.value)} placeholder="Ex.: continuar revisão do módulo de contratos." rows={3} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="wrapup-waiting">Ficou algo aguardando retorno externo?</Label>
            <Textarea id="wrapup-waiting" value={waitingExternal} onChange={(event) => setWaitingExternal(event.target.value)} placeholder="Ex.: aguardando documento do setor financeiro." rows={3} />
          </div>

          <div className="space-y-3 rounded-md border border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <Label>Atividades confirmadas</Label>
                <p className="text-xs text-muted-foreground">Revise, corrija e confirme apenas o que foi realizado no contexto da jornada.</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setActivities((current) => [...current, emptyActivity()])}>
                <Plus className="mr-1 h-4 w-4" /> Adicionar
              </Button>
            </div>

            {activities.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma atividade confirmada ainda.</p>
            ) : (
              <div className="space-y-4">
                {activities.map((item) => (
                  <div key={item.id} className="space-y-2 rounded-md border border-border bg-background p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Atividade</p>
                      <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => setActivities((current) => current.filter((activity) => activity.id !== item.id))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <Input value={item.description} onChange={(event) => updateActivity(item.id, { description: event.target.value })} placeholder="O que foi realizado" />
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <Input value={item.projectOrFront} onChange={(event) => updateActivity(item.id, { projectOrFront: event.target.value })} placeholder="Projeto ou frente" />
                      <Input value={item.taskReference} onChange={(event) => updateActivity(item.id, { taskReference: event.target.value })} placeholder="Vínculo com tarefa (opcional)" />
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={item.status} onChange={(event) => updateActivity(item.id, { status: event.target.value })}>
                        <option value="concluida">Concluída</option>
                        <option value="em_andamento">Em andamento</option>
                        <option value="aguardando_retorno">Aguardando retorno</option>
                        <option value="pausada">Pausada</option>
                      </select>
                      <Input type="number" min={1} value={item.durationMinutes || ''} onChange={(event) => updateActivity(item.id, { durationMinutes: event.target.value })} placeholder="Duração (min) opcional" />
                      <Input value={item.deliveryLink} onChange={(event) => updateActivity(item.id, { deliveryLink: event.target.value })} placeholder="Link de entrega (opcional)" />
                    </div>
                    <Input value={item.nextStep} onChange={(event) => updateActivity(item.id, { nextStep: event.target.value })} placeholder="Próximo passo ou pendência" />
                    <Input value={item.waitingOn} onChange={(event) => updateActivity(item.id, { waitingOn: event.target.value })} placeholder="De quem depende, quando houver" />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3 rounded-md border border-border p-3">
            <Label>Sugestões do dia (não confirmadas automaticamente)</Label>
            {isLoadingSuggestions ? (
              <p className="text-xs text-muted-foreground">Carregando sugestões...</p>
            ) : suggestions.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sem sugestões para este dia.</p>
            ) : (
              <div className="space-y-2">
                {suggestions.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-md border border-border/70 px-3 py-2">
                    <div>
                      <p className="text-sm text-foreground">{item.description}</p>
                      <p className="text-xs text-muted-foreground">{item.projectOrFront || 'Sem projeto'} · {item.status.replaceAll('_', ' ')}</p>
                    </div>
                    <Button type="button" size="sm" variant="outline" onClick={() => addSuggestion(item)}>Adicionar</Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {anomalous && !journeyForReview && (
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
          <Button type="button" onClick={handleSave} disabled={isSaving || !effectiveJourney?.id || (anomalous && isCorrectingEndAt && !correctedEndAt)}>
            {isSaving ? 'Salvando revisão...' : 'Salvar revisão do dia'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
