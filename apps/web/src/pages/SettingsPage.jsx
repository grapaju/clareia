import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { Settings, RotateCcw } from 'lucide-react';
import Header from '@/components/Header.jsx';
import Sidebar from '@/components/Sidebar.jsx';
import MobileNav from '@/components/MobileNav.jsx';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useTaskContext } from '@/hooks/useTaskContext.js';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { useTheme } from '@/contexts/ThemeContext.jsx';
import { Checkbox } from '@/components/ui/checkbox';
import { getCalendarPreferences, updateCalendarPreferences } from '@/services/calendarPreferencesService.js';
import { useAppMode } from '@/contexts/AppModeContext.jsx';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const WEEK_DAYS = [
  { value: 1, label: 'Segunda' },
  { value: 2, label: 'Terça' },
  { value: 3, label: 'Quarta' },
  { value: 4, label: 'Quinta' },
  { value: 5, label: 'Sexta' },
  { value: 6, label: 'Sábado' },
  { value: 0, label: 'Domingo' }
];

export default function SettingsPage() {
  const { clearDailyCheckIn } = useTaskContext();
  const { lowStimulationMode, toggleLowStimulationMode } = useTheme();
  const { developmentLock, updateDevelopmentLock } = useAppMode();
  const [calendarPrefs, setCalendarPrefs] = useState(() => getCalendarPreferences());

  const handleResetCheckIn = () => {
    clearDailyCheckIn();
    toast.success('Check-in diário limpo. Você poderá responder novamente hoje.');
  };

  const handleToggleWorkDay = (day) => {
    const current = Array.isArray(calendarPrefs.workDays) ? calendarPrefs.workDays : [];
    const hasDay = current.includes(day);
    const nextWorkDays = hasDay ? current.filter((item) => item !== day) : [...current, day];
    if (nextWorkDays.length === 0) {
      toast.error('Selecione ao menos um dia útil de trabalho.');
      return;
    }

    const saved = updateCalendarPreferences({ workDays: nextWorkDays });
    setCalendarPrefs(saved);
  };

  const handleToggleWeekendTasks = (value) => {
    const saved = updateCalendarPreferences({ allowWeekendTasks: value });
    setCalendarPrefs(saved);
  };

  const handleToggleSundayRest = (value) => {
    const saved = updateCalendarPreferences({ sundayIsRestDay: value });
    setCalendarPrefs(saved);
  };

  const handleDevLockMode = (value) => {
    updateDevelopmentLock({ mode: value });
    toast.success('Regra de desenvolvimento atualizada.');
  };

  const handleDevLockTime = (field, value) => {
    updateDevelopmentLock({ [field]: value });
  };

  const handleDevLockDay = (day) => {
    const current = Array.isArray(developmentLock.allowedDays) ? developmentLock.allowedDays : [];
    const hasDay = current.includes(day);
    const next = hasDay ? current.filter((item) => item !== day) : [...current, day];
    if (next.length === 0) {
      toast.error('Selecione ao menos um dia para liberar desenvolvimento.');
      return;
    }
    updateDevelopmentLock({ allowedDays: next });
  };

  return (
    <>
      <Helmet><title>Configurações - Clareia</title></Helmet>
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 pb-20 md:pb-8">
            <div className="page-container section-spacing max-w-3xl">
              <div className="mb-10">
                <div className="flex items-center gap-3 mb-3">
                  <Settings className="w-8 h-8 text-primary" />
                  <h1 className="text-3xl font-medium text-foreground">Configurações</h1>
                </div>
                <p className="text-lg text-muted-foreground">Ajustes rápidos do seu fluxo diário.</p>
              </div>

              <Card className="bg-card border-border shadow-sm mb-6">
                <CardContent className="p-6">
                  <h2 className="text-lg font-medium text-foreground mb-2">Check-in diário</h2>
                  <p className="text-sm text-muted-foreground mb-4">Se quiser refazer o check-in agora, limpe o check-in atual e volte para a tela Hoje.</p>
                  <Button variant="outline" onClick={handleResetCheckIn} className="border-border text-foreground hover:bg-muted">
                    <RotateCcw className="w-4 h-4 mr-2" /> Limpar check-in de hoje
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-card border-border shadow-sm mb-6">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-medium text-foreground mb-2">Modo baixa estimulação</h2>
                      <p className="text-sm text-muted-foreground">Reduz destaque visual, simplifica cards e prioriza execução de uma coisa por vez.</p>
                    </div>
                    <Switch checked={lowStimulationMode} onCheckedChange={toggleLowStimulationMode} aria-label="Ativar modo baixa estimulação" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border shadow-sm mb-6">
                <CardContent className="p-6 space-y-5">
                  <div>
                    <h2 className="text-lg font-medium text-foreground mb-2">Agenda e dias úteis</h2>
                    <p className="text-sm text-muted-foreground">Defina quando o Clareia pode encaixar tarefas automaticamente no calendário.</p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">Dias úteis de trabalho</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {WEEK_DAYS.map((day) => (
                        <label key={day.value} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-foreground">
                          <Checkbox
                            checked={calendarPrefs.workDays.includes(day.value)}
                            onCheckedChange={() => handleToggleWorkDay(day.value)}
                          />
                          <span>{day.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-foreground">Permitir tarefas no fim de semana</p>
                        <p className="text-xs text-muted-foreground">Se desativado, o encaixe automático evita tarefas de cliente em sábado e domingo.</p>
                      </div>
                      <Switch
                        checked={calendarPrefs.allowWeekendTasks}
                        onCheckedChange={handleToggleWeekendTasks}
                        aria-label="Permitir tarefas no fim de semana"
                      />
                    </div>

                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-foreground">Domingo é descanso</p>
                        <p className="text-xs text-muted-foreground">Quando ativo, o Clareia evita encaixes automáticos no domingo.</p>
                      </div>
                      <Switch
                        checked={calendarPrefs.sundayIsRestDay}
                        onCheckedChange={handleToggleSundayRest}
                        aria-label="Domingo é descanso"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border shadow-sm mb-6">
                <CardContent className="p-6 space-y-5">
                  <div>
                    <h2 className="text-lg font-medium text-foreground mb-2">Limitar desenvolvimento do Clareia</h2>
                    <p className="text-sm text-muted-foreground">Defina quando o modo Desenvolvimento pode ser ativado para evitar distrações no uso diário.</p>
                  </div>

                  <RadioGroup value={developmentLock.mode} onValueChange={handleDevLockMode} className="space-y-3">
                    <label className="flex items-start gap-3 rounded-lg border border-border p-3">
                      <RadioGroupItem value="always" id="dev-lock-always" />
                      <div>
                        <p className="text-sm font-medium text-foreground">Permitir desenvolvimento a qualquer hora</p>
                        <p className="text-xs text-muted-foreground">Sem bloqueio de horário ou dia.</p>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 rounded-lg border border-border p-3">
                      <RadioGroupItem value="hours" id="dev-lock-hours" />
                      <div>
                        <p className="text-sm font-medium text-foreground">Permitir somente em horários definidos</p>
                        <p className="text-xs text-muted-foreground">Ex.: todos os dias, das 10:00 às 11:00.</p>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 rounded-lg border border-border p-3">
                      <RadioGroupItem value="days" id="dev-lock-days" />
                      <div>
                        <p className="text-sm font-medium text-foreground">Permitir somente em dias definidos</p>
                        <p className="text-xs text-muted-foreground">Ex.: sábado das 10:00 às 11:00.</p>
                      </div>
                    </label>
                  </RadioGroup>

                  {developmentLock.mode !== 'always' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="dev-start-time">Horario inicial</Label>
                        <Input
                          id="dev-start-time"
                          type="time"
                          value={developmentLock.startTime}
                          onChange={(event) => handleDevLockTime('startTime', event.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="dev-end-time">Horario final</Label>
                        <Input
                          id="dev-end-time"
                          type="time"
                          value={developmentLock.endTime}
                          onChange={(event) => handleDevLockTime('endTime', event.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  {developmentLock.mode === 'days' && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-foreground">Dias permitidos</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {WEEK_DAYS.map((day) => (
                          <label key={`dev-day-${day.value}`} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-foreground">
                            <Checkbox
                              checked={developmentLock.allowedDays.includes(day.value)}
                              onCheckedChange={() => handleDevLockDay(day.value)}
                            />
                            <span>{day.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

            </div>
          </main>
        </div>
        <MobileNav />
      </div>
    </>
  );
}
