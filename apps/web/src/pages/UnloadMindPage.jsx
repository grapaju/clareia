
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Brain, Sparkles, ListTodo, BookmarkPlus, Inbox, Pencil, Trash2, Check, ArrowRight } from 'lucide-react';
import Header from '@/components/Header.jsx';
import Sidebar from '@/components/Sidebar.jsx';
import MobileNav from '@/components/MobileNav.jsx';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
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
import pb from '@/lib/pocketbaseClient.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { generateClarifiedText, normalizeTaskTypeForTaskCollection, parseUnloadMindToPlan } from '@/lib/unloadMindLogic.js';
import { toast } from 'sonner';
import { getCurrentAccountId } from '@/lib/pocketbaseClient.js';
import { useTaskContext } from '@/hooks/useTaskContext.js';
import { createProjectNote } from '@/services/projectNoteService.js';
import { appendProjectHistory } from '@/services/projectHistoryService.js';
import {
  createUnsortedNote,
  formatNoteDateTime,
  listUnsortedNotes,
  removeUnsortedNote,
  subscribeToUnsortedNotes,
  updateUnsortedNote
} from '@/lib/unsortedNotesStorage.js';

function analyzeClarifiedText(text) {
  const raw = (text || '').trim();
  const createIssue = (item, criterion, detail, recommendedAction, severity = 'media') => ({
    id: `${item}-${criterion}-${detail}`,
    item,
    criterion,
    detail,
    recommendedAction,
    severity
  });

  if (!raw) {
    return [createIssue('-', 'Conteúdo', 'O texto clareado está vazio.', 'Escreva ao menos um item numerado com ação e contexto.', 'critica')];
  }

  const lines = raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^\d+\.\s+/.test(line));

  if (lines.length === 0) {
    return [createIssue('-', 'Formato', 'Não foi possível identificar itens numerados.', 'Use o padrão "1. ...", "2. ..." para cada ação.', 'critica')];
  }

  const issues = [];
  const actionVerbPattern = /\b(testar|acompanhar|verificar|conferir|enviar|resolver|criar|retomar|avaliar|agendar|cobrar|alinhar|validar|revisar|atualizar|publicar|corrigir|finalizar|priorizar|organizar|mapear|contatar|ligar)\b/i;
  const projectContextPattern = /\b(CRM|Google Ads|Fluxo de Caixa|IDTPR|Corcril|Expocentro|Leone|gov\.br|projeto|cliente|site|campanha|evento|or[çc]amento|cobran[çc]a|proposta|faturas?|sistema|reuni[aã]o|contador|comercial|financeir[oa])\b/i;
  const objectPattern = /\b(para|de|do|da|no|na|com|sobre|em)\s+[a-z0-9à-ÿ][\wÀ-ÿ.-]{2,}/i;
  const weakLinePattern = /^(testar|acompanhar|verificar|conferir|enviar|resolver|criar|retomar|avaliar)\.?$/i;

  lines.forEach((numberedLine, index) => {
    const line = numberedLine.replace(/^\d+\.\s+/, '').trim();
    const words = line
      .replace(/[.,;:!?()]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);

    if (weakLinePattern.test(line)) {
      issues.push(
        createIssue(
          index + 1,
          'Especificidade',
          `Item genérico: "${line}".`,
          'Descreva ação + objeto + contexto do projeto.',
          'alta'
        )
      );
      return;
    }

    if (words.length < 4) {
      issues.push(
        createIssue(
          index + 1,
          'Completude',
          `Item curto demais: "${line}".`,
          'Adicione detalhes mínimos para execução imediata.',
          'alta'
        )
      );
      return;
    }

    if (!actionVerbPattern.test(line)) {
      issues.push(
        createIssue(
          index + 1,
          'Ação',
          `Sem ação executável clara: "${line}".`,
          'Inicie com verbo operacional (revisar, enviar, validar, alinhar, priorizar...).',
          'alta'
        )
      );
      return;
    }

    if (!objectPattern.test(line)) {
      issues.push(
        createIssue(
          index + 1,
          'Objeto',
          `Sem objeto claro: "${line}".`,
          'Especifique exatamente o que será feito.',
          'alta'
        )
      );
      return;
    }

    if (!projectContextPattern.test(line)) {
      issues.push(
        createIssue(
          index + 1,
          'Contexto',
          `Sem projeto/contexto explícito: "${line}".`,
          'Cite cliente, projeto, sistema ou frente responsável.',
          'media'
        )
      );
    }
  });

  return issues;
}

export default function UnloadMindPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();
  const { addTask } = useTaskContext();
  const userId = currentUser?.id || pb.authStore?.model?.id || '';
  const accountId = currentUser?.currentAccountId || getCurrentAccountId();
  const isCreatePlanView = location.pathname === '/criar-plano' || new URLSearchParams(location.search).get('modo') === 'plano';
  const [text, setText] = useState(location.state?.prefillText || '');
  const [isProcessing, setIsProcessing] = useState(false);
  const [savedNotes, setSavedNotes] = useState([]);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editingContent, setEditingContent] = useState('');
  const [projectOptions, setProjectOptions] = useState([]);
  const [selectedProject, setSelectedProject] = useState('none');
  const [selectedPendingIds, setSelectedPendingIds] = useState([]);
  const [showPendingSelector, setShowPendingSelector] = useState(false);
  const [pendingDeleteNoteId, setPendingDeleteNoteId] = useState(null);
  const [postActionDialog, setPostActionDialog] = useState({ open: false, noteId: null, mode: 'plan' });
  const [textReview, setTextReview] = useState({
    open: false,
    original: '',
    clarified: '',
    noteId: null,
    editing: false
  });
  const postActionResolverRef = useRef(null);

  const planTemplates = [
    {
      label: 'Planejar minha semana',
      text: 'Quais são as 3 prioridades da semana? O que precisa acontecer hoje, esta semana e pode esperar? Quais próximos passos práticos de até 30 min?'
    },
    {
      label: 'Organizar tarefas de um cliente',
      text: 'Quais pendências desse cliente estão misturadas? O que é urgente, o que depende de resposta e o que posso executar agora?'
    },
    {
      label: 'Preparar reunião',
      text: 'Qual objetivo da reunião? Quais tópicos preciso levar? Quais materiais revisar antes? Qual próximo passo após a reunião?'
    },
    {
      label: 'Planejar entrega de site',
      text: 'Quais etapas faltam para entrega do site? O que está bloqueado? O que validar em conteúdo, layout, técnica e publicação?'
    },
    {
      label: 'Organizar cobranças',
      text: 'Quais cobranças estão pendentes? Quem precisa ser contatado? Qual ordem de prioridade e próximos follow-ups?'
    },
    {
      label: 'Retomar projeto parado',
      text: 'Onde parei neste projeto? O que está bloqueando? Qual menor próximo passo para destravar hoje?'
    }
  ];

  const pendingNotesCount = useMemo(() => savedNotes.length, [savedNotes.length]);
  const clarifiedIssues = useMemo(() => {
    const priority = { critica: 0, alta: 1, media: 2 };
    const issues = analyzeClarifiedText(textReview.clarified);

    return [...issues].sort((a, b) => {
      const severityDiff = (priority[a.severity] ?? 99) - (priority[b.severity] ?? 99);
      if (severityDiff !== 0) return severityDiff;

      const itemA = Number(a.item);
      const itemB = Number(b.item);
      const hasNumericA = Number.isFinite(itemA);
      const hasNumericB = Number.isFinite(itemB);

      if (hasNumericA && hasNumericB) return itemA - itemB;
      if (hasNumericA) return -1;
      if (hasNumericB) return 1;
      return String(a.item).localeCompare(String(b.item), 'pt-BR');
    });
  }, [textReview.clarified]);

  useEffect(() => {
    const syncNotes = () => {
      setSavedNotes(listUnsortedNotes(userId, 'pendente'));
    };

    syncNotes();
    const unsubscribe = subscribeToUnsortedNotes(syncNotes);

    return unsubscribe;
  }, [userId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem('clareia_project_profiles_v1');
      const parsed = JSON.parse(raw || '[]');
      const projects = Array.isArray(parsed)
        ? parsed.map((item) => String(item?.name || '').trim()).filter(Boolean)
        : [];
      const uniqueSorted = [...new Set(projects)].sort((a, b) => a.localeCompare(b, 'pt-BR'));
      setProjectOptions(uniqueSorted);
    } catch {
      setProjectOptions([]);
    }
  }, []);

  const getStatusFromScheduledDate = (scheduledDate) => {
    if (!scheduledDate) return 'Esta semana';
    const today = new Date();
    const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const target = new Date(scheduledDate);
    const startTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate());
    const diffDays = Math.round((startTarget.getTime() - startToday.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) return 'Hoje';
    if (diffDays <= 7) return 'Esta semana';
    return 'Próxima semana';
  };

  const handleOrganizePlan = async (customText = null, noteId = null, originalTextOverride = null) => {
    const content = typeof customText === 'string' ? customText : text;
    const originalContent = typeof originalTextOverride === 'string' ? originalTextOverride : content;
    if (!content.trim()) return;
    if (!userId) {
      toast.error('Sua sessão não foi carregada. Faça login novamente.');
      return;
    }
    setIsProcessing(true);
    
    try {
      const plan = parseUnloadMindToPlan(content);
      if (plan) {
        const relatedProjects = [
          ...(plan.maxima || []),
          ...(plan.alta || []),
          ...(plan.media || []),
          ...(plan.podeEsperar || plan.baixa || []),
          ...(plan.acompanharDepois || [])
        ]
          .map((task) => String(task.project || '').trim())
          .filter(Boolean);

        // Save to DB to pass state robustly and keep history
        const record = await pb.collection('planosClareados').create({
          userId,
          ...(accountId ? { accountId } : {}),
          conteudoOriginal: originalContent,
          planoGerado: {
            ...plan,
            meta: {
              status: 'pending',
              createdAt: new Date().toISOString(),
              textoOriginal: originalContent,
              textoClareado: content
            }
          }
        }, { $autoCancel: false });
        
        if (!customText) {
          toast.success('Plano gerado com sucesso!');
        }

        [...new Set(relatedProjects)].forEach((projectName) => {
          appendProjectHistory(projectName, 'Plano gerado', 'Plano clareado criado a partir de pendências/tarefas misturadas');
        });

        if (noteId) {
          const shouldRemove = await askRemoveAfterAction(noteId, 'plan');
          if (shouldRemove) {
            removeUnsortedNote(noteId, userId);
          } else {
            updateUnsortedNote(noteId, { status: 'organizada' }, userId);
          }
        }

        navigate('/plano-clareado', { state: { planRecord: record } });
      }
    } catch (err) {
      console.error(err);
      toast.error('Erro ao processar o plano.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePrepareClarifiedText = (customText = null, noteId = null) => {
    const content = typeof customText === 'string' ? customText : text;
    if (!content.trim()) return;

    const clarified = generateClarifiedText(content);
    setTextReview({
      open: true,
      original: content,
      clarified,
      noteId,
      editing: false
    });
  };

  const handleApproveClarifiedText = async () => {
    await handleOrganizePlan(textReview.clarified, textReview.noteId, textReview.original);
    setTextReview({
      open: false,
      original: '',
      clarified: '',
      noteId: null,
      editing: false
    });
  };

  const handleBackToOriginalText = () => {
    setText(textReview.original || text);
    setTextReview((prev) => ({ ...prev, open: false, editing: false }));
  };

  const handleCreateTasks = async (customText = null, noteId = null) => {
    const content = typeof customText === 'string' ? customText : text;
    if (!content.trim()) return;
    if (!userId) {
      toast.error('Sua sessão não foi carregada. Faça login novamente.');
      return;
    }
    setIsProcessing(true);
    try {
      const plan = parseUnloadMindToPlan(content);
      let count = 0;
      const allTasks = [
        ...(plan.maxima || []),
        ...(plan.alta || []),
        ...(plan.media || []),
        ...(plan.podeEsperar || plan.baixa || []),
        ...(plan.acompanharDepois || [])
      ];
      
      for (const t of allTasks) {
        const scheduledDate = t.scheduledDate || t.dataSugeridaExecucao || new Date().toISOString().split('T')[0];
        const scheduledPeriod = t.scheduledPeriod || t.periodoSugerido || 'tarde';
        await pb.collection('tasks').create({
          userId,
          ...(accountId ? { accountId } : {}),
          title: t.title,
          project: t.project,
          taskType: normalizeTaskTypeForTaskCollection(t.taskType),
          nextAction: t.firstStep || t.microtarefas?.[0]?.descricao || t.title,
          timeEstimate: t.timeEstimate,
          energiaNecessaria: t.energiaNecessaria,
          periodoSugerido: scheduledPeriod,
          dataSugeridaExecucao: scheduledDate,
          scheduledDate,
          scheduledPeriod,
          scheduledLabel: t.scheduledLabel || t.quandoFazer || null,
          isBusinessTask: Boolean(t.isBusinessTask),
          isClientTask: Boolean(t.isClientTask),
          microtarefas: t.microtarefas,
          status: getStatusFromScheduledDate(scheduledDate)
        }, { $autoCancel: false });
        if (t.project) {
          appendProjectHistory(t.project, 'Tarefa criada', t.title || 'Nova tarefa do plano');
        }
        count++;
      }
      toast.success(`${count} tarefas criadas diretamente!`);

      if (!customText) {
        setText('');
        navigate('/');
      }

      if (noteId) {
        const shouldRemove = await askRemoveAfterAction(noteId, 'task');
        if (shouldRemove) {
          removeUnsortedNote(noteId, userId);
        } else {
          updateUnsortedNote(noteId, { status: 'transformada' }, userId);
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('Erro ao criar tarefas.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateSingleTaskFromNote = async (customText = null, noteId = null) => {
    const content = typeof customText === 'string' ? customText : text;
    if (!content.trim()) return;
    if (!userId) {
      toast.error('Sua sessão não foi carregada. Faça login novamente.');
      return;
    }

    setIsProcessing(true);
    try {
      const title = content.split('\n').find((line) => line.trim())?.trim().slice(0, 120) || 'Captura rápida';
      await addTask({
        title,
        project: selectedProject !== 'none' ? selectedProject : 'Pessoal',
        taskType: 'Administrativo',
        nextAction: content.trim().slice(0, 160),
        description: content.trim(),
        timeEstimate: 25,
        energiaNecessaria: 'Média',
        executionDifficulty: 'Direta',
        scheduledDate: new Date().toISOString().split('T')[0],
        scheduledPeriod: 'tarde',
        status: 'Hoje'
      });

      if (noteId) {
        updateUnsortedNote(noteId, { status: 'transformada' }, userId);
      } else {
        setText('');
      }

      toast.success('Pensamento enviado como tarefa.');
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível criar tarefa.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSendToProjectNotes = (customText = null, noteId = null) => {
    const content = typeof customText === 'string' ? customText : text;
    if (!content.trim()) return;
    if (selectedProject === 'none') {
      toast.error('Selecione um projeto para enviar.');
      return;
    }

    const saved = createProjectNote({
      projectName: selectedProject,
      title: 'Captura rápida',
      content: content.trim(),
      tags: ['inbox', 'descarregar-mente']
    });

    if (!saved) {
      toast.error('Não foi possível enviar para notas do projeto.');
      return;
    }

    if (noteId) {
      updateUnsortedNote(noteId, { status: 'organizada' }, userId);
    } else {
      setText('');
    }

    toast.success(`Enviado para notas do projeto ${selectedProject}.`);
  };

  const handleSaveNote = async () => {
    if (!text.trim()) return;
    const note = createUnsortedNote({
      content: text,
      userId,
      source: 'descarregar-mente'
    });

    if (note) {
      toast.success('Pendência guardada. Você pode organizar isso depois.');
      setText('');
    } else {
      toast.error('Erro ao guardar pendência.');
    }
  };

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
    const updated = updateUnsortedNote(noteId, { content: editingContent }, userId);
    if (updated) {
      toast.success('Pendência atualizada.');
      cancelEdit();
    } else {
      toast.error('Não foi possível atualizar a pendência.');
    }
  };

  const deleteNote = (noteId) => {
    setPendingDeleteNoteId(noteId);
  };

  const confirmDeleteNote = () => {
    if (!pendingDeleteNoteId) return;
    const removed = removeUnsortedNote(pendingDeleteNoteId, userId);
    if (removed) {
      toast.success('Pendência excluída.');
      if (editingNoteId === pendingDeleteNoteId) {
        cancelEdit();
      }
      setPendingDeleteNoteId(null);
    } else {
      toast.error('Não foi possível excluir a pendência.');
    }
  };

  const askRemoveAfterAction = (noteId, mode) => new Promise((resolve) => {
    postActionResolverRef.current = resolve;
    setPostActionDialog({ open: true, noteId, mode });
  });

  const closePostActionDialog = (shouldRemove = false) => {
    if (postActionResolverRef.current) {
      postActionResolverRef.current(shouldRemove);
      postActionResolverRef.current = null;
    }
    setPostActionDialog({ open: false, noteId: null, mode: 'plan' });
  };

  const togglePendingSelection = (noteId, checked) => {
    setSelectedPendingIds((current) => {
      if (checked) return [...new Set([...current, noteId])];
      return current.filter((id) => id !== noteId);
    });
  };

  const handleUseSavedPendings = async () => {
    const selectedNotes = savedNotes.filter((note) => selectedPendingIds.includes(note.id));
    if (selectedNotes.length === 0) {
      toast.error('Selecione ao menos uma pendência.');
      return;
    }

    const mergedContent = selectedNotes.map((note, index) => `${index + 1}. ${note.content}`).join('\n');
    handlePrepareClarifiedText(mergedContent);
  };

  return (
    <>
      <Helmet><title>{isCreatePlanView ? 'Criar plano - Clareia' : 'Descarregar mente - Clareia'}</title></Helmet>
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="flex flex-1">
          <Sidebar />
          <main className="flex-1 pb-20 md:pb-8 w-full max-w-5xl mx-auto px-4 md:px-8 py-10 md:py-16">
            
            <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="mb-10 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary mb-6 shadow-sm">
                  <Brain className="w-8 h-8" />
                </div>
                <h1 className="text-3xl md:text-4xl font-medium text-foreground mb-4">{isCreatePlanView ? 'Criar plano' : 'Descarregar mente'}</h1>
                {isCreatePlanView ? (
                  <p className="text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
                    Use quando tiver várias coisas misturadas e quiser que o Clareia organize prioridades, passos e ordem de execução.
                  </p>
                ) : (
                  <p className="text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
                    Use para capturar pensamentos soltos, lembretes e pendências rápidas. Você pode organizar depois.
                  </p>
                )}
              </div>

              <div className="bg-card rounded-3xl shadow-sm border border-border p-2 mb-8">
                <Textarea 
                  placeholder={isCreatePlanView
                    ? 'Ex: revisar monitoramento dos sites e listar melhorias priorizadas.'
                    : 'Escreva um pensamento avulso, ideia rápida ou lembrete que não pode se perder.'}
                  className="min-h-[280px] text-lg p-6 bg-transparent border-0 focus-visible:ring-0 resize-y text-foreground placeholder:text-muted-foreground/60"
                  value={text}
                  onChange={e => setText(e.target.value)}
                />
              </div>

              {isCreatePlanView && textReview.open && (
                <Card className="bg-card border-border shadow-sm mb-6">
                  <CardContent className="p-5 space-y-5">
                    <div>
                      <h2 className="text-xl font-medium text-foreground">Texto organizado</h2>
                      <p className="text-sm text-muted-foreground">
                        Revise a versão clareada antes de gerar o plano. O texto original será mantido no histórico.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label>Texto original</Label>
                      <Textarea value={textReview.original} readOnly className="min-h-[140px] bg-muted/30" />
                    </div>

                    <div className="space-y-2">
                      <Label>Texto clareado</Label>
                      <Textarea
                        value={textReview.clarified}
                        readOnly={!textReview.editing}
                        onChange={(event) => setTextReview((prev) => ({ ...prev, clarified: event.target.value }))}
                        className="min-h-[180px]"
                      />
                    </div>

                    {clarifiedIssues.length > 0 && (
                      <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                        <p className="text-sm font-medium text-destructive mb-2">
                          Qualidade do texto: pendências para liberar a geração do plano
                        </p>
                        <p className="text-xs text-destructive/90 mb-2">
                          Ordem de priorização: Crítica, Alta e Média.
                        </p>
                        <div className="space-y-2 text-sm text-destructive">
                          {clarifiedIssues.map((issue) => (
                            <div
                              key={issue.id}
                              className="rounded-md border border-destructive/25 bg-background/60 p-2"
                            >
                              <p>
                                <span className="font-medium">Severidade:</span>{' '}
                                {issue.severity === 'critica' ? 'Crítica' : issue.severity === 'alta' ? 'Alta' : 'Média'}
                              </p>
                              <p>
                                <span className="font-medium">Item:</span> {issue.item}
                              </p>
                              <p>
                                <span className="font-medium">Critério:</span> {issue.criterion}
                              </p>
                              <p>
                                <span className="font-medium">Detalhe:</span> {issue.detail}
                              </p>
                              <p>
                                <span className="font-medium">Ação recomendada:</span> {issue.recommendedAction}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-3">
                      <Button onClick={handleApproveClarifiedText} disabled={!textReview.clarified.trim() || clarifiedIssues.length > 0 || isProcessing}>
                        Está correto, gerar plano
                      </Button>
                      <Button variant="outline" onClick={() => setTextReview((prev) => ({ ...prev, editing: true }))}>
                        Editar texto clareado
                      </Button>
                      <Button variant="outline" onClick={handleBackToOriginalText}>
                        Voltar ao original
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {isCreatePlanView && (
                <Card className="bg-card border-border shadow-sm mb-6">
                  <CardContent className="p-4 space-y-4">
                    <div>
                      <h2 className="text-base font-medium text-foreground">Modelos rápidos</h2>
                      <p className="text-sm text-muted-foreground">Escolha um modelo para começar sem ambiguidade.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {planTemplates.map((template) => (
                        <Button key={template.label} size="sm" variant="outline" onClick={() => setText(template.text)}>
                          {template.label}
                        </Button>
                      ))}
                    </div>
                    <div className="pt-2">
                      <Button variant="secondary" onClick={() => setShowPendingSelector((prev) => !prev)}>
                        Usar pendências guardadas
                      </Button>
                    </div>

                    {showPendingSelector && (
                      <div className="rounded-lg border border-border p-3 space-y-3">
                        {savedNotes.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Não há pendências guardadas.</p>
                        ) : (
                          <>
                            <ul className="space-y-2 max-h-60 overflow-auto">
                              {savedNotes.map((note) => (
                                <li key={note.id} className="flex items-start gap-2">
                                  <Checkbox
                                    checked={selectedPendingIds.includes(note.id)}
                                    onCheckedChange={(checked) => togglePendingSelection(note.id, Boolean(checked))}
                                  />
                                  <p className="text-sm text-foreground">{note.content}</p>
                                </li>
                              ))}
                            </ul>
                            <Button onClick={handleUseSavedPendings} disabled={selectedPendingIds.length === 0 || isProcessing}>
                              Gerar plano com selecionadas
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {!isCreatePlanView && (
                <div className="mb-6">
                  <Label>Projeto destino (opcional para triagem)</Label>
                  <Select value={selectedProject} onValueChange={setSelectedProject}>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Selecionar projeto" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem projeto</SelectItem>
                      {projectOptions.map((project) => (
                        <SelectItem key={project} value={project}>{project}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex flex-col sm:flex-row flex-wrap gap-4 justify-center">
                {isCreatePlanView && (
                  <Button 
                    size="lg" 
                    onClick={() => handlePrepareClarifiedText()} 
                    disabled={!text.trim() || isProcessing}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground h-14 px-8 text-base rounded-2xl shadow-sm"
                  >
                    <Sparkles className="w-5 h-5 mr-2" />
                    Organizar em plano
                  </Button>
                )}
                {!isCreatePlanView && (
                  <>
                    <Button 
                      size="lg" 
                      variant="secondary"
                      onClick={handleCreateSingleTaskFromNote} 
                      disabled={!text.trim() || isProcessing}
                      className="bg-secondary text-secondary-foreground hover:bg-secondary/80 h-14 px-8 text-base rounded-2xl"
                    >
                      <ListTodo className="w-5 h-5 mr-2" />
                      Transformar em tarefa
                    </Button>

                    <Button
                      size="lg"
                      variant="outline"
                      onClick={() => handleSendToProjectNotes()}
                      disabled={!text.trim() || isProcessing || selectedProject === 'none'}
                      className="border-border text-foreground hover:bg-muted h-14 px-8 text-base rounded-2xl"
                    >
                      <ArrowRight className="w-5 h-5 mr-2" />
                      Enviar para projeto
                    </Button>

                    <Button 
                      size="lg" 
                      variant="outline"
                      onClick={handleSaveNote} 
                      disabled={!text.trim() || isProcessing}
                      className="border-border text-foreground hover:bg-muted h-14 px-8 text-base rounded-2xl"
                    >
                      <BookmarkPlus className="w-5 h-5 mr-2" />
                      Guardar para depois
                    </Button>
                  </>
                )}
              </div>

              {!isCreatePlanView && (
                <div className="mt-5 text-center">
                  <Button asChild variant="ghost" className="text-primary hover:bg-primary/5 hover:text-primary">
                    <Link to="/descarregar-mente">Continuar no Descarregar mente</Link>
                  </Button>
                </div>
              )}

              {!isCreatePlanView && (
                <Card className="bg-card border-border shadow-sm mt-10">
                  <CardContent className="p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
                      <div className="flex items-center gap-2">
                        <Inbox className="w-5 h-5 text-primary" />
                          <h2 className="text-xl font-medium text-foreground">Capturas pendentes de triagem</h2>
                      </div>
                      <div className="flex items-center gap-3">
                          <p className="text-sm text-muted-foreground">Pendentes: {pendingNotesCount}</p>
                        <Button asChild variant="ghost" size="sm" className="text-primary hover:text-primary">
                          <Link to="/inbox">Ver todas as pendências</Link>
                        </Button>
                      </div>
                    </div>

                    {savedNotes.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhuma pendência guardada por enquanto.</p>
                    ) : (
                      <ul className="space-y-4">
                        {savedNotes.map((note) => {
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

                              <div className="mt-4 flex flex-wrap gap-2">
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
                                    <Button size="sm" onClick={() => handleSendToProjectNotes(note.content, note.id)} disabled={isProcessing || selectedProject === 'none'}>
                                      <ArrowRight className="w-4 h-4 mr-2" />
                                      Enviar p/ projeto
                                    </Button>
                                    <Button size="sm" variant="secondary" onClick={() => handleCreateSingleTaskFromNote(note.content, note.id)} disabled={isProcessing}>
                                      <ListTodo className="w-4 h-4 mr-2" />
                                      Transformar em tarefa
                                    </Button>
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
              )}
            </div>

          </main>
        </div>
        <MobileNav />

        <AlertDialog open={Boolean(pendingDeleteNoteId)} onOpenChange={(open) => !open && setPendingDeleteNoteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir pendência</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação remove a pendência permanentemente.
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

        <AlertDialog open={postActionDialog.open} onOpenChange={(open) => !open && closePostActionDialog(false)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover pendência da lista</AlertDialogTitle>
              <AlertDialogDescription>
                {postActionDialog.mode === 'plan'
                  ? 'Pendência enviada para o plano. Deseja remover da lista de pendências?'
                  : 'Pendência transformada em tarefa. Deseja remover da lista de pendências?'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => closePostActionDialog(false)}>Manter na lista</AlertDialogCancel>
              <AlertDialogAction onClick={() => closePostActionDialog(true)}>
                Remover da lista
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </>
  );
}
