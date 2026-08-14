import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export default function TaskPauseDialog({
  isOpen,
  onOpenChange,
  defaultValue = '',
  onConfirm,
  isSubmitting = false,
  title = 'Pausar tarefa',
  description = 'Adicione uma nota opcional sobre onde você parou.'
}) {
  const [note, setNote] = useState(defaultValue);

  useEffect(() => {
    if (!isOpen) return;
    setNote(defaultValue || '');
  }, [defaultValue, isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <p className="text-sm font-medium">Onde parei?</p>
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Ex.: Aplicação localizada no servidor. Falta testar login."
            className="min-h-24"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancelar</Button>
          <Button
            onClick={async () => {
              await onConfirm?.(note.trim());
              onOpenChange(false);
            }}
            disabled={isSubmitting}
          >
            Pausar e continuar depois
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
