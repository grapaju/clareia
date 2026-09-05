import React, { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { addManualWorkSession } from '@/services/workSessionService.js';
import { toast } from 'sonner';
import { PROFESSIONAL_CATEGORIES } from '@/lib/professionalJourneyLogic.js';

export default function ManualTimeDialog({
  isOpen,
  onOpenChange,
  defaultProject = 'Pessoal',
  defaultTaskId = 'none',
  tasks = [],
  onSaved,
  professionalJourneys = [],
  onSaveProfessional,
}) {
  const [form, setForm] = useState({
    projectId: defaultProject || 'Pessoal',
    taskId: defaultTaskId || 'none',
    date: new Date().toISOString().split('T')[0],
    durationMinutes: 30,
    title: '',
    notes: '',
    category: 'Outro'
  });

  const taskOptions = useMemo(() => tasks.filter(Boolean), [tasks]);

  const handleSave = async () => {
    const professionalJourney = professionalJourneys.find((journey) => (
      journey.projectName === form.projectId
      && String(journey.startedAt || '').slice(0, 10) === form.date
    )) || professionalJourneys.find((journey) => journey.projectName === form.projectId);
    const durationMinutes = Number(form.durationMinutes || 0);
    if (professionalJourney && onSaveProfessional) {
      if (!form.title.trim() || durationMinutes <= 0) {
        toast.error('Informe descrição e duração válidas para salvar o tempo.');
        return;
      }
      const startedAt = new Date(`${form.date}T09:00:00`).toISOString();
      const endedAt = new Date(new Date(startedAt).getTime() + durationMinutes * 60000).toISOString();
      await onSaveProfessional({
        journeyId: professionalJourney.id,
        title: form.title,
        taskId: form.taskId !== 'none' ? form.taskId : null,
        category: form.category,
        source: 'manual',
        startedAt,
        endedAt,
        notes: form.notes,
      });
      toast.success('Tempo profissional registrado.');
      onOpenChange(false);
      return;
    }
    const created = addManualWorkSession({
      projectId: form.projectId,
      taskId: form.taskId !== 'none' ? form.taskId : null,
      date: `${form.date}T09:00:00.000Z`,
      durationMinutes: Number(form.durationMinutes || 0),
      title: form.title,
      notes: form.notes
    });

    if (!created) {
      toast.error('Informe data e duração válidas para salvar o tempo.');
      return;
    }

    toast.success('Tempo manual registrado.');
    onSaved?.(created);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar tempo manual</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Projeto</Label>
            <Input value={form.projectId} onChange={(event) => setForm((current) => ({ ...current, projectId: event.target.value }))} />
          </div>

          <div className="space-y-2">
            <Label>Tarefa (opcional)</Label>
            <Select value={form.taskId} onValueChange={(value) => setForm((current) => ({ ...current, taskId: value }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem tarefa</SelectItem>
                {taskOptions.map((task) => (
                  <SelectItem key={task.id} value={task.id}>{task.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Duração (min)</Label>
              <Input type="number" min={1} value={form.durationMinutes} onChange={(event) => setForm((current) => ({ ...current, durationMinutes: event.target.value }))} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Ex.: revisão de briefing" />
          </div>

          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={form.category} onValueChange={(value) => setForm((current) => ({ ...current, category: value }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PROFESSIONAL_CATEGORIES.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} className="min-h-20" />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSave}>Salvar tempo</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
