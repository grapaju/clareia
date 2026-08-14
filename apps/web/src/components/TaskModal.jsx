
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles } from 'lucide-react';
import { autoSuggestAll } from '@/lib/autoSuggestions';
import { generateMicrotasks } from '@/lib/microtaskRules';
import MicrotaskList from './MicrotaskList.jsx';
import { normalizeMicrotasks } from '@/lib/taskExecution.js';

export default function TaskModal({ task, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    title: '',
    project: '',
    taskType: '',
    nextAction: '',
    timeEstimate: '',
    dueDate: '',
    dataSugeridaExecucao: new Date().toISOString().split('T')[0],
    periodoSugerido: 'manhã',
    energiaNecessaria: 'Média',
    status: 'pendente',
    microtarefas: []
  });

  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title || '',
        project: task.project || '',
        taskType: task.taskType || '',
        nextAction: task.nextAction || '',
        timeEstimate: task.timeEstimate || '',
        dueDate: task.dueDate ? task.dueDate.split('T')[0] : '',
        dataSugeridaExecucao: task.dataSugeridaExecucao ? task.dataSugeridaExecucao.split('T')[0] : new Date().toISOString().split('T')[0],
        periodoSugerido: task.periodoSugerido || 'manhã',
        energiaNecessaria: task.energiaNecessaria || 'Média',
        status: task.status || 'pendente',
        microtarefas: normalizeMicrotasks(task.microtarefas || [], task.id || '')
      });
    }
  }, [task]);

  const handleChange = (field, value) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      
      // Auto-generate microtasks if time > 60 or specific keywords found in title
      if (field === 'title' || field === 'timeEstimate' || field === 'taskType') {
        const titleL = updated.title.toLowerCase();
        const est = parseInt(updated.timeEstimate) || 0;
        const keywords = ['preparar', 'desenvolver', 'implementar', 'organizar', 'revisar', 'lançar', 'configurar', 'retomar', 'criar', 'atualizar', 'integrar', 'montar', 'estruturar', 'planejar'];
        const needsBreakdown = est > 60 || keywords.some(k => titleL.includes(k));
        
        if (needsBreakdown && (!prev.microtarefas || prev.microtarefas.length === 0)) {
          updated.microtarefas = generateMicrotasks(updated.taskType, updated.title, est);
        }
      }
      return updated;
    });
  };

  const handleSuggest = () => {
    if (!formData.title) return;
    const suggestions = autoSuggestAll(formData.title, formData.dueDate);
    const est = formData.timeEstimate || suggestions.timeEstimate;
    
    setFormData(prev => ({
      ...prev,
      taskType: prev.taskType || suggestions.taskType,
      project: prev.project || suggestions.project,
      timeEstimate: est,
      nextAction: prev.nextAction || suggestions.nextAction,
      microtarefas: prev.microtarefas?.length ? prev.microtarefas : generateMicrotasks(suggestions.taskType, prev.title, est)
    }));
  };

  const handleToggleMicrotask = (id, checked) => {
    setFormData(prev => ({
      ...prev,
      microtarefas: prev.microtarefas.map((m) => 
        m.id === id
          ? {
              ...m,
              completed: Boolean(checked),
              completedAt: checked ? new Date().toISOString() : null,
              status: checked ? 'concluída' : 'não iniciada'
            }
          : m
      )
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.project.trim() || !formData.taskType || !formData.nextAction || !formData.timeEstimate) {
      // Basic validation handled by 'required' attribute, but catch empty spaces
      return;
    }
    onSubmit({
      ...formData,
      scheduledDate: formData.dataSugeridaExecucao,
      scheduledPeriod: formData.periodoSugerido,
      timeEstimate: parseInt(formData.timeEstimate) || 30
    });
  };

  const timeOptions = ['15', '30', '45', '60', '90', '120', '180'];
  const taskTypes = ['Cobrança', 'Reunião', 'Desenvolvimento', 'Site', 'Google Ads', 'Atendimento', 'Administrativo', 'Pessoal', 'Evento', 'Outro'];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex gap-2 mb-2">
        <Button type="button" variant="secondary" onClick={handleSuggest} className="text-sm bg-accent/10 hover:bg-accent/20 text-accent border border-accent/20 h-8">
          <Sparkles className="w-3.5 h-3.5 mr-2" />
          Preencher sugestões
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-2 col-span-full">
          <Label className="text-foreground">Título *</Label>
          <Input 
            value={formData.title} 
            onChange={e => handleChange('title', e.target.value)} 
            placeholder="O que precisa ser feito?" 
            required
            className="bg-card text-foreground"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-foreground">Projeto/Cliente *</Label>
          <Input 
            value={formData.project} 
            onChange={e => handleChange('project', e.target.value)} 
            placeholder="Ex: Leone" 
            required
            className="bg-card text-foreground"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-foreground">Tipo de Tarefa *</Label>
          <Select value={formData.taskType} onValueChange={v => handleChange('taskType', v)} required>
            <SelectTrigger className="bg-card text-foreground"><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {taskTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 col-span-full">
          <Label className="text-foreground">Primeira ação prática *</Label>
          <Input 
            value={formData.nextAction} 
            onChange={e => handleChange('nextAction', e.target.value)} 
            placeholder="Ex: Abrir o painel e baixar os dados" 
            required
            className="bg-card text-foreground"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-foreground">Tempo Estimado (min) *</Label>
          <Select value={String(formData.timeEstimate)} onValueChange={v => handleChange('timeEstimate', v)} required>
            <SelectTrigger className="bg-card text-foreground"><SelectValue placeholder="Selecione o tempo" /></SelectTrigger>
            <SelectContent>
              {timeOptions.map(t => <SelectItem key={t} value={t}>{t} minutos</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-foreground">Energia Necessária *</Label>
          <Select value={formData.energiaNecessaria} onValueChange={v => handleChange('energiaNecessaria', v)} required>
            <SelectTrigger className="bg-card text-foreground"><SelectValue /></SelectTrigger>
            <SelectContent>
              {['Baixa', 'Média', 'Alta'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-foreground">Data Sugerida *</Label>
          <Input 
            type="date" 
            value={formData.dataSugeridaExecucao} 
            onChange={e => handleChange('dataSugeridaExecucao', e.target.value)} 
            required
            className="bg-card text-foreground"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-foreground">Período Sugerido *</Label>
          <Select value={formData.periodoSugerido} onValueChange={v => handleChange('periodoSugerido', v)} required>
            <SelectTrigger className="bg-card text-foreground"><SelectValue /></SelectTrigger>
            <SelectContent>
              {['manhã', 'tarde', 'noite', 'horário específico'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {formData.microtarefas && formData.microtarefas.length > 0 && (
        <div className="pt-2">
          <MicrotaskList 
            microtasks={formData.microtarefas} 
            taskType={formData.taskType} 
            onToggle={handleToggleMicrotask} 
          />
        </div>
      )}

      <div className="flex gap-3 pt-6 border-t border-border">
        <Button type="submit" className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90">
          {task?.id ? 'Salvar alterações' : 'Criar tarefa'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} className="bg-card">
          Cancelar
        </Button>
      </div>
    </form>
  );
}
