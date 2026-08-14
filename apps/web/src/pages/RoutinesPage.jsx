import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Play, PauseCircle, Clock3, Pencil, Trash2, CalendarDays } from 'lucide-react';
import Header from '@/components/Header.jsx';
import Sidebar from '@/components/Sidebar.jsx';
import MobileNav from '@/components/MobileNav.jsx';
import EditTaskModal from '@/components/EditTaskModal.jsx';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import { useTaskContext } from '@/hooks/useTaskContext.js';
import { getNextRecurringDate, getStatusForScheduledDate } from '@/lib/recurrenceLogic.js';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

function toIsoDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString().split('T')[0];
}

function toDisplayDate(value) {
  const iso = toIsoDate(value);
  if (!iso) return '-';
  return new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR');
}

function routineSignature(task) {
  return `${task.title || ''}::${task.project || ''}::${task.taskType || ''}::${task.recurrenceFrequency || ''}`;
}

export default function RoutinesPage() {
  const navigate = useNavigate();
  const { tasks, updateTask, deleteTask, setSelectedTask } = useTaskContext();

  const [editTask, setEditTask] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const routines = useMemo(() => {
    return tasks
      .filter((task) => ['Semanal', 'Mensal'].includes(task.recurrenceFrequency))
      .filter((task) => {
        const status = (task.status || '').toString().toLowerCase();
        return status !== 'concluída' && status !== 'concluida' && status !== 'concluido';
      })
      .sort((a, b) => {
        const aDate = new Date(`${toIsoDate(a.scheduledDate || a.dataSugeridaExecucao) || '2999-12-31'}T12:00:00`).getTime();
        const bDate = new Date(`${toIsoDate(b.scheduledDate || b.dataSugeridaExecucao) || '2999-12-31'}T12:00:00`).getTime();
        return aDate - bDate;
      });
  }, [tasks]);

  const lastRunMap = useMemo(() => {
    const map = new Map();

    tasks.forEach((task) => {
      const status = (task.status || '').toString().toLowerCase();
      if (!(status === 'concluída' || status === 'concluida' || status === 'concluido')) return;
      const key = routineSignature(task);
      const completedAt = task.completedAt || task.updated || task.updatedAt || task.created || task.createdAt;
      const existing = map.get(key);
      if (!existing || new Date(completedAt).getTime() > new Date(existing).getTime()) {
        map.set(key, completedAt);
      }
    });

    return map;
  }, [tasks]);

  const handleExecuteNow = async (task) => {
    const todayIso = new Date().toISOString().split('T')[0];
    try {
      await updateTask(task.id, {
        scheduledDate: todayIso,
        dataSugeridaExecucao: todayIso,
        status: 'Hoje'
      });
      toast.success('Rotina enviada para Hoje.');
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível executar agora.');
    }
  };

  const handleDefer = async (task) => {
    try {
      const nextDate = getNextRecurringDate(task);
      if (!nextDate) {
        toast.error('Não foi possível calcular a próxima data.');
        return;
      }

      await updateTask(task.id, {
        scheduledDate: nextDate,
        dataSugeridaExecucao: nextDate,
        status: getStatusForScheduledDate(nextDate),
        recurrenceAnchorDate: nextDate
      });
      toast.success('Rotina adiada com sucesso.');
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível adiar a rotina.');
    }
  };

  const handlePause = async (task) => {
    try {
      await updateTask(task.id, {
        recurrenceFrequency: 'Nenhuma',
        status: 'Backlog'
      });
      toast.success('Recorrência pausada.');
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível pausar a recorrência.');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget?.id) return;
    try {
      await deleteTask(deleteTarget.id);
      toast.success('Rotina excluída.');
      setDeleteTarget(null);
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível excluir a rotina.');
    }
  };

  return (
    <>
      <Helmet><title>Rotinas - Clareia</title></Helmet>
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 pb-20 md:pb-8">
            <div className="page-container section-spacing max-w-5xl">
              <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h1 className="text-3xl md:text-4xl font-medium text-foreground mb-2">Rotinas</h1>
                  <p className="text-muted-foreground">Gerencie recorrências sem poluir a tela Hoje.</p>
                </div>
                <Button variant="outline" onClick={() => navigate('/')}>Voltar para Hoje</Button>
              </div>

              {routines.length === 0 ? (
                <Card className="bg-card border-border">
                  <CardContent className="p-8 text-center text-muted-foreground">
                    Nenhuma rotina ativa encontrada.
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {routines.map((task) => {
                    const signature = routineSignature(task);
                    const lastRun = lastRunMap.get(signature);
                    const nextRun = task.scheduledDate || task.dataSugeridaExecucao;

                    return (
                      <Card key={task.id} className="bg-card border-border">
                        <CardContent className="p-5">
                          <div className="flex flex-col gap-3">
                            <h2 className="text-lg font-medium text-foreground">{task.title}</h2>
                            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                              <span className="px-2 py-1 rounded-full border border-border">Projeto: {task.project || 'Pessoal'}</span>
                              <span className="px-2 py-1 rounded-full border border-border">Frequência: {task.recurrenceFrequency || 'Nenhuma'}</span>
                              <span className="px-2 py-1 rounded-full border border-border"><CalendarDays className="w-3 h-3 inline mr-1" />Próxima: {toDisplayDate(nextRun)}</span>
                              <span className="px-2 py-1 rounded-full border border-border">Última: {toDisplayDate(lastRun)}</span>
                              <span className="px-2 py-1 rounded-full border border-border"><Clock3 className="w-3 h-3 inline mr-1" />{task.timeEstimate || 30} min</span>
                              <span className="px-2 py-1 rounded-full border border-border">Status: Ativa</span>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <Button size="sm" onClick={() => handleExecuteNow(task)}><Play className="w-4 h-4 mr-1" />Executar agora</Button>
                              <Button size="sm" variant="outline" onClick={() => handleDefer(task)}>Adiar</Button>
                              <Button size="sm" variant="outline" onClick={() => handlePause(task)}><PauseCircle className="w-4 h-4 mr-1" />Pausar recorrência</Button>
                              <Button size="sm" variant="outline" onClick={() => setEditTask(task)}><Pencil className="w-4 h-4 mr-1" />Editar</Button>
                              <Button size="sm" variant="outline" className="text-destructive" onClick={() => setDeleteTarget(task)}><Trash2 className="w-4 h-4 mr-1" />Excluir</Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </main>
        </div>
        <MobileNav />

        {editTask && (
          <EditTaskModal
            task={editTask}
            isOpen={!!editTask}
            onClose={() => setEditTask(null)}
          />
        )}

        <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir rotina?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação remove a tarefa recorrente atual.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </>
  );
}
