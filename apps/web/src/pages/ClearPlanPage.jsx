import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useLocation, useNavigate } from 'react-router-dom';
import { Sparkles, Edit2, Copy, ListTodo, Calendar, Clock, ChevronDown, ChevronUp, Link2, Trash2, Layers } from 'lucide-react';
import Header from '@/components/Header.jsx';
import Sidebar from '@/components/Sidebar.jsx';
import MobileNav from '@/components/MobileNav.jsx';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useTheme } from '@/contexts/ThemeContext.jsx';
import pb from '@/lib/pocketbaseClient.js';
import { getCurrentAccountId } from '@/lib/pocketbaseClient.js';
import { normalizeTaskTypeForTaskCollection } from '@/lib/unloadMindLogic.js';
import { toast } from 'sonner';
import { appendProjectHistory } from '@/services/projectHistoryService.js';

const TASK_TYPE_OPTIONS = [
  'orçamento/proposta',
  'envio/aprovação',
  'Google Ads',
  'acompanhamento',
  'evento/site',
  'cobrança',
  'fatura/cobrança',
  'acesso sensível',
  'CRM/sistema',
  'teste/sistema',
  'administrativo'
];

const PRIORITY_OPTIONS = ['Prioridade máxima', 'Prioridade alta', 'Prioridade média', 'Pode esperar', 'Acompanhar depois'];

const SENSITIVE_WARNING = 'Evite salvar senhas sensíveis diretamente no Clareia. Use um gerenciador seguro ou registre apenas onde o acesso está armazenado.';

function normalizeText(value = '') {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function getPlanStatus(planObj) {
  return planObj?.meta?.status || 'pending';
}

function getAllPlanTasks(planObj) {
  return [
    ...(planObj?.maxima || []),
    ...(planObj?.alta || []),
    ...(planObj?.media || []),
    ...(planObj?.podeEsperar || planObj?.baixa || []),
    ...(planObj?.acompanharDepois || [])
  ];
}

function inferPriorityGroup(priority = '') {
  const normalized = String(priority).toLowerCase();
  if (normalized.includes('máxima') || normalized.includes('maxima')) return 'maxima';
  if (normalized.includes('alta')) return 'alta';
  if (normalized.includes('acompanhar')) return 'acompanharDepois';
  if (normalized.includes('pode esperar')) return 'podeEsperar';
  return 'media';
}

function getPriorityByType(taskType = '', currentPriority = '') {
  const normalizedType = String(taskType).toLowerCase();
  if (normalizedType === 'orçamento/proposta' || normalizedType === 'envio/aprovação' || normalizedType === 'cobrança' || normalizedType === 'fatura/cobrança') {
    return 'Prioridade alta';
  }
  if (normalizedType === 'acompanhamento' || normalizedType === 'teste/sistema' || normalizedType === 'evento/site') {
    return 'Prioridade média';
  }
  return currentPriority || 'Prioridade média';
}

function getStatusFromScheduledDate(scheduledDate) {
  if (!scheduledDate) return 'Esta semana';
  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const target = new Date(scheduledDate);
  const startTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const diffDays = Math.round((startTarget.getTime() - startToday.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return 'Hoje';
  if (diffDays <= 7) return 'Esta semana';
  return 'Próxima semana';
}

export default function ClearPlanPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const accountId = currentUser?.currentAccountId || getCurrentAccountId();
  const { lowStimulationMode } = useTheme();
  const cameFromDirectCreate = Boolean(location.state?.planRecord);

  const [planData, setPlanData] = useState(location.state?.planRecord || null);
  const [isResolvingPendingPlan, setIsResolvingPendingPlan] = useState(!cameFromDirectCreate);
  const [showPendingEntry, setShowPendingEntry] = useState(!cameFromDirectCreate);
  const [isProcessing, setIsProcessing] = useState(false);
  const [editableTasks, setEditableTasks] = useState([]);
  const [expandedTaskIds, setExpandedTaskIds] = useState([]);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [lowStimIndex, setLowStimIndex] = useState(0);

  const [deleteDialog, setDeleteDialog] = useState({ open: false, taskId: null });
  const [mergeDialog, setMergeDialog] = useState({ open: false, sourceId: null, targetId: '' });
  const [microtaskDialog, setMicrotaskDialog] = useState({ open: false, sourceId: null, targetId: '' });

  const plan = planData?.planoGerado;

  const updatePlanStatus = async (record, status, extras = {}) => {
    if (!record?.id || !record?.planoGerado) return;

    await pb.collection('planosClareados').update(record.id, {
      planoGerado: {
        ...record.planoGerado,
        meta: {
          ...(record.planoGerado?.meta || {}),
          status,
          updatedAt: new Date().toISOString(),
          ...extras
        }
      }
    }, { $autoCancel: false });
  };

  useEffect(() => {
    let active = true;

    const loadPendingPlan = async () => {
      if (planData || !currentUser?.id) return;

      try {
        const [plans, tasks] = await Promise.all([
          pb.collection('planosClareados').getFullList({
            sort: '-created',
            filter: `userId = "${currentUser.id}"`,
            $autoCancel: false
          }),
          pb.collection('tasks').getFullList({
            sort: '-created',
            filter: `userId = "${currentUser.id}"`,
            fields: 'id,title',
            $autoCancel: false
          })
        ]);

        const createdTaskTitleSet = new Set(tasks.map((t) => normalizeText(t.title)));

        for (const candidate of plans) {
          const candidatePlan = candidate?.planoGerado;
          const hasTasks = getAllPlanTasks(candidatePlan).length > 0;
          if (!candidatePlan || getPlanStatus(candidatePlan) !== 'pending' || !hasTasks) {
            continue;
          }

          const candidateTasks = getAllPlanTasks(candidatePlan);
          const fullyCreated = candidateTasks.length > 0 && candidateTasks.every((t) => createdTaskTitleSet.has(normalizeText(t.title)));

          if (fullyCreated) {
            await updatePlanStatus(candidate, 'created', { autoDetected: true, createdTasksCount: candidateTasks.length });
            continue;
          }

          if (active) {
            setPlanData(candidate);
            setIsResolvingPendingPlan(false);
          }
          return;
        }

        if (active) {
          setPlanData(null);
          setIsResolvingPendingPlan(false);
        }
      } catch (err) {
        console.error(err);
        if (active) {
          setIsResolvingPendingPlan(false);
        }
      }
    };

    const incomingStatus = getPlanStatus(planData?.planoGerado);
    if (planData && (incomingStatus !== 'pending' || getAllPlanTasks(planData?.planoGerado).length === 0)) {
      setPlanData(null);
      setIsResolvingPendingPlan(false);
      return () => {
        active = false;
      };
    }

    loadPendingPlan();

    return () => {
      active = false;
    };
  }, [planData, currentUser?.id]);

  useEffect(() => {
    if (isResolvingPendingPlan) return;
    if (!showPendingEntry) return;
    if (planData) return;
    navigate('/criar-plano', { replace: true });
  }, [isResolvingPendingPlan, showPendingEntry, planData, navigate]);

  useEffect(() => {
    if (!plan) {
      setEditableTasks([]);
      return;
    }

    const all = getAllPlanTasks(plan).map((task) => ({
      ...task,
      microtarefas: Array.isArray(task.microtarefas) ? task.microtarefas : []
    }));

    setEditableTasks(all);
    setExpandedTaskIds([]);
    setEditingTaskId(null);
    setLowStimIndex(0);
  }, [planData?.id, plan]);

  useEffect(() => {
    if (!lowStimulationMode) return;
    if (lowStimIndex >= editableTasks.length && editableTasks.length > 0) {
      setLowStimIndex(editableTasks.length - 1);
    }
  }, [lowStimulationMode, lowStimIndex, editableTasks.length]);

  const visibleTasks = useMemo(() => {
    if (!lowStimulationMode) return editableTasks;
    if (editableTasks.length === 0) return [];
    return [editableTasks[lowStimIndex]].filter(Boolean);
  }, [lowStimulationMode, editableTasks, lowStimIndex]);

  const mergeCandidates = useMemo(() => {
    if (!mergeDialog.sourceId) return [];
    return editableTasks.filter((task) => task.id !== mergeDialog.sourceId);
  }, [mergeDialog.sourceId, editableTasks]);

  const microtaskCandidates = useMemo(() => {
    if (!microtaskDialog.sourceId) return [];
    return editableTasks.filter((task) => task.id !== microtaskDialog.sourceId);
  }, [microtaskDialog.sourceId, editableTasks]);

  const updateTaskField = (taskId, field, value) => {
    setEditableTasks((prev) => prev.map((task) => {
      if (task.id !== taskId) return task;
      const next = { ...task, [field]: value };
      if (field === 'taskType') {
        next.priority = getPriorityByType(value, task.priority);
      }
      return next;
    }));
  };

  const updateMicrotask = (taskId, microIndex, value) => {
    setEditableTasks((prev) => prev.map((task) => {
      if (task.id !== taskId) return task;
      const micro = [...(task.microtarefas || [])];
      if (!micro[microIndex]) return task;
      micro[microIndex] = { ...micro[microIndex], descricao: value };
      return { ...task, microtarefas: micro };
    }));
  };

  const addMicrotask = (taskId) => {
    setEditableTasks((prev) => prev.map((task) => {
      if (task.id !== taskId) return task;
      return {
        ...task,
        microtarefas: [
          ...(task.microtarefas || []),
          {
            id: `micro-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            descricao: 'Nova microtarefa',
            status: 'não iniciada'
          }
        ]
      };
    }));
  };

  const removeMicrotask = (taskId, microIndex) => {
    setEditableTasks((prev) => prev.map((task) => {
      if (task.id !== taskId) return task;
      const micro = (task.microtarefas || []).filter((_, idx) => idx !== microIndex);
      return { ...task, microtarefas: micro };
    }));
  };

  const toggleExpanded = (taskId) => {
    setExpandedTaskIds((prev) => (prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]));
  };

  const expandAll = () => {
    setExpandedTaskIds(editableTasks.map((task) => task.id));
  };

  const collapseAll = () => {
    setExpandedTaskIds([]);
    setEditingTaskId(null);
  };

  const confirmRemoveTask = () => {
    if (!deleteDialog.taskId) return;
    setEditableTasks((prev) => prev.filter((task) => task.id !== deleteDialog.taskId));
    setExpandedTaskIds((prev) => prev.filter((id) => id !== deleteDialog.taskId));
    setDeleteDialog({ open: false, taskId: null });
    toast.success('Tarefa removida da revisão.');
  };

  const openMergeDialog = (sourceId) => {
    const firstTarget = editableTasks.find((task) => task.id !== sourceId);
    setMergeDialog({ open: true, sourceId, targetId: firstTarget?.id || '' });
  };

  const applyMerge = () => {
    const { sourceId, targetId } = mergeDialog;
    if (!sourceId || !targetId || sourceId === targetId) {
      setMergeDialog({ open: false, sourceId: null, targetId: '' });
      return;
    }

    setEditableTasks((prev) => {
      const source = prev.find((task) => task.id === sourceId);
      const target = prev.find((task) => task.id === targetId);
      if (!source || !target) return prev;

      return prev
        .filter((task) => task.id !== targetId)
        .map((task) => {
          if (task.id !== sourceId) return task;
          return {
            ...task,
            title: `${source.title} + ${target.title}`,
            microtarefas: [...(source.microtarefas || []), ...(target.microtarefas || [])],
            timeEstimate: (source.timeEstimate || 0) + (target.timeEstimate || 0),
            firstStep: source.firstStep || target.firstStep,
            observacoes: [source.observacoes, target.observacoes].filter(Boolean).join(' | ')
          };
        });
    });

    setMergeDialog({ open: false, sourceId: null, targetId: '' });
    toast.success('Tarefas juntadas na revisão.');
  };

  const openMicrotaskDialog = (sourceId) => {
    const firstTarget = editableTasks.find((task) => task.id !== sourceId);
    setMicrotaskDialog({ open: true, sourceId, targetId: firstTarget?.id || '' });
  };

  const applyTransformToMicrotask = () => {
    const { sourceId, targetId } = microtaskDialog;
    if (!sourceId || !targetId || sourceId === targetId) {
      setMicrotaskDialog({ open: false, sourceId: null, targetId: '' });
      return;
    }

    setEditableTasks((prev) => {
      const source = prev.find((task) => task.id === sourceId);
      const target = prev.find((task) => task.id === targetId);
      if (!source || !target) return prev;

      const sourceAsMicro = {
        id: `micro-from-${source.id}`,
        descricao: source.title,
        status: 'não iniciada'
      };

      return prev
        .filter((task) => task.id !== sourceId)
        .map((task) => {
          if (task.id !== targetId) return task;
          return {
            ...task,
            microtarefas: [
              ...(task.microtarefas || []),
              sourceAsMicro,
              ...(source.microtarefas || [])
            ]
          };
        });
    });

    setExpandedTaskIds((prev) => prev.filter((id) => id !== sourceId));
    setMicrotaskDialog({ open: false, sourceId: null, targetId: '' });
    toast.success('Tarefa transformada em microtarefa na revisão.');
  };

  const buildPlanFromEditableTasks = () => {
    const grouped = {
      maxima: [],
      alta: [],
      media: [],
      podeEsperar: [],
      acompanharDepois: [],
      baixa: []
    };

    editableTasks.forEach((task) => {
      const fixedPriority = getPriorityByType(task.taskType, task.priority);
      const priorityGroup = inferPriorityGroup(fixedPriority);
      const normalizedTask = {
        ...task,
        priority: fixedPriority,
        priorityGroup,
        microtarefas: (task.microtarefas || []).filter((m) => String(m.descricao || '').trim()),
        scheduledDate: task.scheduledDate || task.dataSugeridaExecucao || '',
        dataSugeridaExecucao: task.dataSugeridaExecucao || task.scheduledDate || ''
      };

      if (priorityGroup === 'maxima') grouped.maxima.push(normalizedTask);
      else if (priorityGroup === 'alta') grouped.alta.push(normalizedTask);
      else if (priorityGroup === 'acompanharDepois') grouped.acompanharDepois.push(normalizedTask);
      else if (priorityGroup === 'podeEsperar') grouped.podeEsperar.push(normalizedTask);
      else grouped.media.push(normalizedTask);
    });

    grouped.baixa = [...grouped.podeEsperar];
    return grouped;
  };

  const handleCreateTasks = async () => {
    if (!plan) return;
    if (getPlanStatus(plan) !== 'pending') {
      toast.info('Este plano já foi processado.');
      setPlanData(null);
      return;
    }

    const revisedPlan = buildPlanFromEditableTasks();
    const allTasks = getAllPlanTasks(revisedPlan);

    if (allTasks.length === 0) {
      toast.error('Não há tarefas para criar.');
      return;
    }

    setIsProcessing(true);

    try {
      let count = 0;

      for (const t of allTasks) {
        const scheduledDate = t.scheduledDate || t.dataSugeridaExecucao || new Date().toISOString().split('T')[0];
        const scheduledPeriod = t.scheduledPeriod || t.periodoSugerido || 'tarde';

        await pb.collection('tasks').create({
          userId: currentUser?.id,
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

      await pb.collection('planosClareados').update(planData.id, {
        planoGerado: {
          ...plan,
          ...revisedPlan,
          meta: {
            ...(plan?.meta || {}),
            status: 'created',
            updatedAt: new Date().toISOString(),
            reviewed: true,
            reviewedTasksCount: allTasks.length,
            createdTasksCount: count,
            processedAt: new Date().toISOString()
          }
        }
      }, { $autoCancel: false });

      setPlanData(null);
      toast.success(`${count} tarefas criadas com sucesso.`);
      navigate('/');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao criar tarefas.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelCreation = async () => {
    if (!planData?.id) {
      navigate('/criar-plano');
      return;
    }

    setIsProcessing(true);
    try {
      await updatePlanStatus(planData, 'cancelled', { cancelledAt: new Date().toISOString() });
      setPlanData(null);
      toast.success('Criação cancelada. Este plano não será mais exibido para criação.');
      navigate('/criar-plano');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao cancelar criação do plano.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopy = () => {
    if (editableTasks.length === 0) return;

    let copyText = 'Plano Organizado\n\n';
    editableTasks.forEach((t) => {
      copyText += `[ ] ${t.title} (${t.timeEstimate || 0} min)\n`;
      copyText += `    Projeto: ${t.project || 'Pessoal'}\n`;
      copyText += `    Tipo: ${t.taskType || 'administrativo'}\n`;
      copyText += `    Prioridade: ${t.priority || 'Prioridade média'}\n`;
      copyText += `    Quando fazer: ${t.scheduledLabel || t.quandoFazer || 'Esta semana'}\n`;
      copyText += `    Primeira ação: ${t.firstStep || '-'}\n`;
      if (t.microtarefas?.length) {
        t.microtarefas.forEach((m) => {
          copyText += `      - ${m.descricao}\n`;
        });
      }
      copyText += '\n';
    });

    navigator.clipboard.writeText(copyText);
    toast.success('Plano copiado para a área de transferência.');
  };

  const handleEditSource = () => {
    navigate('/criar-plano');
  };

  if (isResolvingPendingPlan) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-10 text-center">
            <p className="text-muted-foreground">Buscando plano pendente...</p>
          </main>
        </div>
        <MobileNav />
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-10 text-center">
            <p className="text-muted-foreground mb-4">Nenhum plano pendente para criar tarefas.</p>
            <Button onClick={() => navigate('/criar-plano')}>Criar novo plano</Button>
          </main>
        </div>
        <MobileNav />
      </div>
    );
  }

  if (showPendingEntry) {
    const taskCount = getAllPlanTasks(plan).length;
    return (
      <>
        <Helmet><title>Plano Clareado - Clareia</title></Helmet>
        <div className="min-h-screen bg-background">
          <Header />
          <div className="flex">
            <Sidebar />
            <main className="flex-1 pb-20 md:pb-8">
              <div className="page-container section-spacing max-w-3xl">
                <Card className="bg-card border-border shadow-sm">
                  <CardContent className="p-8 space-y-4">
                    <h1 className="text-2xl font-medium text-foreground">Plano pendente encontrado</h1>
                    <p className="text-sm text-muted-foreground">
                      Há um plano aguardando revisão com {taskCount} tarefas sugeridas.
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <Button onClick={() => setShowPendingEntry(false)}>
                        Continuar revisão
                      </Button>
                      <Button variant="outline" onClick={() => navigate('/criar-plano')}>
                        Criar novo plano
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </main>
          </div>
          <MobileNav />
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet><title>Revise as tarefas - Clareia</title></Helmet>
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 pb-20 md:pb-8">
            <div className="page-container section-spacing max-w-5xl">
              <div className="mb-8 text-center max-w-3xl mx-auto">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 text-primary mb-4 shadow-sm">
                  <Sparkles className="w-7 h-7" />
                </div>
                <h1 className="text-3xl md:text-4xl font-medium text-foreground mb-3">Revise as tarefas identificadas</h1>
                <p className="text-base md:text-lg text-muted-foreground">
                  Revise em modo compacto. Você pode editar, ver passos, juntar, excluir ou transformar em microtarefa antes de criar.
                </p>
              </div>

              <div className="flex flex-wrap gap-3 mb-6 bg-card p-3 rounded-2xl border border-border shadow-sm justify-center sticky top-[72px] z-30">
                <Button onClick={handleCreateTasks} disabled={isProcessing} className="bg-primary text-primary-foreground hover:bg-primary/90 px-5 rounded-xl">
                  <ListTodo className="w-4 h-4 mr-2" /> Transformar em tarefas
                </Button>
                <Button variant="outline" onClick={handleEditSource} className="rounded-xl">
                  <Edit2 className="w-4 h-4 mr-2" /> Voltar para editar texto original
                </Button>
                <Button variant="outline" onClick={handleCancelCreation} disabled={isProcessing} className="rounded-xl text-destructive hover:bg-destructive/10">
                  Cancelar
                </Button>
                <Button variant="ghost" onClick={handleCopy} className="rounded-xl text-muted-foreground hover:bg-muted">
                  <Copy className="w-4 h-4 mr-2" /> Copiar
                </Button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={expandAll}>
                    <ChevronDown className="w-4 h-4 mr-1" /> Expandir tudo
                  </Button>
                  <Button variant="outline" size="sm" onClick={collapseAll}>
                    <ChevronUp className="w-4 h-4 mr-1" /> Recolher tudo
                  </Button>
                </div>

                {lowStimulationMode && editableTasks.length > 0 && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Tarefa {Math.min(lowStimIndex + 1, editableTasks.length)} de {editableTasks.length}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={lowStimIndex <= 0}
                      onClick={() => setLowStimIndex((prev) => Math.max(0, prev - 1))}
                    >
                      Anterior
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={lowStimIndex >= editableTasks.length - 1}
                      onClick={() => setLowStimIndex((prev) => Math.min(editableTasks.length - 1, prev + 1))}
                    >
                      Próxima
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                {visibleTasks.map((task) => {
                  const expanded = expandedTaskIds.includes(task.id);
                  const editing = editingTaskId === task.id;

                  return (
                    <Card key={task.id} className="bg-card border-border shadow-sm rounded-xl overflow-hidden">
                      <CardContent className="p-4 md:p-5">
                        <div className="space-y-3">
                          <div>
                            <h3 className="text-lg md:text-xl font-medium text-foreground leading-snug w-full">
                              {task.title}
                            </h3>
                          </div>

                          <div className="flex flex-wrap gap-2 text-xs md:text-sm">
                            {lowStimulationMode ? (
                              <span className="text-muted-foreground">
                                {task.project || 'Pessoal'} · {task.taskType || 'administrativo'} · {task.priority || 'Prioridade média'} · {task.timeEstimate || 0} min · {task.scheduledLabel || task.quandoFazer || 'Esta semana'}
                              </span>
                            ) : (
                              <>
                                <span className="px-2 py-1 rounded-full bg-muted border border-border">Projeto: {task.project || 'Pessoal'}</span>
                                <span className="px-2 py-1 rounded-full bg-muted border border-border">Tipo: {task.taskType || 'administrativo'}</span>
                                <span className="px-2 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary">{task.priority || 'Prioridade média'}</span>
                                <span className="px-2 py-1 rounded-full bg-muted border border-border"><Clock className="w-3 h-3 inline mr-1" />{task.timeEstimate || 0} min</span>
                                <span className="px-2 py-1 rounded-full bg-muted border border-border"><Calendar className="w-3 h-3 inline mr-1" />{task.scheduledLabel || task.quandoFazer || 'Esta semana'}</span>
                              </>
                            )}
                          </div>

                          <p className="text-sm text-foreground/90">
                            <span className="font-medium text-muted-foreground">Primeira ação: </span>
                            {task.firstStep || task.microtarefas?.[0]?.descricao || 'Definir o primeiro passo prático'}
                          </p>

                          <div className="flex flex-wrap gap-2 pt-1">
                            <Button size="sm" variant="outline" onClick={() => setEditingTaskId((prev) => (prev === task.id ? null : task.id))}>
                              <Edit2 className="w-3.5 h-3.5 mr-1" /> Editar
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => toggleExpanded(task.id)}>
                              <Layers className="w-3.5 h-3.5 mr-1" /> {expanded ? 'Ocultar passos' : 'Ver passos'}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => openMergeDialog(task.id)} disabled={editableTasks.length < 2}>
                              <Link2 className="w-3.5 h-3.5 mr-1" /> Juntar
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => openMicrotaskDialog(task.id)} disabled={editableTasks.length < 2}>
                              Transformar em microtarefa de...
                            </Button>
                            <Button size="sm" variant="outline" className="text-destructive" onClick={() => setDeleteDialog({ open: true, taskId: task.id })}>
                              <Trash2 className="w-3.5 h-3.5 mr-1" /> Excluir
                            </Button>
                          </div>

                          {editing && (
                            <div className="mt-2 p-3 border border-border rounded-lg bg-muted/30 space-y-3">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="space-y-1 md:col-span-2">
                                  <Label>Título</Label>
                                  <Input value={task.title || ''} onChange={(e) => updateTaskField(task.id, 'title', e.target.value)} />
                                </div>
                                <div className="space-y-1">
                                  <Label>Projeto</Label>
                                  <Input value={task.project || ''} onChange={(e) => updateTaskField(task.id, 'project', e.target.value)} />
                                </div>
                                <div className="space-y-1">
                                  <Label>Tipo</Label>
                                  <Select value={task.taskType || 'administrativo'} onValueChange={(value) => updateTaskField(task.id, 'taskType', value)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      {TASK_TYPE_OPTIONS.map((type) => (
                                        <SelectItem key={type} value={type}>{type}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-1">
                                  <Label>Prioridade</Label>
                                  <Select value={task.priority || 'Prioridade média'} onValueChange={(value) => updateTaskField(task.id, 'priority', value)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      {PRIORITY_OPTIONS.map((priority) => (
                                        <SelectItem key={priority} value={priority}>{priority}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-1">
                                  <Label>Tempo estimado (min)</Label>
                                  <Input
                                    type="number"
                                    value={task.timeEstimate || 30}
                                    onChange={(e) => updateTaskField(task.id, 'timeEstimate', Number(e.target.value) || 30)}
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label>Data sugerida</Label>
                                  <Input
                                    type="date"
                                    value={(task.dataSugeridaExecucao || task.scheduledDate || '').split('T')[0]}
                                    onChange={(e) => {
                                      updateTaskField(task.id, 'dataSugeridaExecucao', e.target.value);
                                      updateTaskField(task.id, 'scheduledDate', e.target.value);
                                    }}
                                  />
                                </div>
                                <div className="space-y-1 md:col-span-2">
                                  <Label>Primeira ação</Label>
                                  <Input value={task.firstStep || ''} onChange={(e) => updateTaskField(task.id, 'firstStep', e.target.value)} />
                                </div>
                              </div>
                            </div>
                          )}

                          {expanded && (
                            <div className="mt-2 p-3 border border-border rounded-lg bg-muted/20 space-y-2">
                              <p className="text-sm font-medium text-foreground">Passos</p>
                              {(task.microtarefas || []).map((mt, idx) => (
                                <div key={mt.id || `${task.id}-${idx}`} className="flex items-start gap-2">
                                  <span className="text-xs text-muted-foreground mt-2">{idx + 1}.</span>
                                  <Textarea
                                    value={mt.descricao || ''}
                                    onChange={(e) => updateMicrotask(task.id, idx, e.target.value)}
                                    className="min-h-[44px]"
                                  />
                                  <Button size="icon" variant="ghost" onClick={() => removeMicrotask(task.id, idx)}>
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              ))}
                              <Button size="sm" variant="outline" onClick={() => addMicrotask(task.id)}>
                                Adicionar passo
                              </Button>
                              {task.taskType === 'acesso sensível' && (
                                <div className="bg-amber-50 border border-amber-200 text-amber-900 text-sm rounded-lg p-3">
                                  {SENSITIVE_WARNING}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </main>
        </div>
        <MobileNav />
      </div>

      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog((prev) => ({ ...prev, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover esta tarefa do plano?</AlertDialogTitle>
            <AlertDialogDescription>
              A tarefa será removida apenas desta revisão e não será criada no final.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemoveTask}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={mergeDialog.open} onOpenChange={(open) => setMergeDialog((prev) => ({ ...prev, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Juntar com outra tarefa</DialogTitle>
            <DialogDescription>
              Escolha a tarefa que será juntada à tarefa principal. Projeto e tipo da tarefa principal serão mantidos.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Escolher tarefa</Label>
            <Select value={mergeDialog.targetId || ''} onValueChange={(value) => setMergeDialog((prev) => ({ ...prev, targetId: value }))}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {mergeCandidates.map((task) => (
                  <SelectItem key={task.id} value={task.id}>{task.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeDialog({ open: false, sourceId: null, targetId: '' })}>Cancelar</Button>
            <Button onClick={applyMerge}>Juntar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={microtaskDialog.open} onOpenChange={(open) => setMicrotaskDialog((prev) => ({ ...prev, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transformar em microtarefa</DialogTitle>
            <DialogDescription>
              A tarefa selecionada deixará de ser independente e virará microtarefa de outra.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Transformar em microtarefa de</Label>
            <Select value={microtaskDialog.targetId || ''} onValueChange={(value) => setMicrotaskDialog((prev) => ({ ...prev, targetId: value }))}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {microtaskCandidates.map((task) => (
                  <SelectItem key={task.id} value={task.id}>{task.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMicrotaskDialog({ open: false, sourceId: null, targetId: '' })}>Cancelar</Button>
            <Button onClick={applyTransformToMicrotask}>Transformar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
