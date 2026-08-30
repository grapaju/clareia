import React, { useEffect, useState } from 'react';
import { Settings2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useTheme } from '@/contexts/ThemeContext.jsx';
import { loadUserPreferences, readUserPreferences, saveUserPreferences, saveUserPreferencesLocally } from '@/services/userPreferencesService.js';

const GOALS = [
  'Lembrar o que preciso fazer',
  'Conseguir começar tarefas',
  'Reduzir sobrecarga',
  'Organizar trabalho e clientes',
  'Manter uma rotina',
  'Retomar tarefas interrompidas',
  'Controlar prazos e cobranças',
];

const PROFILES = [
  { value: 'tranquilo', title: 'Tranquilo', description: 'Uma coisa por vez, menos informações e menos estímulos.' },
  { value: 'equilibrado', title: 'Equilibrado', description: 'Informações suficientes, densidade média e movimentos discretos.' },
  { value: 'completo', title: 'Visão completa', description: 'Mais indicadores e uma visão detalhada do trabalho.' },
];

export default function PreferencesOnboarding() {
  const { currentUser } = useAuth();
  const { setLowStimulationMode } = useTheme();
  const navigate = useNavigate();
  const userId = currentUser?.id;
  const [preferences, setPreferences] = useState(() => readUserPreferences(userId));
  const [open, setOpen] = useState(false);
  const [showExistingHint, setShowExistingHint] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let mounted = true;
    loadUserPreferences(userId).then((loaded) => {
      if (!mounted) return;
      setPreferences(loaded);
      const requested = localStorage.getItem('clareia_onboarding_requested') === 'true';
      setOpen(requested && !loaded.onboardingCompleted && !loaded.onboardingDismissed);
      setShowExistingHint(!requested && !loaded.onboardingCompleted && !loaded.onboardingDismissed);
    });
    return () => { mounted = false; };
  }, [userId]);

  const update = (updates) => {
    const next = saveUserPreferencesLocally(userId, { ...preferences, ...updates });
    setPreferences(next);
  };

  const changeStep = async (step) => {
    const next = await saveUserPreferences(userId, { ...preferences, onboardingStep: step });
    setPreferences(next);
  };

  const finish = async (updates = {}) => {
    const next = await saveUserPreferences(userId, {
      ...preferences,
      ...updates,
      onboardingCompleted: true,
      onboardingDismissed: false,
      onboardingStep: 5,
    });
    setPreferences(next);
    setLowStimulationMode(next.visualProfile === 'tranquilo');
    localStorage.removeItem('clareia_onboarding_requested');
    setOpen(false);
    setShowExistingHint(false);
  };

  const configureLater = async () => {
    await saveUserPreferences(userId, { ...preferences, onboardingDismissed: true });
    localStorage.removeItem('clareia_onboarding_requested');
    setOpen(false);
    setShowExistingHint(false);
  };

  const toggleGoal = (goal) => {
    const selected = preferences.goals.includes(goal);
    if (!selected && preferences.goals.length >= 2) return;
    update({ goals: selected ? preferences.goals.filter((item) => item !== goal) : [...preferences.goals, goal] });
  };

  if (!open && showExistingHint) {
    return (
      <div className="mb-6 flex flex-col gap-3 rounded-md border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium text-foreground">Configure o Clareia para funcionar do seu jeito.</p>
          <p className="text-sm text-muted-foreground">Leva poucos minutos e pode ser alterado depois.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setOpen(true)}>Configurar</Button>
          <Button size="icon" variant="ghost" onClick={configureLater} aria-label="Dispensar sugestão">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(value) => { if (value) setOpen(true); }}>
      <DialogContent
        showClose={false}
        className="max-h-[95vh] overflow-y-auto sm:max-w-2xl"
        onPointerDownOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Preferências iniciais</DialogTitle>
          <DialogDescription>Etapa {preferences.onboardingStep} de 5. Tudo pode ser alterado depois.</DialogDescription>
          <div className="flex gap-1 pt-2" role="progressbar" aria-label="Progresso da configuração" aria-valuemin={1} aria-valuemax={5} aria-valuenow={preferences.onboardingStep}>
            {[1, 2, 3, 4, 5].map((step) => (
              <span key={step} className={`h-1 flex-1 rounded-full ${step <= preferences.onboardingStep ? 'bg-primary' : 'bg-muted'}`} />
            ))}
          </div>
        </DialogHeader>

        {preferences.onboardingStep === 1 && (
          <section className="space-y-4" aria-labelledby="onboarding-step-title">
            <h2 id="onboarding-step-title" className="text-xl">Como você gostaria que o Clareia ajudasse?</h2>
            <p className="text-sm text-muted-foreground">Escolha até duas opções.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {GOALS.map((goal) => (
                <label key={goal} className="flex min-h-11 items-center gap-3 rounded-md border border-border p-3">
                  <Checkbox checked={preferences.goals.includes(goal)} onCheckedChange={() => toggleGoal(goal)} />
                  <span>{goal}</span>
                </label>
              ))}
            </div>
          </section>
        )}

        {preferences.onboardingStep === 2 && (
          <section className="space-y-5">
            <h2 className="text-xl">Minha rotina</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Tempo normalmente disponível</Label><Select value={preferences.availableTime} onValueChange={(value) => update({ availableTime: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['30min', '1h', '2h', '4h'].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Duração confortável</Label><Select value={String(preferences.comfortableDuration)} onValueChange={(value) => update({ comfortableDuration: Number(value) })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[15, 30, 45, 60].map((value) => <SelectItem key={value} value={String(value)}>{value} min</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Máximo de prioridades</Label><Select value={String(preferences.maxDailyPriorities)} onValueChange={(value) => update({ maxDailyPriorities: Number(value) })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[1, 3, 5].map((value) => <SelectItem key={value} value={String(value)}>{value}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label htmlFor="contingency-margin">Margem para imprevistos (%)</Label><Input id="contingency-margin" type="number" min="0" max="50" value={preferences.contingencyMargin} onChange={(event) => update({ contingencyMargin: Number(event.target.value) })} /></div>
            </div>
          </section>
        )}

        {preferences.onboardingStep === 3 && (
          <section className="space-y-4">
            <h2 className="text-xl">Como quero visualizar</h2>
            <RadioGroup value={preferences.visualProfile} onValueChange={(value) => update({ visualProfile: value })} className="grid gap-3 sm:grid-cols-3">
              {PROFILES.map((profile) => (
                <label key={profile.value} className="rounded-md border border-border p-4">
                  <RadioGroupItem value={profile.value} className="mb-3" />
                  <span className="block font-medium">{profile.title}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">{profile.description}</span>
                </label>
              ))}
            </RadioGroup>
            <div className="flex items-center justify-between rounded-md border border-border p-3"><Label htmlFor="reduce-motion">Reduzir movimentos</Label><Switch id="reduce-motion" checked={preferences.reduceMotion} onCheckedChange={(value) => update({ reduceMotion: value })} /></div>
            <div className="flex items-center justify-between rounded-md border border-border p-3"><Label htmlFor="hide-indicators">Esconder indicadores secundários</Label><Switch id="hide-indicators" checked={preferences.hideSecondaryIndicators} onCheckedChange={(value) => update({ hideSecondaryIndicators: value })} /></div>
          </section>
        )}

        {preferences.onboardingStep === 4 && (
          <section className="space-y-5">
            <h2 className="text-xl">Como quero planejar</h2>
            <div className="space-y-2"><Label>Planejamento</Label><Select value={preferences.planningMode} onValueChange={(value) => update({ planningMode: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="sugerir">Quero que o Clareia sugira</SelectItem><SelectItem value="manual">Quero organizar manualmente</SelectItem><SelectItem value="confirmar">Quero sugestões, mas prefiro confirmar</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Check-in</Label><Select value={preferences.checkInFrequency} onValueChange={(value) => update({ checkInFrequency: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="diariamente">Diariamente</SelectItem><SelectItem value="quando_necessario">Somente quando necessário</SelectItem><SelectItem value="desativado">Desativado</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Agendamento</Label><Select value={preferences.schedulingMode} onValueChange={(value) => update({ schedulingMode: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="automatico">Encaixar automaticamente</SelectItem><SelectItem value="confirmar">Sugerir horários e pedir confirmação</SelectItem><SelectItem value="manual">Nunca alterar automaticamente</SelectItem></SelectContent></Select></div>
          </section>
        )}

        {preferences.onboardingStep === 5 && (
          <section className="space-y-4">
            <h2 className="text-xl">Notificações e integrações</h2>
            {Object.entries({ important: 'Lembretes importantes', deadlines: 'Prazos', billings: 'Cobranças', waitingReturns: 'Itens aguardando retorno' }).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between rounded-md border border-border p-3"><Label htmlFor={`notification-${key}`}>{label}</Label><Switch id={`notification-${key}`} checked={preferences.notifications[key]} onCheckedChange={(value) => update({ notifications: { ...preferences.notifications, [key]: value } })} /></div>
            ))}
            <p className="text-sm text-muted-foreground">Google Calendar e Google Drive são opcionais e podem ser conectados depois em Preferências.</p>
          </section>
        )}

        <DialogFooter className="-mx-6 -mb-6 border-t border-border bg-card px-6 py-4 sm:justify-between">
          <div className="flex gap-2">
            {preferences.onboardingStep > 1 && <Button variant="outline" onClick={() => changeStep(preferences.onboardingStep - 1)}>Voltar</Button>}
            <Button variant="ghost" onClick={configureLater}>Configurar depois</Button>
          </div>
          <div className="flex gap-2">
            {preferences.onboardingStep === 1 && <Button variant="outline" onClick={() => finish()}>Usar configuração recomendada</Button>}
            {preferences.onboardingStep < 5
              ? <Button onClick={() => changeStep(preferences.onboardingStep + 1)}>Continuar</Button>
              : <Button onClick={() => finish()}>Concluir</Button>}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}