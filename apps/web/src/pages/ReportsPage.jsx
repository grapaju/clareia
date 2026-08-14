import React, { useMemo, useState } from 'react';
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

function formatDurationFriendly(minutes) {
  const safeMinutes = Math.max(0, Number(minutes || 0));
  if (safeMinutes < 60) return `${safeMinutes} min`;
  const hours = Math.floor(safeMinutes / 60);
  const remainingMinutes = safeMinutes % 60;
  if (remainingMinutes === 0) return `${hours}h`;
  return `${hours}h${remainingMinutes}`;
}

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

export default function ReportsPage() {
  const { currentUser } = useAuth();
  const { tasks } = useTaskContext();
  const [projectFilter, setProjectFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [taskTypeFilter, setTaskTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isManualTimeOpen, setIsManualTimeOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState(null);
  const [editingSession, setEditingSession] = useState(null);
  const [editSessionForm, setEditSessionForm] = useState({
    projectId: '',
    startedAtDate: '',
    durationMinutes: '',
    notes: ''
  });

  const [sessionVersion, setSessionVersion] = useState(0);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

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
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [tasks, allSessions]);

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
          taskStatus: task?.status || 'Sem status'
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
        const task = taskById.get(event.taskId);
        if (!task || task.status !== statusFilter) return false;
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

  const handleExportCsv = () => {
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
      `Tarefas concluidas: ${totals.completedTasks}`,
      `Sessoes registradas: ${totals.sessions}`,
      `Projetos trabalhados: ${totals.projectsWorked}`,
      '',
      'Total por projeto:'
    ];

    if (perProjectRows.length === 0) {
      lines.push('- Sem dados no periodo.');
    } else {
      perProjectRows.forEach((row) => {
        lines.push(`- ${row.project}: ${formatDurationFriendly(row.minutes)} | ${row.tasksDone} tarefas concluidas | ${row.sessions} sessoes`);
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

      divider();
      writeLine('Resumo executivo', { fontSize: 12, bold: true });
      writeLine(`Total de horas: ${formatDurationFriendly(totals.totalMinutes)}`);
      writeLine(`Tarefas concluídas: ${totals.completedTasks}`);
      writeLine(`Sessões registradas: ${totals.sessions}`);
      writeLine(`Projetos trabalhados: ${totals.projectsWorked}`);

      divider();
      writeLine('Total por projeto', { fontSize: 12, bold: true });
      if (perProjectRows.length === 0) {
        writeLine('Sem dados no período selecionado.');
      } else {
        perProjectRows.forEach((row) => {
          writeLine(`${row.project} - ${formatDurationFriendly(row.minutes)} - ${row.tasksDone} tarefas concluídas - ${row.sessions} sessões`);
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
          <main className="flex-1 pb-20 md:pb-8">
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
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
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
                        <option value="Hoje">Hoje</option>
                        <option value="Esta semana">Esta semana</option>
                        <option value="Pendente">Pendente</option>
                        <option value="Fazendo">Fazendo</option>
                        <option value="Concluída">Concluída</option>
                        <option value="Backlog">Arquivada</option>
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

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card className="bg-card border-border"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total de horas</p><p className="text-2xl font-medium">{formatDurationFriendly(totals.totalMinutes)}</p></CardContent></Card>
                <Card className="bg-card border-border"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Tarefas concluídas</p><p className="text-2xl font-medium">{totals.completedTasks}</p></CardContent></Card>
                <Card className="bg-card border-border"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Sessões registradas</p><p className="text-2xl font-medium">{totals.sessions}</p></CardContent></Card>
                <Card className="bg-card border-border"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Projetos trabalhados</p><p className="text-2xl font-medium">{totals.projectsWorked}</p></CardContent></Card>
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
                          <p className="text-sm text-muted-foreground">{formatDurationFriendly(row.minutes)} - {row.tasksDone} tarefas concluídas - {row.sessions} sessões</p>
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
    </>
  );
}
