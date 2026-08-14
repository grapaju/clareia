
import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Inbox, NotebookText, ListTodo, ArrowRight, Pencil, Trash2, Check } from 'lucide-react';
import Header from '@/components/Header.jsx';
import Sidebar from '@/components/Sidebar.jsx';
import MobileNav from '@/components/MobileNav.jsx';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
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
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext.jsx';
import {
  formatNoteDateTime,
  listUnsortedNotes,
  removeUnsortedNote,
  subscribeToUnsortedNotes,
  updateUnsortedNote
} from '@/lib/unsortedNotesStorage.js';
import { toast } from 'sonner';

export default function InboxPage() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { tasks } = useTaskContext();
  const [notes, setNotes] = useState([]);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editingContent, setEditingContent] = useState('');
  const [noteToDelete, setNoteToDelete] = useState(null);

  useEffect(() => {
    const sync = () => {
      setNotes(listUnsortedNotes(currentUser?.id, 'pendente'));
    };

    sync();
    const unsubscribe = subscribeToUnsortedNotes(sync);

    return unsubscribe;
  }, [currentUser?.id]);

  const startEdit = (note) => {
    setEditingNoteId(note.id);
    setEditingContent(note.content);
  };

  const cancelEdit = () => {
    setEditingNoteId(null);
    setEditingContent('');
  };

  const saveEdit = (noteId) => {
    if (!editingContent.trim()) return;
    const updated = updateUnsortedNote(noteId, { content: editingContent }, currentUser?.id);
    if (updated) {
      toast.success('Anotação atualizada.');
      cancelEdit();
    } else {
      toast.error('Não foi possível atualizar a anotação.');
    }
  };

  const deleteNote = (noteId) => {
    setNoteToDelete(noteId);
  };

  const confirmDeleteNote = () => {
    if (!noteToDelete) return;
    const removed = removeUnsortedNote(noteToDelete, currentUser?.id);
    if (removed) {
      toast.success('Anotação excluída.');
      if (editingNoteId === noteToDelete) {
        cancelEdit();
      }
      setNoteToDelete(null);
    } else {
      toast.error('Não foi possível excluir a anotação.');
    }
  };

  const unorganizedTasks = useMemo(() => {
    return tasks.filter((task) => {
      const isBacklog = task.status === 'Backlog';
      const isLikelyUnclassified = task.taskType === 'Administrativo' && (!task.project || task.project === 'Pessoal');
      return isBacklog || isLikelyUnclassified;
    });
  }, [tasks]);

  return (
    <>
      <Helmet>
        <title>Caixa de entrada - Clareia</title>
      </Helmet>
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 pb-20 md:pb-8">
            <div className="page-container section-spacing max-w-2xl">
              
              <div className="mb-10 text-center md:text-left">
                <div className="flex items-center justify-center md:justify-start gap-3 mb-3">
                  <Inbox className="w-8 h-8 text-primary" />
                  <h1 className="text-3xl font-medium text-foreground">
                    Caixa de entrada
                  </h1>
                </div>
                <p className="text-lg text-muted-foreground">
                  Registros ainda não organizados. Use Descarregar mente para estruturar ideias, soluções, acessos e referências dos seus projetos.
                </p>
              </div>

              <Card className="bg-card border-border shadow-sm mb-6">
                <CardContent className="p-6 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Entrada principal</p>
                    <p className="text-foreground font-medium">Descarregar mente</p>
                  </div>
                  <Button onClick={() => navigate('/descarregar-mente')} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                    Abrir
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card className="bg-card border-border shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <NotebookText className="w-5 h-5 text-primary" />
                      <h2 className="text-lg font-medium text-foreground">Anotações capturadas</h2>
                    </div>
                    {notes.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhuma anotação capturada por enquanto.</p>
                    ) : (
                      <ul className="space-y-3">
                        {notes.map((note) => {
                          const isEditing = editingNoteId === note.id;

                          return (
                            <li key={note.id} className="rounded-xl border border-border bg-muted/20 p-4">
                              {isEditing ? (
                                <Textarea
                                  value={editingContent}
                                  onChange={(event) => setEditingContent(event.target.value)}
                                  className="min-h-[100px] bg-background"
                                />
                              ) : (
                                <p className="text-sm text-foreground whitespace-pre-wrap">{note.content}</p>
                              )}

                              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                                <span>Salva em: {formatNoteDateTime(note.createdAt)}</span>
                                <span>Status: {note.status}</span>
                              </div>

                              <div className="mt-3 flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-border text-foreground hover:bg-muted"
                                  onClick={() => navigate('/descarregar-mente', { state: { prefillText: note.content } })}
                                >
                                  Organizar no Descarregar mente
                                </Button>

                                {isEditing ? (
                                  <>
                                    <Button size="sm" onClick={() => saveEdit(note.id)} disabled={!editingContent.trim()}>
                                      <Check className="w-4 h-4 mr-2" />
                                      Salvar edição
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={cancelEdit} className="border-border">
                                      Cancelar
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    <Button size="sm" variant="outline" onClick={() => startEdit(note)} className="border-border">
                                      <Pencil className="w-4 h-4 mr-2" />
                                      Editar
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => deleteNote(note.id)} className="border-border text-destructive hover:text-destructive">
                                      <Trash2 className="w-4 h-4 mr-2" />
                                      Excluir
                                    </Button>
                                  </>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-card border-border shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <ListTodo className="w-5 h-5 text-primary" />
                      <h2 className="text-lg font-medium text-foreground">Tarefas não classificadas</h2>
                    </div>
                    {unorganizedTasks.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Sem tarefas para classificar no momento.</p>
                    ) : (
                      <ul className="space-y-3">
                        {unorganizedTasks.slice(0, 12).map((task) => (
                          <li key={task.id} className="rounded-xl border border-border bg-muted/20 p-4">
                            <p className="text-sm font-medium text-foreground mb-1">{task.title}</p>
                            <p className="text-xs text-muted-foreground">
                              Projeto: {task.project || 'Pessoal'} · Tipo: {task.taskType || 'Administrativo'}
                            </p>
                            <div className="mt-3">
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-border text-foreground hover:bg-muted"
                                onClick={() => navigate('/descarregar-mente', { state: { prefillText: task.title } })}
                              >
                                Reorganizar
                              </Button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              </div>

            </div>
          </main>
        </div>
        <MobileNav />

        <AlertDialog open={Boolean(noteToDelete)} onOpenChange={(open) => !open && setNoteToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir anotação</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação remove a anotação permanentemente da caixa de entrada.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDeleteNote} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </>
  );
}
