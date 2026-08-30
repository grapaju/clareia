import React, { useEffect, useMemo, useState } from 'react';
import { Archive, Bookmark, CheckCircle2, Pencil, Search, Sparkles, Trash2 } from 'lucide-react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import Header from '@/components/Header.jsx';
import MobileNav from '@/components/MobileNav.jsx';
import ProjectSelect from '@/components/ProjectSelect.jsx';
import Sidebar from '@/components/Sidebar.jsx';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext.jsx';
import apiClient, { getCurrentAccountId } from '@/lib/apiClient.js';
import {
  formatNoteDateTime,
  listUnsortedNotes,
  removeUnsortedNote,
  subscribeToUnsortedNotes,
  syncUnsortedNotesFromApi,
  updateUnsortedNote,
} from '@/lib/unsortedNotesStorage.js';
import { createProjectNote } from '@/services/projectNoteService.js';

const FILTERS = [
  ['aguardando_organizacao', 'Aguardando organização'],
  ['processado', 'Processados'],
  ['arquivado', 'Arquivados'],
];

function sourceLabel(source) {
  if (source === 'captura-rapida') return 'Captura rápida';
  if (source === 'descarregar-mente') return 'Tirar da cabeça';
  return 'Captura';
}

export default function SavedItemsPage() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const userId = currentUser?.id || apiClient.authStore?.model?.id || '';
  const accountId = currentUser?.currentAccountId || getCurrentAccountId();
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('aguardando_organizacao');
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState('');
  const [editingContent, setEditingContent] = useState('');
  const [deleteId, setDeleteId] = useState('');

  useEffect(() => {
    const sync = () => setItems(listUnsortedNotes(userId));
    sync();
    syncUnsortedNotesFromApi(userId).then(setItems).catch(() => {});
    return subscribeToUnsortedNotes(sync);
  }, [userId]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('pt-BR');
    return items.filter((item) => item.status === filter).filter((item) => (
      !query
      || item.content.toLocaleLowerCase('pt-BR').includes(query)
      || item.project.toLocaleLowerCase('pt-BR').includes(query)
    ));
  }, [filter, items, search]);

  const counts = useMemo(() => Object.fromEntries(FILTERS.map(([status]) => [
    status,
    items.filter((item) => item.status === status).length,
  ])), [items]);

  const organizeNow = (item) => {
    navigate('/criar-plano', { state: { prefillText: item.content, savedNoteId: item.id } });
  };

  const saveEdit = (item) => {
    if (!editingContent.trim()) return;
    updateUnsortedNote(item.id, { content: editingContent }, userId);
    setEditingId('');
    setEditingContent('');
    toast.success('Guardado atualizado.');
  };

  const archive = (item) => {
    updateUnsortedNote(item.id, { status: 'arquivado' }, userId);
    toast.success('Guardado arquivado.', {
      action: {
        label: 'Desfazer',
        onClick: () => updateUnsortedNote(item.id, { status: item.status }, userId),
      },
    });
  };

  const transformIntoNote = async (item) => {
    try {
      if (item.project) {
        const created = createProjectNote({
          projectName: item.project,
          title: 'Captura guardada',
          content: item.content,
          tags: ['guardados'],
        });
        if (!created) throw new Error('note_not_created');
      } else {
        await apiClient.collection('anotacoes').create({
          userId,
          ...(accountId ? { accountId } : {}),
          titulo: item.content.slice(0, 90),
          conteudo: item.content,
          projeto: '',
          tipo: 'Geral',
          tags: 'guardados',
          fixada: false,
        }, { $autoCancel: false });
      }

      updateUnsortedNote(item.id, { status: 'processado' }, userId);
      toast.success(item.project ? `Nota adicionada ao projeto ${item.project}.` : 'Nota salva em Notas e ideias.');
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível transformar este guardado em nota.');
    }
  };

  const confirmDelete = () => {
    if (!deleteId) return;
    removeUnsortedNote(deleteId, userId);
    setDeleteId('');
    toast.success('Guardado excluído.');
  };

  return (
    <>
      <Helmet><title>Guardados - Clareia</title></Helmet>
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="min-w-0 flex-1 pb-20 md:pb-8">
            <div className="page-container section-spacing max-w-4xl">
              <div className="mb-7">
                <div className="mb-2 flex items-center gap-3">
                  <Bookmark className="h-7 w-7 text-primary" aria-hidden="true" />
                  <h1 className="text-3xl">Guardados</h1>
                </div>
                <p className="text-muted-foreground">Capturas que você deixou para organizar com calma.</p>
              </div>

              <div className="mb-5 flex items-center gap-2 rounded-md border border-border bg-card px-3">
                <Search className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar nos guardados"
                  className="border-0 px-0 shadow-none focus-visible:ring-0"
                />
              </div>

              <Tabs value={filter} onValueChange={setFilter} className="mb-6">
                <TabsList className="h-auto w-full justify-start overflow-x-auto p-1">
                  {FILTERS.map(([status, label]) => (
                    <TabsTrigger key={status} value={status} className="min-h-11 whitespace-nowrap">
                      {label} ({counts[status] || 0})
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>

              {filteredItems.length === 0 ? (
                <div className="rounded-md border border-dashed border-border px-6 py-12 text-center">
                  <p className="font-medium">Nada aqui por enquanto.</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    O que você guardar em Tirar da cabeça aparecerá nesta área.
                  </p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {filteredItems.map((item) => {
                    const isEditing = editingId === item.id;
                    return (
                      <li key={item.id} className="rounded-md border border-border bg-card p-4">
                        {isEditing ? (
                          <Textarea value={editingContent} onChange={(event) => setEditingContent(event.target.value)} className="min-h-28" />
                        ) : (
                          <p className="whitespace-pre-wrap text-sm text-foreground">{item.content}</p>
                        )}

                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span>{formatNoteDateTime(item.updatedAt || item.createdAt)}</span>
                          <span>{sourceLabel(item.source)}</span>
                          {item.project && <span>Projeto: {item.project}</span>}
                        </div>

                        <div className="mt-4 max-w-sm">
                          <ProjectSelect
                            value={item.project}
                            onChange={(project) => updateUnsortedNote(item.id, { project }, userId)}
                          />
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {item.status === 'aguardando_organizacao' && (
                            <Button size="sm" onClick={() => organizeNow(item)}>
                              <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" />Organizar agora
                            </Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => transformIntoNote(item)} disabled={item.status === 'processado'}>
                            <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden="true" />Transformar em nota
                          </Button>
                          {isEditing ? (
                            <>
                              <Button size="sm" variant="outline" onClick={() => saveEdit(item)}>Salvar edição</Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditingId('')}>Cancelar</Button>
                            </>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => { setEditingId(item.id); setEditingContent(item.content); }}>
                              <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />Editar
                            </Button>
                          )}
                          {item.status !== 'arquivado' && (
                            <Button size="sm" variant="ghost" onClick={() => archive(item)}>
                              <Archive className="mr-2 h-4 w-4" aria-hidden="true" />Não preciso mais
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" className="text-destructive" onClick={() => setDeleteId(item.id)} aria-label="Excluir guardado">
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </main>
        </div>
        <MobileNav />
      </div>

      <AlertDialog open={Boolean(deleteId)} onOpenChange={(open) => !open && setDeleteId('')}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir guardado?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
