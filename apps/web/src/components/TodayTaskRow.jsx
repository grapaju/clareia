import React from 'react';
import { CheckCircle2, MoreHorizontal, Pencil, Play, RotateCcw, Trash2, Archive, Clock3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { getTaskRowMetadata } from '@/lib/todayViewLogic.js';
import { normalizeTaskStatus, TASK_STATUS } from '@/lib/taskExecution.js';

export default function TodayTaskRow({ task, isRecommended = false, completed = false, workedMinutes = 0, onStart, onOpen, onEdit, onComplete, onReopen, onWaiting, onArchive, onDelete }) {
  const metadata = getTaskRowMetadata(task);
  const status = normalizeTaskStatus(task.status);
  const isPaused = status === TASK_STATUS.PAUSADA;

  return (
    <li className="group flex min-h-14 items-center gap-3 border-b border-border/70 px-3 py-2.5 last:border-b-0">
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${completed ? 'bg-muted-foreground/50' : isRecommended ? 'bg-sky-400' : status === TASK_STATUS.EM_ANDAMENTO ? 'bg-primary' : 'border border-muted-foreground/50'}`} aria-hidden="true" />
      <button type="button" onClick={() => onOpen(task)} className="min-w-0 flex-1 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className={`block truncate text-sm font-medium ${completed ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{task.title}</span>
        <span className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
          <span>{task.project || 'Pessoal'}</span>
          {metadata.minutes > 0 && <span>{metadata.minutes} min</span>}
          <span className={metadata.situation === 'Atrasada' ? 'font-medium text-destructive' : ''}>{metadata.situation}</span>
          {metadata.isRoutine && <span>Rotina</span>}
          {(task.energiaNecessaria || task.energyLevel) && <span>{task.energiaNecessaria || task.energyLevel} energia</span>}
          {metadata.progress && <span>{metadata.progress} passos</span>}
          {completed && workedMinutes > 0 && <span>{workedMinutes} min realizados</span>}
          {isRecommended && <span className="font-medium text-sky-600">Sugerida agora</span>}
        </span>
      </button>
      {completed ? (
        <Button size="sm" variant="ghost" onClick={() => onReopen(task)}><RotateCcw className="mr-1.5 h-4 w-4" aria-hidden="true" /> Reabrir</Button>
      ) : (
        <>
          <Button size="sm" onClick={() => onStart(task)} className="shrink-0"><Play className="mr-1.5 h-4 w-4" aria-hidden="true" /> {isPaused ? 'Continuar' : 'Começar'}</Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="h-9 w-9 shrink-0" aria-label={`Mais ações para ${task.title}`}><MoreHorizontal className="h-4 w-4" aria-hidden="true" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(task)}><Pencil className="h-4 w-4" /> Editar</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onComplete(task)}><CheckCircle2 className="h-4 w-4" /> Concluir</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onWaiting(task)}><Clock3 className="h-4 w-4" /> Aguardar retorno</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onArchive(task)}><Archive className="h-4 w-4" /> Guardar para depois</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onDelete(task)} className="text-destructive focus:text-destructive"><Trash2 className="h-4 w-4" /> Excluir</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
    </li>
  );
}