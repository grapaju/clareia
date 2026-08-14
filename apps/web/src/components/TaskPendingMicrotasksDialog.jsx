import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';

export default function TaskPendingMicrotasksDialog({
  isOpen,
  onOpenChange,
  pendingData,
  onPause,
  onBack,
  onMarkRemaining,
  onForceComplete,
  isSubmitting = false
}) {
  const [isForceConfirmOpen, setIsForceConfirmOpen] = useState(false);

  const completed = Number(pendingData?.completedMicrotasks || 0);
  const pending = Number(pendingData?.pendingMicrotasks || 0);
  const nextPending = pendingData?.nextPendingMicrotask?.title || pendingData?.nextPendingMicrotask?.descricao || 'Sem próxima microtarefa definida';

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="w-[min(680px,calc(100vw-32px))] max-w-[680px] p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>Ainda falta concluir alguns passos</DialogTitle>
            <DialogDescription>
              Essa tarefa ainda tem microtarefas pendentes. Para não perder onde você parou, o Clareia pode pausar a tarefa e deixar tudo salvo para continuar depois.
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 py-4">
            <div className="space-y-2 rounded-lg border border-border p-3 text-sm">
              <p><span className="font-medium">Concluídas:</span> {completed}</p>
              <p><span className="font-medium">Pendentes:</span> {pending}</p>
              <p><span className="font-medium">Próxima microtarefa:</span> {nextPending}</p>
            </div>
          </div>

          <div className="pt-4 pb-6 px-6 flex flex-col md:flex-row md:flex-wrap md:justify-end gap-3">
            <Button className="w-full md:w-auto md:max-w-full whitespace-normal" onClick={onPause} disabled={isSubmitting}>
              Pausar e continuar depois
            </Button>
            <Button className="w-full md:w-auto md:max-w-full whitespace-normal" variant="outline" onClick={onBack} disabled={isSubmitting}>
              Voltar para a tarefa
            </Button>
            <Button className="w-full md:w-auto md:max-w-full whitespace-normal" variant="outline" onClick={onMarkRemaining} disabled={isSubmitting}>
              Marcar restantes como feitas
            </Button>
            <Button
              className="w-full md:w-auto md:max-w-full whitespace-normal border-amber-300 text-amber-800 hover:bg-amber-50"
              variant="outline"
              onClick={() => setIsForceConfirmOpen(true)}
              disabled={isSubmitting}
            >
              Concluir mesmo assim
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isForceConfirmOpen} onOpenChange={setIsForceConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar conclusão manual</AlertDialogTitle>
            <AlertDialogDescription>
              Essa tarefa ainda tem microtarefas pendentes. Tem certeza que deseja concluir?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await onForceComplete?.();
                setIsForceConfirmOpen(false);
              }}
            >
              Concluir mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
