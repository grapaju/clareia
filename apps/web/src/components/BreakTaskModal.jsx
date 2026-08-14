
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, Plus, GripVertical } from 'lucide-react';
import { suggestSubtasks } from '@/lib/autoSuggestions';

export default function BreakTaskModal({ task, onSave, onCancel }) {
  const [steps, setSteps] = useState([]);
  const [newStepText, setNewStepText] = useState('');
  const [newStepTime, setNewStepTime] = useState('');

  useEffect(() => {
    if (task.steps && task.steps.length > 0) {
      setSteps(task.steps);
    } else {
      const suggested = suggestSubtasks(task.title, task.timeEstimate || 60);
      setSteps(suggested.map((s, i) => ({ id: Date.now() + i, text: s.text, time: s.time })));
    }
  }, [task]);

  const handleAdd = () => {
    if (!newStepText.trim()) return;
    setSteps(prev => [...prev, { id: Date.now(), text: newStepText, time: newStepTime ? parseInt(newStepTime) : 15 }]);
    setNewStepText('');
    setNewStepTime('');
  };

  const removeStep = (id) => setSteps(prev => prev.filter(s => s.id !== id));

  return (
    <div className="space-y-6">
      <div className="bg-secondary/20 rounded-xl p-5 border border-secondary/30">
        <h4 className="font-semibold text-lg text-foreground mb-1">{task.title}</h4>
        <p className="text-muted-foreground">
          Dividir tarefas grandes diminui a sobrecarga. Abaixo estão algumas sugestões amigáveis.
        </p>
      </div>

      <div className="space-y-3">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center gap-3 bg-card border border-border rounded-lg p-3 group">
            <GripVertical className="w-5 h-5 text-muted-foreground/50 cursor-grab" />
            <span className="text-sm font-bold text-muted-foreground">{index + 1}.</span>
            <Input 
              value={step.text} 
              onChange={e => setSteps(prev => prev.map(s => s.id === step.id ? { ...s, text: e.target.value } : s))}
              className="flex-1 bg-transparent border-none shadow-none focus-visible:ring-1"
            />
            <div className="flex items-center gap-1 w-24">
              <Input 
                type="number" 
                value={step.time} 
                onChange={e => setSteps(prev => prev.map(s => s.id === step.id ? { ...s, time: parseInt(e.target.value) || 0 } : s))}
                className="text-right px-2"
              />
              <span className="text-xs text-muted-foreground">m</span>
            </div>
            <Button variant="ghost" size="icon" onClick={() => removeStep(step.id)} className="opacity-0 group-hover:opacity-100 text-destructive">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex gap-2 items-center bg-muted/50 p-3 rounded-lg border border-border border-dashed">
        <Input placeholder="Qual o próximo passinho?" value={newStepText} onChange={e => setNewStepText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdd()} />
        <Input type="number" placeholder="Min" value={newStepTime} onChange={e => setNewStepTime(e.target.value)} className="w-20" onKeyDown={e => e.key === 'Enter' && handleAdd()} />
        <Button onClick={handleAdd} size="icon" className="shrink-0"><Plus className="w-4 h-4" /></Button>
      </div>

      <div className="flex gap-3 pt-4 border-t border-border">
        <Button onClick={() => onSave({ ...task, steps })} className="flex-1">
          Salvar esses passos
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
