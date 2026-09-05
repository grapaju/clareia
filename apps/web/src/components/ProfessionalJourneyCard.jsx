import React, { useEffect, useState } from 'react';
import { BriefcaseBusiness, Pause, Play, RotateCcw, Square, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { useProfessionalJourney } from '@/contexts/ProfessionalJourneyContext.jsx';
import { calculateJourneyMetrics, calculateWeeklySummaryProgress, isForgottenJourney, PROFESSIONAL_CATEGORIES } from '@/lib/professionalJourneyLogic.js';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import DailyWrapUpDialog from '@/components/DailyWrapUpDialog.jsx';

function durationLabel(minutes) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours}h${rest ? String(rest).padStart(2, '0') : ''}` : `${rest} min`;
}

export default function ProfessionalJourneyCard({ compact = false }) {
  const {
    currentJourney, journeyPauses, journeyActivities, professionalProjects, professionalHistory,
    isLoading, startWork, pauseWork, resumeWork, startActivity,
  } = useProfessionalJourney();
  const [now, setNow] = useState(new Date());
  const [selectedProject, setSelectedProject] = useState('');
  const [isClosing, setIsClosing] = useState(false);
  const [isQuickActivityOpen, setIsQuickActivityOpen] = useState(false);
  const [quickTitle, setQuickTitle] = useState('');
  const [quickCategory, setQuickCategory] = useState('Outro');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!selectedProject && professionalProjects[0]) setSelectedProject(professionalProjects[0].name);
  }, [professionalProjects, selectedProject]);

  useEffect(() => {
    if (!currentJourney) return undefined;
    const interval = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(interval);
  }, [currentJourney]);

  if (isLoading || (!currentJourney && professionalProjects.length === 0)) return null;

  const metrics = currentJourney
    ? calculateJourneyMetrics({ journey: currentJourney, pauses: journeyPauses, activities: journeyActivities, now })
    : null;
  const forgotten = isForgottenJourney(currentJourney, now);
  const activeProfile = professionalProjects.find((item) => item.name === (currentJourney?.projectName || selectedProject));
  const weekly = activeProfile ? calculateWeeklySummaryProgress({
    journeys: professionalHistory.journeys.filter((item) => item.projectName === activeProfile.name),
    weeklyTargetMinutes: activeProfile.weeklyTargetMinutes,
    now,
    timeZone: activeProfile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
  }) : null;

  const run = async (action, successMessage) => {
    setIsSaving(true);
    try {
      await action();
      if (successMessage) toast.success(successMessage);
    } catch (error) {
      toast.error(error?.message || 'Não foi possível atualizar a jornada.');
    } finally {
      setIsSaving(false);
    }
  };

  const saveQuickActivity = () => run(async () => {
    await startActivity({ title: quickTitle, category: quickCategory, source: 'quick' });
    setQuickTitle('');
    setQuickCategory('Outro');
    setIsQuickActivityOpen(false);
  }, 'Atividade registrada.');

  return (
    <section className={`${compact ? 'mb-4' : 'mb-6'} border-y border-border py-4`} aria-label="Jornada profissional">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
            <BriefcaseBusiness className="h-4 w-4 text-sky-500" aria-hidden="true" />
            {currentJourney ? currentJourney.projectName : 'Jornada profissional'}
          </p>
          {currentJourney ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {currentJourney.status === 'paused' ? 'Pausada' : 'Em andamento'} · {durationLabel(metrics.netMinutes)} trabalhadas
              {metrics.unclassifiedMinutes > 0 && ` · ${durationLabel(metrics.unclassifiedMinutes)} sem atividade`}
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">Inicie quando começar seu período de trabalho.</p>
          )}
          {forgotten && <p className="mt-1 text-sm text-amber-700">Esta jornada está aberta há mais tempo que o habitual. Revise antes de encerrar.</p>}
          {weekly && (
            <p className="mt-1 text-sm text-muted-foreground">
              Semana: {durationLabel(weekly.totalMinutes)} de {durationLabel(weekly.targetMinutes)}
              {weekly.remainingMinutes > 0 && ` · faltam ${durationLabel(weekly.remainingMinutes)}`}
              {weekly.aboveTargetMinutes > 0 && ` · ${durationLabel(weekly.aboveTargetMinutes)} acima da referência`}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!currentJourney && professionalProjects.length > 1 && (
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>{professionalProjects.map((item) => <SelectItem key={item.name} value={item.name}>{item.name}</SelectItem>)}</SelectContent>
            </Select>
          )}
          {!currentJourney && <Button disabled={!selectedProject || isSaving} onClick={() => run(() => startWork(selectedProject))}><Play className="mr-1.5 h-4 w-4" />Iniciar trabalho</Button>}
          {currentJourney?.status === 'active' && <Button variant="outline" disabled={isSaving} onClick={() => run(pauseWork)}><Pause className="mr-1.5 h-4 w-4" />Pausar</Button>}
          {currentJourney?.status === 'paused' && <Button disabled={isSaving} onClick={() => run(resumeWork)}><RotateCcw className="mr-1.5 h-4 w-4" />Retomar</Button>}
          {currentJourney?.status === 'active' && <Button size="icon" variant="ghost" title="Atividade rápida" aria-label="Registrar atividade rápida" onClick={() => setIsQuickActivityOpen(true)}><Zap className="h-4 w-4" /></Button>}
          {currentJourney && <Button variant="ghost" disabled={isSaving} onClick={() => setIsClosing(true)}><Square className="mr-1.5 h-4 w-4" />Encerrar dia</Button>}
        </div>
      </div>

      <Dialog open={isQuickActivityOpen} onOpenChange={setIsQuickActivityOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Atividade rápida</DialogTitle><DialogDescription>Troca o que está sendo registrado sem pausar sua jornada.</DialogDescription></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label htmlFor="quick-activity">O que você vai fazer?</Label><Input id="quick-activity" value={quickTitle} onChange={(event) => setQuickTitle(event.target.value)} autoFocus /></div>
            <div className="space-y-2"><Label>Categoria</Label><Select value={quickCategory} onValueChange={setQuickCategory}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PROFESSIONAL_CATEGORIES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setIsQuickActivityOpen(false)}>Cancelar</Button><Button disabled={!quickTitle.trim() || isSaving} onClick={saveQuickActivity}>Registrar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <DailyWrapUpDialog open={isClosing} onOpenChange={setIsClosing} />
    </section>
  );
}