import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { Settings } from 'lucide-react';
import Header from '@/components/Header.jsx';
import Sidebar from '@/components/Sidebar.jsx';
import MobileNav from '@/components/MobileNav.jsx';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useTheme } from '@/contexts/ThemeContext.jsx';
import { getCalendarPreferences, updateCalendarPreferences } from '@/services/calendarPreferencesService.js';
import { loadUserPreferences, readUserPreferences, saveUserPreferences } from '@/services/userPreferencesService.js';

const WEEK_DAYS = [
  { value: 1, label: 'Seg' }, { value: 2, label: 'Ter' }, { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' }, { value: 5, label: 'Sex' }, { value: 6, label: 'Sáb' }, { value: 0, label: 'Dom' },
];

const SECTIONS = [
  ['uso', 'Meu jeito de usar'], ['rotina', 'Rotina e capacidade'], ['planejamento', 'Planejamento'],
  ['visual', 'Visual e estímulos'], ['notificacoes', 'Notificações'], ['integracoes', 'Integrações'], ['conta', 'Conta e dados'],
];

export default function SettingsPage() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { lowStimulationMode, setLowStimulationMode, themeSetting, setTheme } = useTheme();
  const [preferences, setPreferences] = useState(() => readUserPreferences(currentUser?.id));
  const [calendarPrefs, setCalendarPrefs] = useState(() => getCalendarPreferences());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!currentUser?.id) return;
    loadUserPreferences(currentUser.id).then(setPreferences);
  }, [currentUser?.id]);

  const update = async (updates) => {
    const next = { ...preferences, ...updates };
    setPreferences(next);
    setSaving(true);
    const saved = await saveUserPreferences(currentUser?.id, next);
    setPreferences(saved);
    setSaving(false);
  };

  const toggleWorkDay = (day) => {
    const current = calendarPrefs.workDays || [];
    const nextDays = current.includes(day) ? current.filter((item) => item !== day) : [...current, day];
    if (!nextDays.length) return;
    setCalendarPrefs(updateCalendarPreferences({ workDays: nextDays }));
    update({ activeDays: nextDays });
  };

  return (
    <>
      <Helmet><title>Preferências - Clareia</title></Helmet>
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="min-w-0 flex-1 pb-20 md:pb-8">
            <div className="page-container section-spacing max-w-4xl">
              <div className="mb-8 flex items-start justify-between gap-4">
                <div>
                  <div className="mb-2 flex items-center gap-3"><Settings className="h-7 w-7 text-primary" /><h1 className="text-3xl">Preferências</h1></div>
                  <p className="text-muted-foreground">Seu plano pode mudar. Ajustamos juntos.</p>
                </div>
                <span className="text-sm text-muted-foreground" role="status">{saving ? 'Salvando...' : 'Salvo'}</span>
              </div>

              <Tabs defaultValue="uso" orientation="vertical" className="grid gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
                <TabsList className="h-auto w-full flex-row justify-start overflow-x-auto bg-muted p-1 md:flex-col md:items-stretch md:overflow-visible">
                  {SECTIONS.map(([value, label]) => <TabsTrigger key={value} value={value} className="min-h-11 justify-start whitespace-nowrap">{label}</TabsTrigger>)}
                </TabsList>

                <div className="min-w-0">
                  <TabsContent value="uso" className="mt-0 space-y-5">
                    <SectionTitle title="Meu jeito de usar" description="Defina como o Clareia pode reduzir decisões no dia a dia." />
                    <Field label="Duração confortável de uma tarefa"><Select value={String(preferences.comfortableDuration)} onValueChange={(value) => update({ comfortableDuration: Number(value) })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[15, 30, 45, 60].map((value) => <SelectItem key={value} value={String(value)}>{value} minutos</SelectItem>)}</SelectContent></Select></Field>
                    <Field label="Máximo de prioridades por dia"><Select value={String(preferences.maxDailyPriorities)} onValueChange={(value) => update({ maxDailyPriorities: Number(value) })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[1, 3, 5].map((value) => <SelectItem key={value} value={String(value)}>{value}</SelectItem>)}</SelectContent></Select></Field>
                    <Button variant="outline" onClick={() => update({ onboardingCompleted: false, onboardingDismissed: false, onboardingStep: 1 })}>Rever preferências iniciais</Button>
                  </TabsContent>

                  <TabsContent value="rotina" className="mt-0 space-y-5">
                    <SectionTitle title="Rotina e capacidade" description="Não precisa ser preciso. Use uma estimativa confortável." />
                    <Field label="Dias de atividade"><div className="grid grid-cols-4 gap-2 sm:grid-cols-7">{WEEK_DAYS.map((day) => <label key={day.value} className="flex min-h-11 items-center gap-2 rounded-md border border-border px-2"><Checkbox checked={calendarPrefs.workDays.includes(day.value)} onCheckedChange={() => toggleWorkDay(day.value)} /><span>{day.label}</span></label>)}</div></Field>
                    <Field label="Tempo normalmente disponível"><Select value={preferences.availableTime} onValueChange={(value) => update({ availableTime: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['30min', '1h', '2h', '4h'].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></Field>
                    <Field label="Margem para imprevistos (%)"><Input type="number" min="0" max="50" value={preferences.contingencyMargin} onChange={(event) => update({ contingencyMargin: Number(event.target.value) })} /></Field>
                  </TabsContent>

                  <TabsContent value="planejamento" className="mt-0 space-y-5">
                    <SectionTitle title="Planejamento" description="Escolha quanto o Clareia deve sugerir antes de agir." />
                    <Field label="Como você prefere os passos?"><Select value={preferences.microtaskDetail} onValueChange={(value) => update({ microtaskDetail: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="poucos">Poucos passos</SelectItem><SelectItem value="equilibrado">Equilibrado</SelectItem><SelectItem value="detalhado">Bem detalhado</SelectItem></SelectContent></Select></Field>
                    <Field label="Ao abrir o Clareia"><Select value={preferences.openingPreference} onValueChange={(value) => update({ openingPreference: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="dashboard">Mostrar o dashboard normal</SelectItem><SelectItem value="tranquilo">Abrir no Modo tranquilo</SelectItem><SelectItem value="retomada">Priorizar onde eu parei</SelectItem></SelectContent></Select></Field>
                    <Field label="Como planejar"><Select value={preferences.planningMode} onValueChange={(value) => update({ planningMode: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="sugerir">Quero que o Clareia sugira</SelectItem><SelectItem value="manual">Quero organizar manualmente</SelectItem><SelectItem value="confirmar">Sugestões com confirmação</SelectItem></SelectContent></Select></Field>
                    <Field label="Frequência do check-in"><Select value={preferences.checkInFrequency} onValueChange={(value) => update({ checkInFrequency: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="diariamente">Diariamente</SelectItem><SelectItem value="quando_necessario">Quando necessário</SelectItem><SelectItem value="desativado">Desativado</SelectItem></SelectContent></Select></Field>
                    <Field label="Agendamento"><Select value={preferences.schedulingMode} onValueChange={(value) => update({ schedulingMode: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="automatico">Encaixar automaticamente</SelectItem><SelectItem value="confirmar">Sugerir e pedir confirmação</SelectItem><SelectItem value="manual">Nunca alterar automaticamente</SelectItem></SelectContent></Select></Field>
                  </TabsContent>

                  <TabsContent value="visual" className="mt-0 space-y-5">
                    <SectionTitle title="Visual e estímulos" description="Tema e estímulo são ajustes independentes." />
                    <ToggleRow label="Modo tranquilo" description="Menos cores, movimento, sombras e indicadores secundários." checked={lowStimulationMode} onChange={(value) => { setLowStimulationMode(value); update({ visualProfile: value ? 'tranquilo' : 'equilibrado' }); }} />
                    <Field label="Tema"><Select value={themeSetting} onValueChange={(value) => { setTheme(value); update({ theme: value }); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="light">Claro</SelectItem><SelectItem value="dark">Escuro</SelectItem><SelectItem value="auto">Automático</SelectItem></SelectContent></Select></Field>
                    <Field label="Tamanho do texto"><Select value={preferences.textSize} onValueChange={(value) => update({ textSize: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="confortavel">Confortável</SelectItem><SelectItem value="grande">Grande</SelectItem></SelectContent></Select></Field>
                    <Field label="Densidade"><Select value={preferences.density} onValueChange={(value) => update({ density: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="confortavel">Confortável</SelectItem><SelectItem value="media">Média</SelectItem><SelectItem value="compacta">Compacta</SelectItem></SelectContent></Select></Field>
                    <Field label="Contraste"><Select value={preferences.contrast} onValueChange={(value) => update({ contrast: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="normal">Normal</SelectItem><SelectItem value="alto">Alto</SelectItem></SelectContent></Select></Field>
                    <ToggleRow label="Reduzir movimentos" checked={preferences.reduceMotion} onChange={(value) => update({ reduceMotion: value })} />
                    <ToggleRow label="Esconder indicadores secundários" checked={preferences.hideSecondaryIndicators} onChange={(value) => update({ hideSecondaryIndicators: value })} />
                    <ToggleRow label="Sons" checked={preferences.soundsEnabled} onChange={(value) => update({ soundsEnabled: value })} />
                    <ToggleRow label="Comemorações" checked={preferences.celebrationsEnabled} onChange={(value) => update({ celebrationsEnabled: value })} />
                  </TabsContent>

                  <TabsContent value="notificacoes" className="mt-0 space-y-4">
                    <SectionTitle title="Notificações" description="Ative somente o que ajuda de verdade." />
                    {Object.entries({ important: 'Lembretes importantes', deadlines: 'Prazos', billings: 'Cobranças', waitingReturns: 'Aguardando retorno' }).map(([key, label]) => <ToggleRow key={key} label={label} checked={preferences.notifications[key]} onChange={(value) => update({ notifications: { ...preferences.notifications, [key]: value } })} />)}
                    <ToggleRow label="Horário silencioso" checked={preferences.quietHours.enabled} onChange={(value) => update({ quietHours: { ...preferences.quietHours, enabled: value } })} />
                  </TabsContent>

                  <TabsContent value="integracoes" className="mt-0 space-y-5">
                    <SectionTitle title="Integrações" description="Conexões são opcionais e não impedem o uso do Clareia." />
                    <div className="flex items-center justify-between gap-4 border-b border-border py-4"><div><p className="font-medium">Google Drive</p><p className="text-sm text-muted-foreground">Arquivos e materiais dos projetos.</p></div><Button variant="outline" onClick={() => navigate('/integracoes/google-drive-oauth')}>Configurar</Button></div>
                    <ToggleRow label="Google Calendar" description="Integração preparada para configuração futura." checked={preferences.integrations.googleCalendar} onChange={(value) => update({ integrations: { ...preferences.integrations, googleCalendar: value } })} />
                  </TabsContent>

                  <TabsContent value="conta" className="mt-0 space-y-5">
                    <SectionTitle title="Conta e dados" description="Dados pessoais, senha e sessão ficam em uma área separada." />
                    <Button onClick={() => navigate('/conta')}>Abrir Conta</Button>
                  </TabsContent>
                </div>
              </Tabs>
            </div>
          </main>
        </div>
        <MobileNav />
      </div>
    </>
  );
}

function SectionTitle({ title, description }) {
  return <div className="border-b border-border pb-4"><h2 className="text-xl">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{description}</p></div>;
}

function Field({ label, children }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}

function ToggleRow({ label, description, checked, onChange }) {
  return <div className="flex min-h-14 items-center justify-between gap-4 border-b border-border py-3"><div><p className="font-medium">{label}</p>{description && <p className="text-sm text-muted-foreground">{description}</p>}</div><Switch checked={checked} onCheckedChange={onChange} aria-label={label} /></div>;
}