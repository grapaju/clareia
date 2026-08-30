import React, { useEffect, useState } from 'react';
import { ChevronDown, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { autoSuggestAll } from '@/lib/autoSuggestions';
import { generateMicrotasks } from '@/lib/microtaskRules';
import MicrotaskEditor from './MicrotaskEditor.jsx';
import { normalizeMicrotasks } from '@/lib/taskExecution.js';
import { toLocalIsoDate } from '@/lib/localDate.js';
import { validateTaskInput } from '@/lib/taskInput.js';
import ProjectSelect from '@/components/ProjectSelect.jsx';

const TASK_TYPES = ['Cobrança', 'Reunião', 'Desenvolvimento', 'Site', 'Google Ads', 'Atendimento', 'Administrativo', 'Pessoal', 'Evento', 'Outro'];
const TIME_OPTIONS = ['15', '30', '45', '60', '90', '120', '180'];

function suggestedPeriod() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Manhã';
  if (hour < 18) return 'Tarde';
  return 'Noite';
}

function initialData(task = {}) {
  const scheduledDate = task.scheduledDate || task.dataSugeridaExecucao || toLocalIsoDate(new Date());
  return {
    ...task,
    title: task.title || '',
    project: task.project || '',
    nextAction: task.nextAction || '',
    dueDate: task.dueDate ? String(task.dueDate).split('T')[0] : '',
    description: task.description || '',
    taskType: task.taskType || 'Pessoal',
    timeEstimate: String(task.timeEstimate || '30'),
    dataSugeridaExecucao: String(scheduledDate).split('T')[0],
    periodoSugerido: task.periodoSugerido || task.scheduledPeriod || suggestedPeriod(),
    energiaNecessaria: task.energiaNecessaria || 'Média',
    importance: task.importance || 'Média',
    urgency: task.urgency || 'Média',
    executionDifficulty: task.executionDifficulty || 'Direta',
    recurrenceFrequency: task.recurrenceFrequency || 'Nenhuma',
    microtarefas: normalizeMicrotasks(task.microtarefas || [], task.id || ''),
  };
}

export default function TaskModal({ task, onSubmit, onCancel }) {
  const [formData, setFormData] = useState(() => initialData(task));
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => setFormData(initialData(task)), [task]);

  const handleChange = (field, value) => {
    setFormData((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const handleSuggest = () => {
    if (!formData.title.trim()) return;
    const suggestions = autoSuggestAll(formData.title, formData.dueDate);
    setFormData((current) => ({
      ...current,
      taskType: current.taskType || suggestions.taskType,
      project: current.project || suggestions.project,
      timeEstimate: current.timeEstimate || String(suggestions.timeEstimate || 30),
      nextAction: current.nextAction || suggestions.nextAction,
      microtarefas: current.microtarefas.length
        ? current.microtarefas
        : generateMicrotasks(suggestions.taskType, current.title, suggestions.timeEstimate || 30),
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const validation = validateTaskInput(formData);
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        ...formData,
        scheduledDate: formData.dataSugeridaExecucao,
        scheduledPeriod: formData.periodoSugerido,
        timeEstimate: Number.parseInt(formData.timeEstimate, 10) || 30,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="task-title">O que precisa ser feito? *</Label>
        <Input
          id="task-title"
          autoFocus
          value={formData.title}
          onChange={(event) => handleChange('title', event.target.value)}
          aria-invalid={Boolean(errors.title)}
          aria-describedby={errors.title ? 'task-title-error' : undefined}
        />
        {errors.title && <p id="task-title-error" className="text-sm text-destructive">{errors.title}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="task-project">Projeto <span className="text-muted-foreground">(opcional)</span></Label>
        <ProjectSelect value={formData.project} onChange={(value) => handleChange('project', value)} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="task-next-action">Primeiro passo visível <span className="text-muted-foreground">(opcional)</span></Label>
        <Input id="task-next-action" value={formData.nextAction} onChange={(event) => handleChange('nextAction', event.target.value)} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="task-due-date">Precisa estar pronto até <span className="text-muted-foreground">(opcional)</span></Label>
        <Input id="task-due-date" type="date" value={formData.dueDate} onChange={(event) => handleChange('dueDate', event.target.value)} />
      </div>

      <details className="group rounded-md border border-border">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 py-3 font-medium">
          Adicionar detalhes
          <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="space-y-5 border-t border-border p-4">
          <Button type="button" variant="outline" size="sm" onClick={handleSuggest}>
            <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" /> Preencher sugestões
          </Button>

          <div className="space-y-2">
            <Label htmlFor="task-description">Descrição</Label>
            <Textarea id="task-description" value={formData.description} onChange={(event) => handleChange('description', event.target.value)} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Quero fazer em</Label>
              <Input type="date" value={formData.dataSugeridaExecucao} onChange={(event) => handleChange('dataSugeridaExecucao', event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Duração estimada</Label>
              <Select value={formData.timeEstimate} onValueChange={(value) => handleChange('timeEstimate', value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TIME_OPTIONS.map((time) => <SelectItem key={time} value={time}>{time} minutos</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Quanto esforço exige?</Label>
              <Select value={formData.energiaNecessaria} onValueChange={(value) => handleChange('energiaNecessaria', value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{['Baixa', 'Média', 'Alta'].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Período</Label>
              <Select value={formData.periodoSugerido} onValueChange={(value) => handleChange('periodoSugerido', value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{['Manhã', 'Tarde', 'Noite', 'Horário específico'].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={formData.taskType} onValueChange={(value) => handleChange('taskType', value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TASK_TYPES.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Recorrência</Label>
              <Select value={formData.recurrenceFrequency} onValueChange={(value) => handleChange('recurrenceFrequency', value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{['Nenhuma', 'Semanal', 'Mensal'].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Como está essa tarefa para você?</Label>
              <Select value={formData.executionDifficulty} onValueChange={(value) => handleChange('executionDifficulty', value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Direta">Consigo fazer diretamente</SelectItem>
                  <SelectItem value="Grande demais">Preciso dividir em passos</SelectItem>
                  <SelectItem value="Tem atrito">Ainda não sei como começar</SelectItem>
                  <SelectItem value="Travada">Estou travada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <MicrotaskEditor microtasks={formData.microtarefas} onChange={(value) => handleChange('microtarefas', value)} />
        </div>
      </details>

      <div className="sticky bottom-0 z-10 -mx-1 flex flex-col-reverse gap-2 border-t border-border bg-card px-1 py-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>Cancelar</Button>
        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Guardando...' : task?.id ? 'Salvar alterações' : 'Guardar tarefa'}</Button>
      </div>
    </form>
  );
}