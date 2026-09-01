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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { getTaskMicrotaskProgress } from '@/lib/taskExecution.js';

function toLocalIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function TaskPauseDialog({
  isOpen,
  onOpenChange,
  defaultValue = '',
  task = null,
  onConfirm,
  isSubmitting = false,
  title = 'Pausar tarefa',
  description = 'Tudo bem parar. Deixe uma frase para você saber como continuar depois.'
}) {
  const [note, setNote] = useState(defaultValue);
  const [resumeOption, setResumeOption] = useState('none');
  const [customDate, setCustomDate] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const nextStep = getTaskMicrotaskProgress(task).nextPending?.title || task?.nextAction || '';
    setNote(defaultValue || nextStep);
    setResumeOption('none');
    setCustomDate('');
  }, [defaultValue, isOpen, task]);

  const getResumeDate = () => {
    if (resumeOption === 'today') return toLocalIsoDate(new Date());
    if (resumeOption === 'tomorrow') {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      return toLocalIsoDate(tomorrow);
    }
    return resumeOption === 'date' ? customDate : '';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <p className="text-sm font-medium">Onde você parou?</p>
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Ex.: Já configurei o formulário. Falta testar o envio do e-mail."
            className="min-h-24"
          />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Quando pretende retomar?</p>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant={resumeOption === 'today' ? 'default' : 'outline'} onClick={() => setResumeOption('today')}>Mais tarde hoje</Button>
            <Button type="button" variant={resumeOption === 'tomorrow' ? 'default' : 'outline'} onClick={() => setResumeOption('tomorrow')}>Amanhã</Button>
            <Button type="button" variant={resumeOption === 'date' ? 'default' : 'outline'} onClick={() => setResumeOption('date')}>Escolher data</Button>
            <Button type="button" variant={resumeOption === 'none' ? 'default' : 'outline'} onClick={() => setResumeOption('none')}>Apenas pausar</Button>
          </div>
          {resumeOption === 'date' && <Input type="date" min={toLocalIsoDate(new Date())} value={customDate} onChange={(event) => setCustomDate(event.target.value)} aria-label="Data para retomar" />}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancelar</Button>
          <Button
            onClick={async () => {
              await onConfirm?.(note.trim(), { resumeSuggestedDate: getResumeDate() || null });
              onOpenChange(false);
            }}
            disabled={isSubmitting || (resumeOption === 'date' && !customDate)}
          >
            Pausar e continuar depois
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
