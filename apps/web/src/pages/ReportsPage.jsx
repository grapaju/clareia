import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { BarChart3, Download, FileText, Trash2, Pencil } from 'lucide-react';
import Header from '@/components/Header.jsx';
import Sidebar from '@/components/Sidebar.jsx';
import MobileNav from '@/components/MobileNav.jsx';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { useTaskContext } from '@/hooks/useTaskContext.js';
import { useAuth } from '@/contexts/AuthContext.jsx';
import ManualTimeDialog from '@/components/ManualTimeDialog.jsx';
import { deleteWorkSession, listWorkSessions, updateWorkSession } from '@/services/workSessionService.js';
import { listAllTaskHistory } from '@/services/taskHistoryService.js';
import { listDailyWrapUps } from '@/services/dailyWrapUpService.js';
import { toast } from 'sonner';
import { formatDurationFriendly, pluralizeCount } from '@/lib/reportFormatting.js';
import { normalizeTaskStatus, TASK_STATUS } from '@/lib/taskExecution.js';
import { createProfessionalActivity, listProfessionalJourneys, updateProfessionalActivity } from '@/services/professionalJourneyApiService.js';
import { PROFESSIONAL_CATEGORIES, professionalActivitiesToCsv } from '@/lib/professionalJourneyLogic.js';

function formatDateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('pt-BR');
}

function formatDateInputValue(value) {
  if (!value) return new Date().toISOString().split('T')[0];
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString().split('T')[0];
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString().split('T')[0];
}

function formatDateTimeInputValue(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

export default function ReportsPage() {
  const { currentUser } = useAuth();
  const { tasks } = useTaskContext();
  const [projectFilter, setProjectFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [taskTypeFilter, setTaskTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [journeyStatusFilter, setJourneyStatusFilter] = useState('all');
  const [professionalData, setProfessionalData] = useState({ journeys: [], activities: [], edits: [] });
  const [isManualTimeOpen, setIsManualTimeOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState(null);
  const [editingSession, setEditingSession] = useState(null);
  const [editingProfessionalActivity, setEditingProfessionalActivity] = useState(null);
  const [professionalEditForm, setProfessionalEditForm] = useState({
    title: '', category: 'Outro', startedAt: '', endedAt: '', notes: '', reason: '',
  });
  const [editSessionForm, setEditSessionForm] = useState({
    projectId: '',
    startedAtDate: '',
    durationMinutes: '',
    notes: ''
  });

  const [sessionVersion, setSessionVersion] = useState(0);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  useEffect(() => {
    if (!currentUser?.id) return;
    listProfessionalJourneys()
      .then((data) => setProfessionalData(data || { journeys: [], activities: [], edits: [] }))
      .catch(() => setProfessionalData({ journeys: [], activities: [], edits: [] }));
  }, [currentUser?.id, sessionVersion]);

  const escapeCsv = (value) => {
    const text = String(value ?? '');
    if (text.includes('"') || text.includes(';') || text.includes('\n')) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  const allSessions = useMemo(() => listWorkSessions(), [sessionVersion]);
  const allHistory = useMemo(() => listAllTaskHistory(), [sessionVersion]);
  const allWrapUps = useMemo(() => listDailyWrapUps(currentUser?.id), [sessionVersion, currentUser?.id]);

  const taskById = useMemo(() => {
    const map = new Map();
    tasks.forEach((task) => map.set(task.id, task));
    return map;
  }, [tasks]);

  const projectOptions = useMemo(() => {
    const set = new Set(['Pessoal']);
    tasks.forEach((task) => set.add(task.project || 'Pessoal'));
    allSessions.forEach((session) => set.add(session.projectId || 'Pessoal'));
    professionalData.journeys.forEach((journey) => set.add(journey.projectName));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [tasks, allSessions, professionalData.journeys]);

  const professionalJourneyRows = useMemo(() => professionalData.journeys.filter((journey) => {
    if (projectFilter !== 'all' && journey.projectName !== projectFilter) return false;
    if (startDate && new Date(journey.endedAt || Date.now()) < new Date(`${startDate}T00:00:00`)) return false;
    if (endDate && new Date(journey.startedAt) > new Date(`${endDate}T23:59:59`)) return false;
    if (journeyStatusFilter !== 'all' && journey.status !== journeyStatusFilter) return false;
    return true;
  }), [professionalData.journeys, projectFilter, startDate, endDate, journeyStatusFilter]);

  const professionalJourneyIds = useMemo(() => new Set(professionalJourneyRows.map((journey) => journey.id)), [professionalJourneyRows]);
  const professionalRows = useMemo(() => professionalData.activities.filter((activity) => {
    if (!professionalJourneyIds.has(activity.journeyId)) return false;
    if (categoryFilter !== 'all' && activity.category !== categoryFilter) return false;
    if (sourceFilter !== 'all' && activity.source !== sourceFilter) return false;
    return true;
  }), [professionalData.activities, professionalJourneyIds, categoryFilter, sourceFilter]);

  const professionalTotals = useMemo(() => {
    const categoryMinutes = professionalRows.reduce((totalsByCategory, activity) => {
      totalsByCategory[activity.category] = (totalsByCategory[activity.category] || 0) + Number(activity.durationMinutes || 0);
      return totalsByCategory;
    }, {});
    return {
      netMinutes: professionalJourneyRows.reduce((total, journey) => total + Number(journey.netMinutes || 0), 0),
      classifiedMinutes: professionalRows.reduce((total, activity) => total + Number(activity.durationMinutes || 0), 0),
      unclassifiedMinutes: professionalJourneyRows.reduce((total, journey) => total + Number(journey.unclassifiedMinutes || 0), 0),
      categoryMinutes,
    };
  }, [professionalJourneyRows, professionalRows]);

  const taskTypeOptions = useMemo(() => {
    const set = new Set();
    tasks.forEach((task) => {
      if (task.taskType) set.add(task.taskType);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [tasks]);

  const sessionRows = useMemo(() => {
    return allSessions
      .map((session) => {
        const task = session.taskId ? taskById.get(session.taskId) : null;
        return {
          ...session,
          taskTitle: task?.title || 'Sem tarefa',
          taskType: task?.taskType || 'Sem tipo',
          taskStatus: task ? normalizeTaskStatus(task.status) : 'sem_status'
        };
      })
      .filter((session) => {
        if (projectFilter !== 'all' && (session.projectId || 'Pessoal') !== projectFilter) return false;
        if (startDate && new Date(session.startedAt) < new Date(`${startDate}T00:00:00`)) return false;
        if (endDate && new Date(session.startedAt) > new Date(`${endDate}T23:59:59`)) return false;
        if (taskTypeFilter !== 'all' && session.taskType !== taskTypeFilter) return false;
        if (statusFilter !== 'all' && session.taskStatus !== statusFilter) return false;
        return true;
      });
  }, [allSessions, taskById, projectFilter, startDate, endDate, taskTypeFilter, statusFilter]);

  const completedEvents = useMemo(() => {
    return allHistory.filter((event) => {
      if (event.type !== 'task_completed') return false;
      if (projectFilter !== 'all' && event.projectId !== projectFilter) return false;
      if (startDate && new Date(event.createdAt) < new Date(`${startDate}T00:00:00`)) return false;
      if (endDate && new Date(event.createdAt) > new Date(`${endDate}T23:59:59`)) return false;
      if (taskTypeFilter !== 'all') {
        const task = taskById.get(event.taskId);
        if (!task || task.taskType !== taskTypeFilter) return false;
      }
      if (statusFilter !== 'all') {
        if (statusFilter !== TASK_STATUS.CONCLUIDA) return false;
      }
      return true;
    });
  }, [allHistory, projectFilter, startDate, endDate, taskTypeFilter, statusFilter, taskById]);

  const totals = useMemo(() => {
    const totalMinutes = sessionRows.reduce((sum, item) => sum + Number(item.durationMinutes || 0), 0);
    const completedTaskIds = new Set(completedEvents.map((event) => event.taskId));
    const workedProjects = new Set(sessionRows.map((item) => item.projectId || 'Pessoal'));

    return {
      totalMinutes,
      completedTasks: completedTaskIds.size,
      sessions: sessionRows.length,
      projectsWorked: workedProjects.size
    };
  }, [sessionRows, completedEvents]);

  const wrapUpRows = useMemo(() => {
    return allWrapUps.filter((item) => {
      if (startDate && new Date(`${item.date}T00:00:00`) < new Date(`${startDate}T00:00:00`)) return false;
      if (endDate && new Date(`${item.date}T23:59:59`) > new Date(`${endDate}T23:59:59`)) return false;
      return true;
    });
  }, [allWrapUps, startDate, endDate]);

  const wrapUpTotals = useMemo(() => {
    const daysClosed = wrapUpRows.length;
    const declaredHours = wrapUpRows.reduce((sum, item) => sum + Number(item.loggedHours || 0), 0);
    const withImprovements = wrapUpRows.filter((item) => String(item.improvementIdea || '').trim()).length;
    const withWaitingReturn = wrapUpRows.filter((item) => String(item.waitingReturn || '').trim()).length;

    return {
      daysClosed,
      declaredHours,
      withImprovements,
      withWaitingReturn
    };
  }, [wrapUpRows]);

  const perProjectRows = useMemo(() => {
    const accumulator = {};

    sessionRows.forEach((session) => {
      const key = session.projectId || 'Pessoal';
      if (!accumulator[key]) {
        accumulator[key] = {
          project: key,
          minutes: 0,
          sessions: 0,
          completedTaskIds: new Set()
        };
      }

      accumulator[key].minutes += Number(session.durationMinutes || 0);
      accumulator[key].sessions += 1;
    });

    completedEvents.forEach((event) => {
      const key = event.projectId || 'Pessoal';
      if (!accumulator[key]) {
        accumulator[key] = {
          project: key,
          minutes: 0,
          sessions: 0,
          completedTaskIds: new Set()
        };
      }
      accumulator[key].completedTaskIds.add(event.taskId);
    });

    return Object.values(accumulator)
      .map((item) => ({
        project: item.project,
        minutes: item.minutes,
        sessions: item.sessions,
        tasksDone: item.completedTaskIds.size
      }))
      .sort((a, b) => b.minutes - a.minutes);
  }, [sessionRows, completedEvents]);

  const handleDeleteSession = () => {
    if (!sessionToDelete?.id) return;
    deleteWorkSession(sessionToDelete.id);
    setSessionToDelete(null);
    setSessionVersion((value) => value + 1);
    toast.success('Sessão removida.');
  };

  const openEditSession = (session) => {
    if (!session?.id) return;
    setEditingSession(session);
    setEditSessionForm({
      projectId: session.projectId || 'Pessoal',
      startedAtDate: formatDateInputValue(session.startedAt),
      durationMinutes: Number(session.durationMinutes || 0),
      notes: session.notes || ''
    });
  };

  const handleSaveSessionEdit = () => {
    if (!editingSession?.id) return;

    const durationMinutes = Number(editSessionForm.durationMinutes || 0);
    if (durationMinutes <= 0) {
      toast.error('Informe uma duração válida em minutos.');
      return;
    }

    const startedAt = `${editSessionForm.startedAtDate}T09:00:00.000Z`;
    const endedAt = new Date(new Date(startedAt).getTime() + durationMinutes * 60000).toISOString();

    updateWorkSession(editingSession.id, {
      projectId: editSessionForm.projectId,
      startedAt,
      endedAt,
      durationMinutes,
      notes: editSessionForm.notes
    });

    setEditingSession(null);
    setSessionVersion((value) => value + 1);
    toast.success('Sessão atualizada.');
  };

  const openProfessionalEdit = (activity) => {
    setEditingProfessionalActivity(activity);
    setProfessionalEditForm({
      title: activity.title,
      category: activity.category || 'Outro',
      startedAt: formatDateTimeInputValue(activity.startedAt),
      endedAt: formatDateTimeInputValue(activity.endedAt),
      notes: activity.notes || '',
      reason: '',
    });
  };

  const handleSaveProfessionalEdit = async () => {
    if (!editingProfessionalActivity?.id || !professionalEditForm.reason.trim()) {
      toast.error('Informe o motivo da correção.');
      return;
    }
    try {
      await updateProfessionalActivity(editingProfessionalActivity.id, {
        title: professionalEditForm.title,
        category: professionalEditForm.category,
        startedAt: new Date(professionalEditForm.startedAt).toISOString(),
        endedAt: new Date(professionalEditForm.endedAt).toISOString(),
        notes: professionalEditForm.notes,
        reason: professionalEditForm.reason,
      });
      setEditingProfessionalActivity(null);
      setSessionVersion((value) => value + 1);
      toast.success('Atividade corrigida com histórico preservado.');
    } catch (error) {
      toast.error(error?.message || 'Não foi possível corrigir a atividade.');
    }
  };

  const handleExportCsv = () => {
    if (professionalRows.length > 0) {
      const csvContent = professionalActivitiesToCsv(professionalRows, Intl.DateTimeFormat().resolvedOptions().timeZone);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `clareia-jornada-profissional-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('CSV profissional exportado com sucesso.');
      return;
    }
    const header = [
      'Data',
      'Projeto',
      'Tarefa',
      'Tempo (min)',
      'Tempo (legivel)',
      'Origem',
      'Observacao'
    ];

    const lines = [header.join(';')];

    sessionRows.forEach((session) => {
      lines.push([
        escapeCsv(formatDateTime(session.startedAt)),
        escapeCsv(session.projectId || 'Pessoal'),
        escapeCsv(session.taskTitle || 'Sem tarefa'),
        escapeCsv(Number(session.durationMinutes || 0)),
        escapeCsv(formatDurationFriendly(session.durationMinutes)),
        escapeCsv(session.source === 'manual' ? 'manual' : 'timer'),
        escapeCsv(session.notes || '')
      ].join(';'));
    });

    if (sessionRows.length === 0) {
      lines.push('Sem dados;Sem dados;Sem dados;0;0 min;Sem dados;Sem observacao');
    }

    const csvContent = lines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `clareia-relatorio-horas-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('CSV exportado com sucesso.');
  };

  const handleCopySummary = async () => {
    const lines = [
      'Resumo de horas - Clareia',
      `Periodo: ${startDate || 'inicio'} ate ${endDate || 'hoje'}`,
      `Projeto: ${projectFilter === 'all' ? 'Todos' : projectFilter}`,
      '',
      `Total de horas: ${formatDurationFriendly(totals.totalMinutes)}`,
      pluralizeCount(totals.completedTasks, 'tarefa concluída', 'tarefas concluídas'),
      pluralizeCount(totals.sessions, 'sessão registrada', 'sessões registradas'),
      `Projetos com horas registradas: ${totals.projectsWorked}`,
      '',
      'Total por projeto:'
    ];

    if (perProjectRows.length === 0) {
      lines.push('- Sem dados no periodo.');
    } else {
      perProjectRows.forEach((row) => {
        lines.push(`- ${row.project}: ${formatDurationFriendly(row.minutes)} | ${pluralizeCount(row.tasksDone, 'tarefa concluída', 'tarefas concluídas')} | ${pluralizeCount(row.sessions, 'sessão', 'sessões')}`);
      });
    }

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      toast.success('Resumo copiado para a area de transferencia.');
    } catch (error) {
      console.error(error);
      toast.error('Nao foi possivel copiar o resumo.');
    }
  };

  const handleExportPdf = async () => {
    setIsExportingPdf(true);
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const marginX = 14;
      const lineHeight = 6;
      const contentWidth = pageWidth - marginX * 2;
      let cursorY = 16;

      const ensureSpace = (neededHeight = lineHeight) => {
        if (cursorY + neededHeight <= pageHeight - 14) return;
        doc.addPage();
        cursorY = 16;
      };

      const writeLine = (text, options = {}) => {
        const fontSize = options.fontSize || 10;
        const isBold = Boolean(options.bold);
        doc.setFont('helvetica', isBold ? 'bold' : 'normal');
        doc.setFontSize(fontSize);

        const lines = doc.splitTextToSize(String(text || ''), contentWidth);
        const blockHeight = Math.max(lineHeight, lines.length * (fontSize * 0.4 + 1.5));
        ensureSpace(blockHeight + 1);
        doc.text(lines, marginX, cursorY);
        cursorY += blockHeight;
      };

      const divider = () => {
        ensureSpace(4);
        doc.setDrawColor(220);
        doc.line(marginX, cursorY, pageWidth - marginX, cursorY);
        cursorY += 4;
      };

      writeLine('Relatório de horas - Clareia', { fontSize: 16, bold: true });
      writeLine(`Gerado em: ${new Date().toLocaleString('pt-BR')}`);
      writeLine(`Período: ${startDate || 'início'} até ${endDate || 'hoje'}`);
      writeLine(`Projeto: ${projectFilter === 'all' ? 'Todos' : projectFilter}`);
      writeLine(`Tipo de tarefa: ${taskTypeFilter === 'all' ? 'Todos' : taskTypeFilter}`);
      writeLine(`Status: ${statusFilter === 'all' ? 'Todos' : statusFilter}`);

      if (professionalJourneyRows.length > 0) {
        divider();
        writeLine('Jornada profissional', { fontSize: 12, bold: true });
        writeLine(`Período líquido trabalhado: ${formatDurationFriendly(professionalTotals.netMinutes)}`);
        writeLine(`Tempo associado a atividades: ${formatDurationFriendly(professionalTotals.classifiedMinutes)}`);
        writeLine(`Tempo sem atividade associada: ${formatDurationFriendly(professionalTotals.unclassifiedMinutes)}`);
        Object.entries(professionalTotals.categoryMinutes).forEach(([category, minutes]) => {
          writeLine(`${category}: ${formatDurationFriendly(minutes)}`);
        });
        writeLine('Principais atividades', { bold: true });
        [...new Set(professionalRows.map((activity) => activity.title))].forEach((title) => writeLine(`- ${title}`));
      }

      divider();
      writeLine('Resumo executivo', { fontSize: 12, bold: true });
      writeLine(`Total de horas: ${formatDurationFriendly(totals.totalMinutes)}`);
      writeLine(pluralizeCount(totals.completedTasks, 'tarefa concluída', 'tarefas concluídas'));
      writeLine(pluralizeCount(totals.sessions, 'sessão registrada', 'sessões registradas'));
      writeLine(`Projetos com horas registradas: ${totals.projectsWorked}`);

      divider();
      writeLine('Total por projeto', { fontSize: 12, bold: true });
      if (perProjectRows.length === 0) {
        writeLine('Sem dados no período selecionado.');
      } else {
        perProjectRows.forEach((row) => {
          writeLine(`${row.project} - ${formatDurationFriendly(row.minutes)} - ${pluralizeCount(row.tasksDone, 'tarefa concluída', 'tarefas concluídas')} - ${pluralizeCount(row.sessions, 'sessão', 'sessões')}`);
        });
      }

      divider();
      writeLine('Sessões registradas', { fontSize: 12, bold: true });
      if (sessionRows.length === 0) {
        writeLine('Nenhuma sessão encontrada para os filtros atuais.');
      } else {
        sessionRows.forEach((session, index) => {
          writeLine(`${index + 1}. ${formatDateTime(session.startedAt)} | ${session.projectId || 'Pessoal'} | ${session.taskTitle || 'Sem tarefa'} | ${formatDurationFriendly(session.durationMinutes)} | ${session.source === 'manual' ? 'manual' : 'timer'}`, { bold: true });
          writeLine(`Observação: ${session.notes || '-'}`);
          cursorY += 1;
        });
      }

      doc.save(`clareia-relatorio-horas-${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success('PDF exportado com sucesso.');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao exportar PDF.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <>
      <Helmet><title>Relatórios - Clareia</title></Helmet>
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="min-w-0 flex-1 pb-20 md:pb-8">
            <div className="page-container section-spacing max-w-6xl space-y-6">
              <div className="flex items-center gap-3">
                <BarChart3 className="w-8 h-8 text-primary" />
                <div>
                  <h1 className="text-3xl font-medium text-foreground">Relatório de horas</h1>
                  <p className="text-sm text-muted-foreground">Visão consolidada por projeto para controle interno e envio ao cliente.</p>
                </div>
              </div>

              <Card className="bg-card border-border shadow-sm">
                <CardContent className="p-6 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <Label>Projeto</Label>
                      <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
                        <option value="all">Todos</option>
                        {projectOptions.map((project) => <option key={project} value={project}>{project}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label>Período inicial</Label>
                      <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label>Período final</Label>
                      <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label>Tipo de tarefa</Label>
                      <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={taskTypeFilter} onChange={(event) => setTaskTypeFilter(event.target.value)}>
                        <option value="all">Todos</option>
                        {taskTypeOptions.map((type) => <option key={type} value={type}>{type}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label>Status</Label>
                      <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                        <option value="all">Todos</option>
                        <option value="pendente">Pendente</option>
                        <option value="em_andamento">Em andamento</option>
                        <option value="pausada">Pausada</option>
                        <option value="aguardando_retorno">Aguardando retorno</option>
                        <option value="concluida">Concluída</option>
                        <option value="arquivada">Arquivada</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label>Categoria profissional</Label>
                      <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                        <option value="all">Todas</option>
                        {PROFESSIONAL_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label>Origem</Label>
                      <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}>
                        <option value="all">Todas</option>
                        <option value="task">Tarefa</option>
                        <option value="quick">Atividade rápida</option>
                        <option value="manual">Manual</option>
                        <option value="timer">Timer</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label>Estado da jornada</Label>
                      <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={journeyStatusFilter} onChange={(event) => setJourneyStatusFilter(event.target.value)}>
                        <option value="all">Todos</option>
                        <option value="active">Em andamento</option>
                        <option value="paused">Pausada</option>
                        <option value="closed">Encerrada</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => setIsManualTimeOpen(true)}>Adicionar tempo manual</Button>
                    <Button variant="outline" onClick={handleExportCsv}>
                      <Download className="w-4 h-4 mr-2" /> Exportar CSV
                    </Button>
                    <Button variant="outline" onClick={handleExportPdf} disabled={isExportingPdf}>
                      <FileText className="w-4 h-4 mr-2" /> {isExportingPdf ? 'Gerando PDF...' : 'Exportar PDF'}
                    </Button>
                    <Button variant="outline" onClick={handleCopySummary}>
                      Copiar resumo
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {professionalJourneyRows.length > 0 && (
                <section className="space-y-4" aria-labelledby="professional-report-title">
                  <div>
                    <h2 id="professional-report-title" className="text-lg font-medium text-foreground">Jornada profissional</h2>
                    <p className="text-sm text-muted-foreground">Período líquido e atividades registradas no servidor.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Tempo trabalhado</p><p className="text-2xl font-medium">{formatDurationFriendly(professionalTotals.netMinutes)}</p></CardContent></Card>
                    <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Em atividades</p><p className="text-2xl font-medium">{formatDurationFriendly(professionalTotals.classifiedMinutes)}</p></CardContent></Card>
                    <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Sem atividade</p><p className="text-2xl font-medium">{formatDurationFriendly(professionalTotals.unclassifiedMinutes)}</p></CardContent></Card>
                    <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Jornadas</p><p className="text-2xl font-medium">{professionalJourneyRows.length}</p></CardContent></Card>
                  </div>
                  <Card>
                    <CardContent className="p-6">
                      <h3 className="font-medium text-foreground">Por categoria</h3>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {Object.entries(professionalTotals.categoryMinutes).map(([category, minutes]) => (
                          <div key={category} className="flex items-center justify-between border-b border-border py-2 text-sm"><span>{category}</span><span className="text-muted-foreground">{formatDurationFriendly(minutes)}</span></div>
                        ))}
                      </div>
                      <h3 className="mt-6 font-medium text-foreground">Atividades reais</h3>
                      <div className="mt-2 divide-y divide-border">
                        {professionalRows.map((activity) => (
                          <div key={activity.id} className="grid gap-1 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
                            <div className="min-w-0"><p className="truncate text-sm font-medium">{activity.title}</p><p className="text-xs text-muted-foreground">{activity.projectName} · {activity.category} · {activity.source === 'manual' ? 'manual' : activity.source === 'task' ? 'tarefa' : 'atividade rápida'}</p></div>
                            <p className="text-sm text-muted-foreground">{formatDurationFriendly(activity.durationMinutes)}</p>
                            {activity.endedAt && <Button size="icon" variant="ghost" aria-label={`Corrigir ${activity.title}`} onClick={() => openProfessionalEdit(activity)}><Pencil className="h-4 w-4" /></Button>}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </section>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card className="bg-card border-border"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total de horas</p><p className="text-2xl font-medium">{formatDurationFriendly(totals.totalMinutes)}</p></CardContent></Card>
                <Card className="bg-card border-border"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Tarefas concluídas</p><p className="text-2xl font-medium">{totals.completedTasks}</p></CardContent></Card>
                <Card className="bg-card border-border"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Sessões registradas</p><p className="text-2xl font-medium">{totals.sessions}</p></CardContent></Card>
                <Card className="bg-card border-border"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Projetos com horas registradas</p><p className="text-2xl font-medium">{totals.projectsWorked}</p></CardContent></Card>
              </div>

              <Card className="bg-card border-border shadow-sm">
                <CardContent className="p-6 space-y-3">
                  <h2 className="text-lg font-medium text-foreground">Total por projeto</h2>
                  {perProjectRows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sem dados no período selecionado.</p>
                  ) : (
                    <div className="space-y-2">
                      {perProjectRows.map((row) => (
                        <div key={row.project} className="rounded-lg border border-border p-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-sm font-medium text-foreground">{row.project}</p>
                          <p className="text-sm text-muted-foreground">{formatDurationFriendly(row.minutes)} - {pluralizeCount(row.tasksDone, 'tarefa concluída', 'tarefas concluídas')} - {pluralizeCount(row.sessions, 'sessão', 'sessões')}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-card border-border shadow-sm">
                <CardContent className="p-6 space-y-3">
                  <h2 className="text-lg font-medium text-foreground">Sessões registradas</h2>
                  {sessionRows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhuma sessão encontrada para os filtros atuais.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border text-left text-muted-foreground">
                            <th className="py-2 pr-3">Data</th>
                            <th className="py-2 pr-3">Projeto</th>
                            <th className="py-2 pr-3">Tarefa</th>
                            <th className="py-2 pr-3">Tempo</th>
                            <th className="py-2 pr-3">Origem</th>
                            <th className="py-2 pr-3">Observação</th>
                            <th className="py-2 text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sessionRows.map((session) => (
                            <tr key={session.id} className="border-b border-border/60">
                              <td className="py-2 pr-3">{formatDateTime(session.startedAt)}</td>
                              <td className="py-2 pr-3">{session.projectId || 'Pessoal'}</td>
                              <td className="py-2 pr-3">{session.taskTitle}</td>
                              <td className="py-2 pr-3">{formatDurationFriendly(session.durationMinutes)}</td>
                              <td className="py-2 pr-3">{session.source === 'manual' ? 'manual' : 'timer'}</td>
                              <td className="py-2 pr-3">{session.notes || '-'}</td>
                              <td className="py-2 text-right">
                                <div className="flex justify-end gap-2">
                                  <Button size="sm" variant="outline" onClick={() => openEditSession(session)}>
                                    <Pencil className="w-4 h-4" />
                                  </Button>
                                  <Button size="sm" variant="outline" className="text-destructive" onClick={() => setSessionToDelete(session)}>
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-card border-border shadow-sm">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-lg font-medium text-foreground">Encerramento diário</h2>
                    <p className="text-xs text-muted-foreground">Ritual de fechamento e continuidade operacional</p>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Card className="bg-background border-border"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Dias encerrados</p><p className="text-2xl font-medium text-foreground">{wrapUpTotals.daysClosed}</p></CardContent></Card>
                    <Card className="bg-background border-border"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Horas declaradas</p><p className="text-2xl font-medium text-foreground">{wrapUpTotals.declaredHours.toFixed(1)}h</p></CardContent></Card>
                    <Card className="bg-background border-border"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Com melhorias registradas</p><p className="text-2xl font-medium text-foreground">{wrapUpTotals.withImprovements}</p></CardContent></Card>
                    <Card className="bg-background border-border"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Com aguardando retorno</p><p className="text-2xl font-medium text-foreground">{wrapUpTotals.withWaitingReturn}</p></CardContent></Card>
                  </div>

                  {wrapUpRows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum encerramento encontrado no período selecionado.</p>
                  ) : (
                    <div className="space-y-3">
                      {wrapUpRows.slice(0, 15).map((row) => (
                        <div key={row.id} className="rounded-xl border border-border p-4 bg-background space-y-2">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                            <p className="text-sm font-medium text-foreground">{new Date(`${row.date}T12:00:00`).toLocaleDateString('pt-BR')}</p>
                            <p className="text-xs text-muted-foreground">Criado em {formatDateTime(row.createdAt)}</p>
                          </div>
                          {row.concluded && <p className="text-sm text-foreground"><span className="font-medium">Concluído:</span> {row.concluded}</p>}
                          {row.paused && <p className="text-sm text-foreground"><span className="font-medium">Pausado:</span> {row.paused}</p>}
                          {row.waitingReturn && <p className="text-sm text-foreground"><span className="font-medium">Aguardando retorno:</span> {row.waitingReturn}</p>}
                          {row.improvementIdea && <p className="text-sm text-foreground"><span className="font-medium">Melhoria guardada:</span> {row.improvementIdea}</p>}
                          {Number(row.loggedHours || 0) > 0 && (
                            <p className="text-sm text-foreground"><span className="font-medium">Horas registradas:</span> {Number(row.loggedHours || 0).toFixed(1)}h</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
        <MobileNav />
      </div>

      <ManualTimeDialog
        isOpen={isManualTimeOpen}
        onOpenChange={setIsManualTimeOpen}
        defaultProject={projectFilter === 'all' ? 'Pessoal' : projectFilter}
        defaultTaskId="none"
        tasks={tasks}
        professionalJourneys={professionalData.journeys}
        onSaveProfessional={async ({ journeyId, ...payload }) => {
          await createProfessionalActivity(journeyId, payload);
          setSessionVersion((value) => value + 1);
        }}
        onSaved={() => setSessionVersion((value) => value + 1)}
      />

      <AlertDialog open={Boolean(sessionToDelete)} onOpenChange={(open) => !open && setSessionToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir sessão?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove o registro de tempo permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSession} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir sessão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={Boolean(editingSession)} onOpenChange={(open) => !open && setEditingSession(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar sessão</DialogTitle>
            <DialogDescription>Atualize data, projeto, duração e observação.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Projeto</Label>
              <Input value={editSessionForm.projectId} onChange={(event) => setEditSessionForm((current) => ({ ...current, projectId: event.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Data</Label>
                <Input type="date" value={editSessionForm.startedAtDate} onChange={(event) => setEditSessionForm((current) => ({ ...current, startedAtDate: event.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Duração (min)</Label>
                <Input type="number" min={1} value={editSessionForm.durationMinutes} onChange={(event) => setEditSessionForm((current) => ({ ...current, durationMinutes: event.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Observação</Label>
              <Input value={editSessionForm.notes} onChange={(event) => setEditSessionForm((current) => ({ ...current, notes: event.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingSession(null)}>Cancelar</Button>
            <Button onClick={handleSaveSessionEdit}>Salvar alterações</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editingProfessionalActivity)} onOpenChange={(open) => !open && setEditingProfessionalActivity(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Corrigir atividade</DialogTitle><DialogDescription>A versão anterior será preservada no histórico de auditoria.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Atividade</Label><Input value={professionalEditForm.title} onChange={(event) => setProfessionalEditForm((current) => ({ ...current, title: event.target.value }))} /></div>
            <div className="space-y-1"><Label>Categoria</Label><select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={professionalEditForm.category} onChange={(event) => setProfessionalEditForm((current) => ({ ...current, category: event.target.value }))}>{PROFESSIONAL_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}</select></div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1"><Label>Início</Label><Input type="datetime-local" value={professionalEditForm.startedAt} onChange={(event) => setProfessionalEditForm((current) => ({ ...current, startedAt: event.target.value }))} /></div>
              <div className="space-y-1"><Label>Fim</Label><Input type="datetime-local" value={professionalEditForm.endedAt} onChange={(event) => setProfessionalEditForm((current) => ({ ...current, endedAt: event.target.value }))} /></div>
            </div>
            <div className="space-y-1"><Label>Observação</Label><Input value={professionalEditForm.notes} onChange={(event) => setProfessionalEditForm((current) => ({ ...current, notes: event.target.value }))} /></div>
            <div className="space-y-1"><Label>Motivo da correção</Label><Input value={professionalEditForm.reason} onChange={(event) => setProfessionalEditForm((current) => ({ ...current, reason: event.target.value }))} placeholder="Ex.: esqueci de encerrar no horário" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEditingProfessionalActivity(null)}>Cancelar</Button><Button onClick={handleSaveProfessionalEdit}>Salvar correção</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
