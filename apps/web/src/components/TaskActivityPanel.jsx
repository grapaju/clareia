import React, { useEffect, useState } from 'react';
import { Clock3, NotebookPen, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useTaskContext } from '@/hooks/useTaskContext.js';
import { toast } from 'sonner';

function formatDuration(seconds = 0) {
  const minutes = Math.max(0, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}min`;
}

function formatDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

export default function TaskActivityPanel({ taskId }) {
  const { addTaskNote, getFocusSessions, getTaskNotes } = useTaskContext();
  const [notes, setNotes] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const loadActivity = async () => {
    if (!taskId) return;

    try {
      const [taskNotes, focusSessions] = await Promise.all([
        getTaskNotes(taskId),
        getFocusSessions(taskId)
      ]);
      setNotes(taskNotes);
      setSessions(focusSessions);
    } catch (error) {
      console.error('Erro ao carregar histórico da tarefa:', error);
    }
  };

  useEffect(() => {
    loadActivity();
  }, [taskId]);

  const handleAddNote = async () => {
    const trimmedContent = content.trim();
    if (!trimmedContent || !taskId) return;

    setIsSaving(true);
    try {
      const note = await addTaskNote(taskId, trimmedContent);
      setNotes((currentNotes) => [note, ...currentNotes]);
      setContent('');
      toast.success('Nota de trabalho salva.');
    } catch (error) {
      console.error('Erro ao salvar nota:', error);
      toast.error('Não foi possível salvar a nota.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="space-y-4 border-t border-border pt-5">
      <div className="flex items-center gap-2">
        <NotebookPen className="h-5 w-5 text-primary" />
        <h4 className="font-medium text-foreground">Contexto de trabalho</h4>
      </div>

      <div className="space-y-2">
        <Textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Registre o que mudou, um bloqueio ou como retomar depois."
          className="min-h-24 bg-background"
        />
        <Button size="sm" onClick={handleAddNote} disabled={!content.trim() || isSaving}>
          <Plus className="mr-2 h-4 w-4" />
          Salvar nota
        </Button>
      </div>

      {notes.length > 0 && (
        <div className="space-y-2">
          {notes.slice(0, 4).map((note) => (
            <div key={note.id} className="border-l-2 border-primary/30 py-1 pl-3">
              <p className="whitespace-pre-wrap text-sm text-foreground">{note.content}</p>
              <p className="mt-1 text-xs text-muted-foreground">{formatDate(note.created)}</p>
            </div>
          ))}
        </div>
      )}

      {sessions.length > 0 && (
        <div className="rounded-lg border border-border bg-muted/20 p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
            <Clock3 className="h-4 w-4 text-primary" />
            Blocos registrados
          </div>
          <div className="space-y-2">
            {sessions.slice(0, 3).map((session) => (
              <div key={session.id} className="flex items-start justify-between gap-3 text-sm">
                <div>
                  <p className="text-foreground">{session.result || session.endReason || 'Sessão de foco'}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(session.created)}</p>
                </div>
                <span className="shrink-0 font-medium text-foreground">{formatDuration(session.durationSeconds)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}