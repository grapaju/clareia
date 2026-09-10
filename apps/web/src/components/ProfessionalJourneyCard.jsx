import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, Pause, Play, RotateCcw, Square } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useProfessionalJourney } from '@/contexts/ProfessionalJourneyContext.jsx';
import { calculateWeeklyProgress, getDailyTargetMinutes, getJourneyDisplayState, getValidJourneyMetrics } from '@/lib/professionalJourneyLogic.js';
import { formatDurationFriendly } from '@/lib/reportFormatting.js';
import { getProgressState } from '@/lib/todayViewLogic.js';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import DailyWrapUpDialog from '@/components/DailyWrapUpDialog.jsx';
import { getLatestDailyWrapUpForResume, updateDailyWrapUpResumeState } from '@/services/dailyWrapUpService.js';

export default function ProfessionalJourneyCard({ compact = false, periodAvailableMinutes = 0 }) {
  const { currentUser } = useAuth();
  const {
    currentJourney, journeyPauses, professionalProjects, professionalHistory,
    isLoading, startWork, pauseWork, resumeWork,
  } = useProfessionalJourney();
  const [now, setNow] = useState(new Date());
  const [selectedProject, setSelectedProject] = useState('');
  const [isClosing, setIsClosing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [, setResumeContextVersion] = useState(0);

  useEffect(() => {
    if (!selectedProject && professionalProjects[0]) setSelectedProject(professionalProjects[0].name);
  }, [professionalProjects, selectedProject]);

  useEffect(() => {
    if (!currentJourney) return undefined;
    const interval = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(interval);
  }, [currentJourney]);

  if (isLoading || (!currentJourney && professionalProjects.length === 0)) return null;

  const selectedProjectName = selectedProject || professionalProjects[0]?.name || '';
  const resumeProjectName = currentJourney?.projectName || selectedProjectName;
  const resumeContext = getLatestDailyWrapUpForResume(currentUser?.id, now, resumeProjectName);
  const initialProfile = professionalProjects.find((item) => item.name === (currentJourney?.projectName || selectedProjectName));
  const displayState = getJourneyDisplayState({
    currentJourney,
    journeys: professionalHistory.journeys,
    now,
    timeZone: currentJourney?.timezone || initialProfile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  const displayJourney = displayState.journey;
  const activeProfile = professionalProjects.find((item) => item.name === (displayJourney?.projectName || selectedProjectName));
  const timeZone = activeProfile?.timezone || currentJourney?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const displayPauses = currentJourney
    ? journeyPauses
    : (professionalHistory.pauses || []).filter((pause) => pause.journeyId === displayJourney?.id);
  const metrics = displayJourney
    ? getValidJourneyMetrics({ journey: displayJourney, pauses: displayPauses, now, timeZone })
    : null;
  const workdayDuration = metrics?.validMinutes || 0;
  const dailyTargetMinutes = activeProfile ? getDailyTargetMinutes(activeProfile) : 0;
  const weeklyJourneys = activeProfile ? [
    ...professionalHistory.journeys.filter((item) => item.projectName === activeProfile.name && item.id !== currentJourney?.id),
    ...(currentJourney ? [currentJourney] : []),
  ] : [];
  const weeklyPauses = activeProfile ? [
    ...(professionalHistory.pauses || []).filter((pause) => pause.journeyId !== currentJourney?.id),
    ...(currentJourney ? journeyPauses : []),
  ] : [];
  const weekly = activeProfile ? calculateWeeklyProgress({
    journeys: weeklyJourneys,
    pauses: weeklyPauses,
    weeklyTargetMinutes: activeProfile.weeklyTargetMinutes,
    now,
    timeZone,
  }) : null;
  const dailyProgress = displayJourney ? getProgressState(workdayDuration, dailyTargetMinutes) : null;
  const weeklyProgress = weekly ? getProgressState(weekly.totalMinutes, weekly.targetMinutes) : null;

  const run = async (action, successMessage) => {
    setIsSaving(true);
    try {
      await action();
      if (successMessage) toast.success(successMessage);
    } catch (error) {
      console.error(error);
      toast.error('Não consegui atualizar a jornada. O registro continua como estava; tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResumeContext = (resumeState) => {
    if (!resumeContext?.id) return;
    updateDailyWrapUpResumeState(currentUser?.id, resumeContext.id, resumeState, now);
    setResumeContextVersion((version) => version + 1);
    if (resumeState === 'resumed') toast.success('Contexto retomado nesta jornada.');
  };

  return (
    <>
      <section
        className={`${compact ? 'mb-4' : 'mb-6'} journey-state-strip journey-state-${displayState.kind} journey-grow-fade overflow-hidden rounded-lg border border-border bg-card transition-[min-height,padding,border-color,background-color,box-shadow] duration-700 ease-in-out`}
        aria-labelledby="journey-title"
        data-state={displayState.kind}
      >
        {displayState.kind === 'active' && (
          <div className="p-3 sm:p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <JourneyIdentity projectName={displayJourney.projectName} status="Jornada em andamento" />
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" className="press-feedback" disabled={isSaving} onClick={() => run(pauseWork)}><Pause className="mr-1.5 h-4 w-4" />Pausar</Button>
                <Button variant="ghost" className="press-feedback" disabled={isSaving} onClick={() => setIsClosing(true)}><Square className="mr-1.5 h-4 w-4" />Encerrar dia</Button>
              </div>
            </div>
            <div className="mt-3">
              {metrics.isAnomalous ? (
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Tempo pendente de confirmação</p>
              ) : dailyProgress.hasTarget ? (
                <TimeProgress
                  label={`${formatDurationFriendly(dailyProgress.valueMinutes)} de ${formatDurationFriendly(dailyProgress.targetMinutes)}`}
                  progress={dailyProgress}
                  remainingLabel={dailyProgress.remainingMinutes > 0 ? `Faltam ${formatDurationFriendly(dailyProgress.remainingMinutes)}` : 'Referência do dia alcançada'}
                />
              ) : <p className="text-sm font-medium text-foreground">{formatDurationFriendly(workdayDuration)} trabalhadas hoje</p>}
            </div>
            <JourneyDetails anomalous={metrics.isAnomalous} periodAvailableMinutes={periodAvailableMinutes} weekly={weekly} weeklyProgress={weeklyProgress} />
          </div>
        )}

        {displayState.kind === 'paused' && (
          <div className="p-3 sm:px-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <JourneyIdentity projectName={displayJourney.projectName} status="Jornada pausada" minutes={metrics.isAnomalous ? null : workdayDuration} pending={metrics.isAnomalous} />
              <Button className="press-feedback min-h-11 sm:min-h-9" disabled={isSaving} onClick={() => run(resumeWork)}><RotateCcw className="mr-1.5 h-4 w-4" />Retomar</Button>
            </div>
            <JourneyDetails anomalous={metrics.isAnomalous} periodAvailableMinutes={periodAvailableMinutes} weekly={weekly} weeklyProgress={weeklyProgress}>
              <Button className="mt-3" size="sm" variant="ghost" disabled={isSaving} onClick={() => setIsClosing(true)}><Square className="mr-1.5 h-4 w-4" />Encerrar dia</Button>
            </JourneyDetails>
          </div>
        )}

        {displayState.kind === 'not_started' && (
          <div className="p-3 sm:px-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <JourneyIdentity projectName={selectedProjectName} status="Ainda não iniciada" />
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                {professionalProjects.length > 1 && (
                  <Select value={selectedProjectName} onValueChange={setSelectedProject}>
                    <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
                    <SelectContent>{professionalProjects.map((item) => <SelectItem key={item.name} value={item.name}>{item.name}</SelectItem>)}</SelectContent>
                  </Select>
                )}
                <Button className="press-feedback min-h-11 sm:min-h-9" disabled={!selectedProjectName || isSaving} onClick={() => run(() => startWork(selectedProjectName))}><Play className="mr-1.5 h-4 w-4" />Iniciar jornada</Button>
              </div>
            </div>
            <JourneyDetails weekly={weekly} weeklyProgress={weeklyProgress} />
          </div>
        )}

        {displayState.kind === 'closed' && (
          <div className="p-3 sm:px-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                <JourneyIdentity projectName={displayJourney.projectName} status="Jornada encerrada" minutes={metrics.isAnomalous ? null : workdayDuration} pending={metrics.isAnomalous} />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                {professionalProjects.length > 1 && (
                  <Select value={selectedProjectName} onValueChange={setSelectedProject}>
                    <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
                    <SelectContent>{professionalProjects.map((item) => <SelectItem key={item.name} value={item.name}>{item.name}</SelectItem>)}</SelectContent>
                  </Select>
                )}
                <Button className="min-h-11 sm:min-h-9" disabled={!selectedProjectName || isSaving} onClick={() => run(() => startWork(selectedProjectName))}><Play className="mr-1.5 h-4 w-4" />Iniciar nova jornada</Button>
              </div>
            </div>
            <JourneyDetails anomalous={metrics.isAnomalous} weekly={weekly} weeklyProgress={weeklyProgress} />
          </div>
        )}
      </section>

      {resumeContext && (
        <section className={`${compact ? 'mb-4' : 'mb-6'} border-y border-border py-3`} aria-labelledby="journey-resume-title">
          <p id="journey-resume-title" className="text-xs font-semibold uppercase tracking-wide text-primary">Você deixou isso para continuar</p>
          <p className="mt-1 whitespace-pre-line text-sm text-foreground">{resumeContext.continueContext || resumeContext.paused}</p>
          {(resumeContext.waitingExternal || resumeContext.waitingReturn) && (
            <div className="mt-2 text-sm">
              <span className="font-medium text-foreground">Aguardando retorno externo: </span>
              <span className="whitespace-pre-line text-muted-foreground">{resumeContext.waitingExternal || resumeContext.waitingReturn}</span>
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => handleResumeContext('resumed')}>Retomar</Button>
            <Button size="sm" variant="outline" onClick={() => handleResumeContext('resolved')}>Já resolvi</Button>
            <Button size="sm" variant="ghost" onClick={() => handleResumeContext('deferred')}>Deixar para depois</Button>
          </div>
        </section>
      )}

      <DailyWrapUpDialog open={isClosing} onOpenChange={setIsClosing} />
    </>
  );
}

function JourneyIdentity({ projectName, status, minutes = null, pending = false }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">Jornada de hoje</p>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <h2 id="journey-title" className="truncate text-base font-medium text-foreground">{projectName || 'Jornada profissional'}</h2>
        <span className="text-sm text-muted-foreground">{status}</span>
        {minutes !== null && <span className="text-sm font-medium text-foreground">{formatDurationFriendly(minutes)} trabalhadas</span>}
        {pending && <span className="text-sm font-medium text-amber-800 dark:text-amber-200">Tempo pendente de confirmação</span>}
      </div>
    </div>
  );
}

function JourneyDetails({ anomalous = false, periodAvailableMinutes = 0, weekly = null, weeklyProgress = null, children = null }) {
  const hasDetails = periodAvailableMinutes > 0 || anomalous || weeklyProgress?.hasTarget || children;
  if (!hasDetails) return null;

  return (
    <details className="group mt-2 border-t border-border/70 pt-2">
      <summary className="inline-flex min-h-8 cursor-pointer list-none items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        Ver detalhes <ChevronDown className="h-4 w-4 transition-transform duration-300 group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="journey-details-content mt-2 max-w-3xl pb-1">
        {periodAvailableMinutes > 0 && <p className="text-xs text-muted-foreground">Tempo disponível agora: {formatDurationFriendly(periodAvailableMinutes)}</p>}
        {anomalous && <p className="mt-2 flex gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />Essa jornada ficou aberta por mais tempo que o habitual. Confirme quando o trabalho terminou.</p>}
        {weeklyProgress?.hasTarget && (
          <div className="mt-3">
            <TimeProgress
              label={`${formatDurationFriendly(weeklyProgress.valueMinutes)} de ${formatDurationFriendly(weeklyProgress.targetMinutes)} na semana`}
              progress={weeklyProgress}
              remainingLabel={weekly.remainingMinutes > 0
                ? `Faltam ${formatDurationFriendly(weekly.remainingMinutes)}`
                : weekly.aboveTargetMinutes > 0
                  ? `${formatDurationFriendly(weekly.aboveTargetMinutes)} acima da referência`
                  : 'Meta semanal alcançada'}
            />
          </div>
        )}
        {children}
        <Button asChild className="mt-3 px-0" size="sm" variant="link"><Link to="/relatorios">Ver histórico</Link></Button>
      </div>
    </details>
  );
}

function TimeProgress({ label, progress, remainingLabel }) {
  const [displayPercent, setDisplayPercent] = useState(0);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setDisplayPercent(progress.percent));
    return () => window.cancelAnimationFrame(frame);
  }, [progress.percent]);

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="font-medium text-foreground">{label}</span>
        <span className="text-xs text-muted-foreground">{remainingLabel}</span>
      </div>
      <div
        className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label={label}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow={progress.percent}
        aria-valuetext={`${progress.percent}% — ${remainingLabel}`}
      >
        <div className="journey-progress-fill h-full rounded-full bg-primary transition-[width] duration-700 ease-out" style={{ width: `${displayPercent}%` }} />
      </div>
    </div>
  );
}