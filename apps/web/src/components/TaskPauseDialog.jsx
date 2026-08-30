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
  description = 'Tudo bem parar. Deixe uma frase para você saber como continuar depois.'
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
          <p className="text-sm font-medium">Você parou aqui</p>
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Ex.: Já configurei o formulário. Falta testar o envio do e-mail."
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
