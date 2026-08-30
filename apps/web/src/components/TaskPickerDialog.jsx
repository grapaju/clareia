import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';

export default function TaskPickerDialog({ open, onOpenChange, tasks = [], onSelect, onViewAll }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Escolher outra tarefa</DialogTitle>
          <DialogDescription>A escolha muda somente a recomendação desta tela.</DialogDescription>
        </DialogHeader>
        <Command>
          <CommandInput placeholder="Buscar tarefa ou projeto..." />
          <CommandList className="max-h-[55vh]">
            <CommandEmpty>Nenhuma tarefa aberta encontrada.</CommandEmpty>
            {tasks.map((task) => (
              <CommandItem
                key={task.id}
                value={`${task.title} ${task.project || ''}`}
                onSelect={() => {
                  onSelect(task);
                  onOpenChange(false);
                }}
                className="flex-col items-start gap-1 py-3"
              >
                <span className="font-medium">{task.title}</span>
                <span className="text-xs text-muted-foreground">
                  {task.project || 'Sem projeto'} · {task.timeEstimate || 30} min · {task.energiaNecessaria || 'Média'} energia{task.dueDate ? ` · prazo ${task.dueDate}` : ''}
                </span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
        <button type="button" className="text-left text-sm text-primary hover:underline" onClick={onViewAll}>Ver todas</button>
      </DialogContent>
    </Dialog>
  );
}
