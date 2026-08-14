
import React, { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { normalizeMicrotasks } from '@/lib/taskExecution.js';

export default function MicrotaskList({ microtasks = [], onToggle, taskType, highlightMicrotaskId = '' }) {
  const [isOpen, setIsOpen] = useState(true);
  const normalized = normalizeMicrotasks(microtasks);

  if (!normalized || normalized.length === 0) return null;

  const completedCount = normalized.filter((m) => m.completed).length;
  const progress = Math.round((completedCount / normalized.length) * 100);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border border-border rounded-xl bg-card overflow-hidden transition-all duration-300">
      <div className="bg-muted/40 px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors">
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            Passos sugeridos {taskType ? `para ${taskType.toLowerCase()}` : ''}
          </CollapsibleTrigger>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-background border border-border text-muted-foreground">
            {completedCount}/{normalized.length}
          </span>
        </div>
        {progress === 100 && <CheckCircle2 className="w-4 h-4 text-green-500 animate-in zoom-in" />}
      </div>
      
      <CollapsibleContent className="p-2 animate-in fade-in slide-in-from-top-2 duration-300">
        <div className="space-y-1">
          {normalized.map((mt) => {
            const isCompleted = mt.completed;
            const isHighlighted = !isCompleted && highlightMicrotaskId && mt.id === highlightMicrotaskId;
            return (
              <div 
                key={mt.id} 
                className={`flex items-start gap-3 p-2.5 rounded-lg transition-colors duration-200 ${isCompleted ? 'opacity-60 bg-muted/30' : 'hover:bg-muted/50'} ${isHighlighted ? 'border border-primary/40 bg-primary/5' : ''}`}
              >
                <Checkbox 
                  id={mt.id} 
                  checked={isCompleted}
                  onCheckedChange={(checked) => onToggle(mt.id, checked)}
                  className="mt-0.5 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                />
                <Label 
                  htmlFor={mt.id} 
                  className={`text-sm cursor-pointer leading-tight transition-all duration-300 ${isCompleted ? 'line-through text-muted-foreground' : 'text-foreground'}`}
                >
                  {mt.title || mt.descricao}
                </Label>
              </div>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
