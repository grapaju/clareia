
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

const projects = ['Leone', 'Corcril', 'Expocentro', 'IDTPR', 'Torion', 'Personal System'];
const taskTypes = [
  { value: 'cobranca', label: 'Cobrança' },
  { value: 'reuniao', label: 'Reunião' },
  { value: 'desenvolvimento', label: 'Desenvolvimento' },
  { value: 'site', label: 'Site' },
  { value: 'google_ads', label: 'Google Ads' },
  { value: 'suporte', label: 'Suporte' },
  { value: 'administrativo', label: 'Administrativo' },
  { value: 'pessoal', label: 'Pessoal' },
  { value: 'outro', label: 'Outro' }
];
const statuses = [
  { value: 'caixa_de_entrada', label: 'Caixa de Entrada' },
  { value: 'hoje', label: 'Hoje' },
  { value: 'fazendo', label: 'Fazendo' },
  { value: 'aguardando', label: 'Aguardando' },
  { value: 'concluido', label: 'Concluído' },
  { value: 'adiado', label: 'Adiado' }
];

export default function TaskForm({ task, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    project: '',
    type: '',
    deadline: '',
    importance: 'medium',
    urgency: 'medium',
    estimatedTime: '',
    energyNeeded: 'medium',
    status: 'caixa_de_entrada',
    nextAction: '',
    notes: ''
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title || '',
        description: task.description || '',
        project: task.project || '',
        type: task.type || '',
        deadline: task.deadline || '',
        importance: task.importance || 'medium',
        urgency: task.urgency || 'medium',
        estimatedTime: task.estimatedTime || '',
        energyNeeded: task.energyNeeded || 'medium',
        status: task.status || 'caixa_de_entrada',
        nextAction: task.nextAction || '',
        notes: task.notes || ''
      });
    }
  }, [task]);

  const validate = () => {
    const newErrors = {};
    if (!formData.title.trim()) newErrors.title = 'Título é obrigatório';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    onSubmit({
      ...formData,
      estimatedTime: formData.estimatedTime ? parseInt(formData.estimatedTime) : null
    });
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: undefined }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="title">Título *</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => handleChange('title', e.target.value)}
          placeholder="O que precisa ser feito?"
        />
        {errors.title && <p className="text-sm text-destructive">{errors.title}</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Projeto/Cliente</Label>
          <Select value={formData.project} onValueChange={(v) => handleChange('project', v)}>
            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>
              {projects.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Tipo</Label>
          <Select value={formData.type} onValueChange={(v) => handleChange('type', v)}>
            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>
              {taskTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Prazo</Label>
          <Input
            type="date"
            value={formData.deadline}
            onChange={(e) => handleChange('deadline', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Tempo estimado (min)</Label>
          <Input
            type="number"
            value={formData.estimatedTime}
            onChange={(e) => handleChange('estimatedTime', e.target.value)}
            placeholder="Ex: 30"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Status</Label>
        <Select value={formData.status} onValueChange={(v) => handleChange('status', v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {statuses.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-2 pt-4">
        <Button type="submit" className="flex-1">
          {task ? 'Atualizar Tarefa' : 'Criar Tarefa'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
