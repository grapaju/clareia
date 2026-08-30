import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { Bookmark, Check, Lightbulb, ListTodo, NotebookPen, Plus, Search, Sparkles, Trash2 } from 'lucide-react';
import Header from '@/components/Header.jsx';
import Sidebar from '@/components/Sidebar.jsx';
import MobileNav from '@/components/MobileNav.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useTaskContext } from '@/hooks/useTaskContext.js';
import apiClient, { getCurrentAccountId } from '@/lib/apiClient.js';
import { toast } from 'sonner';
import { listUnsortedNotes, removeUnsortedNote } from '@/lib/unsortedNotesStorage.js';
import { parseUnloadMindToPlan } from '@/lib/unloadMindLogic.js';

const NOTE_TYPES = ['Solução', 'Ideia', 'Decisão', 'Acesso', 'Referência', 'Reunião', 'Geral'];
const ALL_TYPES = 'todos';
const ALL_PROJECTS = 'todos';

function formatDate(value) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function notePreview(content) {
  return content.replace(/\s+/g, ' ').trim();
}

export default function NotesPage() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { addTask } = useTaskContext();
  const userId = currentUser?.id || apiClient.authStore?.model?.id || '';
  const accountId = currentUser?.currentAccountId || getCurrentAccountId();
  const [notes, setNotes] = useState([]);
  const [selectedNoteId, setSelectedNoteId] = useState(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState(ALL_TYPES);
  const [projectFilter, setProjectFilter] = useState(ALL_PROJECTS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [quickCapture, setQuickCapture] = useState('');
  const [legacyDrafts, setLegacyDrafts] = useState([]);
  const [form, setForm] = useState({ titulo: '', conteudo: '', projeto: '', tipo: 'Geral', tags: '', fixada: false });
  const loadNotes = async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      const records = await apiClient.collection('anotacoes').getFullList({ sort: '-fixada,-updated', $autoCancel: false });
      setNotes(records);
    } catch (error) {
      console.error('Erro ao carregar notas:', error);
      toast.error('Não foi possível carregar suas notas.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadNotes();
    setLegacyDrafts(listUnsortedNotes(userId, 'pendente'));
  }, [userId]);

  const projects = useMemo(() => [...new Set(notes.map((note) => note.projeto).filter(Boolean))].sort(), [notes]);
  const filteredNotes = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('pt-BR');
    return notes.filter((note) => {
      const matchesType = typeFilter === ALL_TYPES || note.tipo === typeFilter;
      const matchesProject = projectFilter === ALL_PROJECTS || note.projeto === projectFilter;
      const searchable = `${note.titulo || ''} ${note.conteudo || ''} ${note.projeto || ''} ${note.tags || ''}`.toLocaleLowerCase('pt-BR');
      return matchesType && matchesProject && (!normalizedSearch || searchable.includes(normalizedSearch));
    });
  }, [notes, projectFilter, search, typeFilter]);

  const selectedNote = notes.find((note) => note.id === selectedNoteId) || null;

  const resetEditor = () => {
    setSelectedNoteId(null);
    setForm({ titulo: '', conteudo: '', projeto: '', tipo: 'Geral', tags: '', fixada: false });
  };

  const openNote = (note) => {
    setSelectedNoteId(note.id);
    setForm({
      titulo: note.titulo || '',
      conteudo: note.conteudo || '',
      projeto: note.projeto || '',
      tipo: note.tipo || 'Geral',
      tags: note.tags || '',
      fixada: Boolean(note.fixada)
    });
  };

  const updateForm = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const handleSave = async () => {
    if (!form.conteudo.trim()) {
      toast.error('Escreva o conteúdo da nota antes de salvar.');
      return;
    }

    setIsSaving(true);
    if (!userId) {
      setIsSaving(false);
      toast.error('Sua sessão não foi carregada. Faça login novamente.');
      return;
    }
    const payload = {
      userId,
      ...(accountId ? { accountId } : {}),
      titulo: form.titulo.trim(),
      conteudo: form.conteudo.trim(),
      projeto: form.projeto.trim(),
      tipo: form.tipo,
      tags: form.tags.trim(),
      fixada: form.fixada
    };

    try {
      const record = selectedNote
        ? await apiClient.collection('anotacoes').update(selectedNote.id, payload, { $autoCancel: false })
        : await apiClient.collection('anotacoes').create(payload, { $autoCancel: false });

      setNotes((currentNotes) => {
        const withoutSaved = currentNotes.filter((note) => note.id !== record.id);
        return [record, ...withoutSaved].sort((first, second) => Number(second.fixada) - Number(first.fixada));
      });
      setSelectedNoteId(record.id);
      toast.success(selectedNote ? 'Nota atualizada.' : 'Nota salva na biblioteca.');
    } catch (error) {
      console.error('Erro ao salvar nota:', error);
      toast.error('Não foi possível salvar a nota.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuickCapture = async () => {
    const content = quickCapture.trim();
    if (!content) return;

    setIsSaving(true);
    if (!userId) {
      setIsSaving(false);
      toast.error('Sua sessão não foi carregada. Faça login novamente.');
      return;
    }
    try {
      const record = await apiClient.collection('anotacoes').create({
        userId,
        ...(accountId ? { accountId } : {}),
        titulo: notePreview(content).slice(0, 90),
        conteudo: content,
        tipo: 'Geral',
        projeto: '',
        tags: '',
        fixada: false
      }, { $autoCancel: false });
      setNotes((currentNotes) => [record, ...currentNotes]);
      openNote(record);
      setQuickCapture('');
      toast.success('Anotação capturada. Organize quando fizer sentido.');
    } catch (error) {
      console.error('Erro ao capturar anotação:', error);
      toast.error('Não foi possível salvar a anotação.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleOrganizeCapture = async () => {
    const content = quickCapture.trim();
    if (!content) return;

    setIsSaving(true);
    if (!userId) {
      setIsSaving(false);
      toast.error('Sua sessão não foi carregada. Faça login novamente.');
      return;
    }
    try {
      const plan = parseUnloadMindToPlan(content);
      const record = await apiClient.collection('planosClareados').create({
        userId,
        ...(accountId ? { accountId } : {}),
        conteudoOriginal: content,
        planoGerado: {
          ...plan,
          meta: {
            status: 'pending',
            createdAt: new Date().toISOString()
          }
        }
      }, { $autoCancel: false });
      setQuickCapture('');
      navigate('/plano-clareado', { state: { planRecord: record } });
    } catch (error) {
      console.error('Erro ao organizar captura:', error);
      toast.error('Não foi possível organizar a captura em um plano.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleImportLegacyDrafts = async () => {
    if (legacyDrafts.length === 0) return;
    setIsSaving(true);
    if (!userId) {
      setIsSaving(false);
      toast.error('Sua sessão não foi carregada. Faça login novamente.');
      return;
    }
    try {
      const importedNotes = [];
      for (const draft of legacyDrafts) {
        const content = draft.content.trim();
        if (!content) continue;
        const record = await apiClient.collection('anotacoes').create({
          userId,
          ...(accountId ? { accountId } : {}),
          titulo: notePreview(content).slice(0, 90),
          conteudo: content,
          tipo: 'Geral',
          projeto: '',
          tags: 'rascunho importado',
          fixada: false
        }, { $autoCancel: false });
        importedNotes.push(record);
        removeUnsortedNote(draft.id, userId);
      }
      setNotes((currentNotes) => [...importedNotes, ...currentNotes]);
      setLegacyDrafts([]);
      toast.success(`${importedNotes.length} rascunho(s) movido(s) para Anotações.`);
    } catch (error) {
      console.error('Erro ao importar rascunhos:', error);
      toast.error('Não foi possível importar todos os rascunhos.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedNote) return;
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedNote) return;
    try {
      await apiClient.collection('anotacoes').delete(selectedNote.id, { $autoCancel: false });
      setNotes((currentNotes) => currentNotes.filter((note) => note.id !== selectedNote.id));
      resetEditor();
      setIsDeleteDialogOpen(false);
      toast.success('Nota excluída.');
    } catch (error) {
      console.error('Erro ao excluir nota:', error);
      toast.error('Não foi possível excluir a nota.');
    }
  };

  const handleCreateTask = async () => {
    if (!selectedNote) return;
    const title = (form.titulo || notePreview(form.conteudo).slice(0, 90)).trim();
    try {
      await addTask({
        title,
        project: form.projeto || 'Pessoal',
        taskType: 'Administrativo',
        nextAction: `Revisar a nota: ${title}`,
        description: form.conteudo,
        timeEstimate: 30,
        energiaNecessaria: 'Média',
        executionDifficulty: 'Direta',
        scheduledDate: new Date().toISOString().split('T')[0],
        scheduledPeriod: 'tarde',
        status: 'Hoje'
      });
      toast.success('Tarefa criada a partir da nota.');
    } catch (error) {
      console.error('Erro ao criar tarefa a partir da nota:', error);
    }
  };

  return (
    <>
      <Helmet><title>Descarregar mente - Clareia</title></Helmet>
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="min-w-0 flex-1 pb-20 md:pb-8">
            <div className="page-container section-spacing max-w-6xl">
              <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="mb-2 flex items-center gap-3">
                    <NotebookPen className="h-8 w-8 text-primary" />
                    <h1 className="text-3xl font-medium text-foreground">Descarregar mente</h1>
                  </div>
                  <p className="text-muted-foreground">Capture e organize anotações, ideias, soluções, acessos e links importantes dos seus projetos.</p>
                </div>
                <Button onClick={resetEditor} className="shrink-0">
                  <Plus className="mr-2 h-4 w-4" /> Nova nota
                </Button>
              </div>

              <section className="mb-8 border-l-2 border-primary/40 bg-card px-5 py-4 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
                  <div className="min-w-0 flex-1">
                    <Label htmlFor="quick-capture">Captura rápida</Label>
                    <Textarea
                      id="quick-capture"
                      value={quickCapture}
                      onChange={(event) => setQuickCapture(event.target.value)}
                      placeholder="Ex.: solução para erro no deploy, link da documentação, acesso da ferramenta do cliente, ideia para próxima sprint."
                      className="mt-2 min-h-24 bg-background"
                      autoFocus
                    />
                    <p className="mt-2 text-xs text-muted-foreground">Dica: use os tipos de nota (Solução, Ideia, Acesso, Referência) para facilitar busca e reutilização.</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button variant="outline" onClick={handleOrganizeCapture} disabled={!quickCapture.trim() || isSaving}>
                      <Sparkles className="mr-2 h-4 w-4" /> Organizar
                    </Button>
                    <Button onClick={handleQuickCapture} disabled={!quickCapture.trim() || isSaving}>
                      <Plus className="mr-2 h-4 w-4" /> Salvar na biblioteca
                    </Button>
                  </div>
                </div>
              </section>

              {legacyDrafts.length > 0 && (
                <section className="mb-8 flex flex-col gap-3 border border-border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-foreground">Há {legacyDrafts.length} rascunho{legacyDrafts.length === 1 ? '' : 's'} antigo{legacyDrafts.length === 1 ? '' : 's'} para trazer para esta biblioteca.</p>
                  <Button size="sm" variant="outline" onClick={handleImportLegacyDrafts} disabled={isSaving}>Importar rascunhos</Button>
                </section>
              )}

              <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
                <section className="min-w-0 space-y-4">
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px_180px]">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar em notas, tags e projetos" className="bg-card pl-9" />
                    </div>
                    <Select value={projectFilter} onValueChange={setProjectFilter}>
                      <SelectTrigger className="bg-card"><SelectValue placeholder="Projeto" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL_PROJECTS}>Todos os projetos</SelectItem>
                        {projects.map((project) => <SelectItem key={project} value={project}>{project}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                      <SelectTrigger className="bg-card"><SelectValue placeholder="Tipo" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL_TYPES}>Todos os tipos</SelectItem>
                        {NOTE_TYPES.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <p className="text-sm text-muted-foreground">{filteredNotes.length} nota{filteredNotes.length === 1 ? '' : 's'} encontrada{filteredNotes.length === 1 ? '' : 's'}</p>

                  {isLoading ? (
                    <p className="py-10 text-sm text-muted-foreground">Carregando notas...</p>
                  ) : filteredNotes.length === 0 ? (
                    <div className="border-y border-border py-12 text-center">
                      <Lightbulb className="mx-auto mb-3 h-8 w-8 text-primary/60" />
                      <p className="font-medium text-foreground">Sua biblioteca está pronta.</p>
                      <p className="mt-1 text-sm text-muted-foreground">Salve uma solução, ideia ou contexto de projeto para encontrá-lo depois.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border border-y border-border">
                      {filteredNotes.map((note) => (
                        <button key={note.id} type="button" onClick={() => openNote(note)} className="flex w-full min-w-0 items-start gap-3 py-4 text-left transition-colors hover:bg-muted/40">
                          <Bookmark className={`mt-0.5 h-4 w-4 shrink-0 ${note.fixada ? 'fill-primary text-primary' : 'text-muted-foreground'}`} />
                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 items-center gap-2">
                              <p className="truncate font-medium text-foreground">{note.titulo || 'Nota sem título'}</p>
                              {note.tipo && <span className="shrink-0 text-xs text-primary">{note.tipo}</span>}
                            </div>
                            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{notePreview(note.conteudo)}</p>
                            <p className="mt-2 text-xs text-muted-foreground">{note.projeto || 'Sem projeto'} · Atualizada em {formatDate(note.updated)}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </section>

                <section className="min-w-0 border border-border bg-card p-5 shadow-sm sm:p-6">
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <h2 className="font-medium text-foreground">{selectedNote ? 'Editar nota' : 'Nova nota'}</h2>
                    {selectedNote && <span className="text-xs text-muted-foreground">Atualizada em {formatDate(selectedNote.updated)}</span>}
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="note-title">Título</Label>
                      <Input id="note-title" value={form.titulo} onChange={(event) => updateForm('titulo', event.target.value)} placeholder="Ex.: Correção do formulário de contato" className="bg-background" />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="note-project">Projeto ou cliente</Label>
                        <Input id="note-project" value={form.projeto} onChange={(event) => updateForm('projeto', event.target.value)} placeholder="Ex.: Cliente X" className="bg-background" />
                      </div>
                      <div className="space-y-2">
                        <Label>Tipo</Label>
                        <Select value={form.tipo} onValueChange={(value) => updateForm('tipo', value)}>
                          <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                          <SelectContent>{NOTE_TYPES.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="note-content">Conteúdo *</Label>
                      <Textarea id="note-content" value={form.conteudo} onChange={(event) => updateForm('conteudo', event.target.value)} placeholder="Registre a solução, a decisão tomada, links e como retomar este assunto." className="min-h-56 bg-background" />
                      <p className="text-xs text-muted-foreground">Para senhas, registre somente a referência do cofre e o local de acesso.</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="note-tags">Tags</Label>
                      <Input id="note-tags" value={form.tags} onChange={(event) => updateForm('tags', event.target.value)} placeholder="Ex.: wordpress, formulário, produção" className="bg-background" />
                    </div>
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                      <input type="checkbox" checked={form.fixada} onChange={(event) => updateForm('fixada', event.target.checked)} className="h-4 w-4 accent-primary" />
                      Fixar para encontrar rápido
                    </label>
                    <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                      <Button onClick={handleSave} disabled={isSaving}><Check className="mr-2 h-4 w-4" />Salvar nota</Button>
                      {selectedNote && <Button variant="outline" onClick={handleCreateTask}><ListTodo className="mr-2 h-4 w-4" />Criar tarefa</Button>}
                      {selectedNote && <Button variant="outline" onClick={handleDelete} className="ml-auto text-destructive hover:text-destructive"><Trash2 className="mr-2 h-4 w-4" />Excluir</Button>}
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </main>
        </div>
        <MobileNav />

        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir nota</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação remove a nota permanentemente da biblioteca.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </>
  );
}