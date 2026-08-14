
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { X, Plus } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { normalizeMicrotasks } from '@/lib/taskExecution.js';

export default function MicrotaskEditor({ microtasks = [], onChange }) {
  const [newMicrotask, setNewMicrotask] = useState('');
  const normalized = normalizeMicrotasks(microtasks);

  const handleAdd = () => {
    if (!newMicrotask.trim()) return;
    const newTask = {
      id: Date.now().toString(),
      taskId: '',
      title: newMicrotask,
      completed: false,
      completedAt: null,
      orderIndex: normalized.length,
      descricao: newMicrotask,
      status: 'não iniciada'
    };
    onChange([...normalized, newTask]);
    setNewMicrotask('');
  };

  const handleToggle = (index) => {
    const updated = [...normalized];
    const checked = !updated[index].completed;
    updated[index] = {
      ...updated[index],
      completed: checked,
      completedAt: checked ? new Date().toISOString() : null,
      status: checked ? 'concluída' : 'não iniciada'
    };
    onChange(updated);
  };

  const handleTextChange = (index, value) => {
    const updated = [...normalized];
    updated[index] = {
      ...updated[index],
      title: value,
      descricao: value
    };
    onChange(updated);
  };

  const handleRemove = (index) => {
    const updated = normalized.filter((_, i) => i !== index).map((item, orderIndex) => ({ ...item, orderIndex }));
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      <Label className="text-foreground font-semibold">Microtarefas</Label>
      <div className="space-y-3">
        {normalized.map((task, index) => (
          <div key={task.id || index} className="flex items-center gap-3">
            <Checkbox 
              checked={task.completed} 
              onCheckedChange={() => handleToggle(index)} 
            />
            <Input 
              value={task.title || task.descricao} 
              onChange={(e) => handleTextChange(index, e.target.value)} 
              className={`flex-1 h-9 bg-card text-foreground ${task.completed ? 'line-through text-muted-foreground' : ''}`}
            />
            <Button 
              type="button" 
              variant="ghost" 
              size="icon" 
              onClick={() => handleRemove(index)}
              className="text-muted-foreground hover:text-destructive shrink-0 h-9 w-9"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        ))}
        {normalized.length === 0 && (
          <p className="text-sm text-muted-foreground italic">Nenhuma microtarefa adicionada.</p>
        )}
      </div>
      
      <div className="flex gap-2">
        <Input 
          value={newMicrotask} 
          onChange={(e) => setNewMicrotask(e.target.value)} 
          placeholder="Adicionar microtarefa..." 
          className="h-10 bg-card text-foreground"
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
        />
        <Button type="button" onClick={handleAdd} className="h-10 shrink-0">
          <Plus className="w-4 h-4 mr-1" /> Adicionar
        </Button>
      </div>
    </div>
  );
}
