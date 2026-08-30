import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { FlaskConical } from 'lucide-react';
import Header from '@/components/Header.jsx';
import Sidebar from '@/components/Sidebar.jsx';
import MobileNav from '@/components/MobileNav.jsx';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAppMode } from '@/contexts/AppModeContext.jsx';
import { useTaskContext } from '@/hooks/useTaskContext.js';
import { saveImprovementForLater } from '@/lib/improvementCapture.js';
import { toast } from 'sonner';

const DAYS = [{ value: 1, label: 'Seg' }, { value: 2, label: 'Ter' }, { value: 3, label: 'Qua' }, { value: 4, label: 'Qui' }, { value: 5, label: 'Sex' }, { value: 6, label: 'Sáb' }, { value: 0, label: 'Dom' }];

export default function LaboratoryPage() {
  const { addTask } = useTaskContext();
  const { developmentLock, updateDevelopmentLock } = useAppMode();
  const [draft, setDraft] = useState({ title: '', description: '', relatedScreen: 'Hoje', priority: 'media', reviewWhen: 'esta_semana', includeInToday: false });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!draft.title.trim()) {
      toast.error('Informe o título da melhoria.');
      return;
    }
    setSaving(true);
    try {
      await saveImprovementForLater({ addTask, ...draft });
      setDraft((current) => ({ ...current, title: '', description: '', includeInToday: false }));
      toast.success('Melhoria guardada para revisar depois.');
    } catch (error) {
      toast.error(error?.message || 'Não foi possível guardar a melhoria.');
    } finally {
      setSaving(false);
    }
  };

  const toggleDay = (day) => {
    const current = developmentLock.allowedDays || [];
    const next = current.includes(day) ? current.filter((value) => value !== day) : [...current, day];
    if (next.length) updateDevelopmentLock({ allowedDays: next });
  };

  return (
    <>
      <Helmet><title>Laboratório - Clareia</title></Helmet>
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="min-w-0 flex-1 pb-20 md:pb-8">
            <div className="page-container section-spacing max-w-3xl">
              <div className="mb-8"><div className="mb-2 flex items-center gap-3"><FlaskConical className="h-7 w-7 text-primary" /><h1 className="text-3xl">Laboratório</h1></div><p className="text-muted-foreground">Ferramentas internas para evolução do Clareia.</p></div>

              <section className="space-y-5 border-b border-border pb-8">
                <div><h2 className="text-xl">Guardar melhoria para depois</h2><p className="text-sm text-muted-foreground">Registre a ideia sem interromper o trabalho atual.</p></div>
                <div className="space-y-2"><Label htmlFor="improvement-title">Título</Label><Input id="improvement-title" value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} /></div>
                <div className="space-y-2"><Label htmlFor="improvement-description">Descrição</Label><Textarea id="improvement-description" value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} /></div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2"><Label>Tela relacionada</Label><Select value={draft.relatedScreen} onValueChange={(value) => setDraft((current) => ({ ...current, relatedScreen: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['Hoje', 'Capturar', 'Plano', 'Projetos', 'Calendário', 'Preferências', 'Outra'].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-2"><Label>Prioridade</Label><Select value={draft.priority} onValueChange={(value) => setDraft((current) => ({ ...current, priority: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="baixa">Baixa</SelectItem><SelectItem value="media">Média</SelectItem><SelectItem value="alta">Alta</SelectItem></SelectContent></Select></div>
                </div>
                <label className="flex min-h-11 items-center gap-3"><Checkbox checked={draft.includeInToday} onCheckedChange={(value) => setDraft((current) => ({ ...current, includeInToday: Boolean(value) }))} />Adicionar na tela Hoje</label>
                <Button onClick={save} disabled={saving}>{saving ? 'Guardando...' : 'Guardar melhoria'}</Button>
              </section>

              <section className="space-y-5 pt-8">
                <div><h2 className="text-xl">Janela de desenvolvimento</h2><p className="text-sm text-muted-foreground">Preserva as regras internas sem ocupar o uso comum.</p></div>
                <RadioGroup value={developmentLock.mode} onValueChange={(value) => updateDevelopmentLock({ mode: value })} className="space-y-2">
                  <label className="flex min-h-11 items-center gap-3"><RadioGroupItem value="always" />Sempre permitido</label>
                  <label className="flex min-h-11 items-center gap-3"><RadioGroupItem value="hours" />Somente no horário definido</label>
                  <label className="flex min-h-11 items-center gap-3"><RadioGroupItem value="days" />Somente em dias e horários definidos</label>
                </RadioGroup>
                {developmentLock.mode !== 'always' && <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Início</Label><Input type="time" value={developmentLock.startTime} onChange={(event) => updateDevelopmentLock({ startTime: event.target.value })} /></div><div className="space-y-2"><Label>Fim</Label><Input type="time" value={developmentLock.endTime} onChange={(event) => updateDevelopmentLock({ endTime: event.target.value })} /></div></div>}
                {developmentLock.mode === 'days' && <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">{DAYS.map((day) => <label key={day.value} className="flex min-h-11 items-center gap-2 rounded-md border border-border px-2"><Checkbox checked={developmentLock.allowedDays.includes(day.value)} onCheckedChange={() => toggleDay(day.value)} />{day.label}</label>)}</div>}
              </section>
            </div>
          </main>
        </div>
        <MobileNav />
      </div>
    </>
  );
}