import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { suggestSmallerSteps } from '@/lib/microtaskRules.js';

export default function SmallerStepDialog({ task, open, onOpenChange, onApply }) {
  const steps = useMemo(() => suggestSmallerSteps(task), [task]);
  const [selectedStep, setSelectedStep] = useState('');
  const activeStep = selectedStep || steps[0] || '';

  const applyStep = async () => {
    if (!activeStep) return;
    await onApply(activeStep);
    toast.success(`Primeiro passo atualizado: ${activeStep}`, {
      action: {
        label: 'Desfazer',
        onClick: () => onApply(task?.nextAction || ''),
      },
    });
    setSelectedStep('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Encontrar um passo menor</DialogTitle>
          <DialogDescription>Escolha apenas o começo. A tarefa continua a mesma.</DialogDescription>
        </DialogHeader>
        <RadioGroup value={activeStep} onValueChange={setSelectedStep} className="space-y-2">
          {steps.map((step) => (
            <label key={step} className="flex min-h-11 items-start gap-3 rounded-md border border-border p-3">
              <RadioGroupItem value={step} />
              <span className="text-sm">{step}</span>
            </label>
          ))}
        </RadioGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={applyStep} disabled={!activeStep}>Usar como primeiro passo</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
