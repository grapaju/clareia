import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getActiveWorkSession } from '@/services/workSessionService.js';

export default function TaskCompletionDialog({
  isOpen,
  onOpenChange,
  task,
  onConfirm,
  isSubmitting = false
}) {
  const [mode, setMode] = useState('none');
  const [customMinutes, setCustomMinutes] = useState(30);

  useEffect(() => {
    if (!isOpen) return;
    setMode('none');
    setCustomMinutes(Number(task?.timeEstimate || 30));
  }, [isOpen, task?.id, task?.timeEstimate]);

  const activeSessionForTask = useMemo(() => {
    const active = getActiveWorkSession();
    return Boolean(active?.id && task?.id && active.taskId === task.id);
  }, [task?.id, isOpen]);

  const activeSessionMinutes = useMemo(() => {
    const active = getActiveWorkSession();
    if (!activeSessionForTask || !active?.startedAt) return 0;
    return Math.max(1, Math.round((Date.now() - new Date(active.startedAt).getTime()) / 60000));
  }, [activeSessionForTask, isOpen]);

  const handleConfirm = () => {
    onConfirm?.({
      timeMode: activeSessionForTask ? 'active_session' : mode,
      customMinutes: Number(customMinutes || 0)
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{activeSessionForTask ? `Concluir tarefa e registrar ${activeSessionMinutes} min?` : 'Concluir tarefa?'}</DialogTitle>
          <DialogDescription>
            {activeSessionForTask
              ? 'O tempo real da sessão ativa será salvo no Histórico e nos Relatórios.'
              : 'Você pode informar o tempo realizado ou concluir sem registrar tempo.'}
          </DialogDescription>
        </DialogHeader>

        {!activeSessionForTask && (
          <div className="space-y-3">
            <button
              type="button"
              className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${mode === 'custom' ? 'border-primary bg-primary/10 text-primary' : 'border-border'}`}
              onClick={() => setMode('custom')}
            >
              Informar outro tempo
            </button>

            {mode === 'custom' && (
              <div className="space-y-2 rounded-lg border border-border p-3">
                <Label htmlFor="custom-duration">Duração (min)</Label>
                <Input
                  id="custom-duration"
                  type="number"
                  min={1}
                  value={customMinutes}
                  onChange={(event) => setCustomMinutes(event.target.value)}
                />
              </div>
            )}

            <button
              type="button"
              className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${mode === 'none' ? 'border-primary bg-primary/10 text-primary' : 'border-border'}`}
              onClick={() => setMode('none')}
            >
              Concluir sem registrar
            </button>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {activeSessionForTask ? 'Continuar trabalhando' : 'Cancelar'}
          </Button>
          <Button onClick={handleConfirm} disabled={isSubmitting || (mode === 'custom' && Number(customMinutes || 0) <= 0)}>
            Concluir tarefa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
