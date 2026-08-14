
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useTaskContext } from '@/hooks/useTaskContext.js';
import { toast } from 'sonner';
import MicrotaskEditor from './MicrotaskEditor.jsx';
import { normalizeMicrotasks } from '@/lib/taskExecution.js';
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

const TASK_TYPES = ['Cobrança', 'Reunião', 'Desenvolvimento', 'Site', 'Google Ads', 'Atendimento', 'Administrativo', 'Pessoal'];
const PERIODS = ['Manhã', 'Tarde', 'Noite', 'Horário específico'];
const IMPORTANCE_URGENCY = ['Baixa', 'Média', 'Alta'];
const STATUSES = ['pendente', 'em_andamento', 'pausada', 'concluida', 'aguardando_retorno', 'arquivada'];
const EXECUTION_DIFFICULTIES = ['Rápida', 'Direta', 'Exige foco', 'Tem atrito', 'Grande demais'];
const RECURRENCE_FREQUENCIES = ['Nenhuma', 'Semanal', 'Mensal'];

export default function EditTaskModal({ task, isOpen, onClose }) {
  const { updateTask, deleteTask, refreshTasks } = useTaskContext();
  const [formData, setFormData] = useState({});
  const [isDirty, setIsDirty] = useState(false);
  const [showCancelAlert, setShowCancelAlert] = useState(false);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);

  useEffect(() => {
    if (task && isOpen) {
      setFormData({
        title: task.title || '',
        project: task.project || '',
        taskType: task.taskType || 'Desenvolvimento',
        nextAction: task.nextAction || '',
        timeEstimate: task.timeEstimate || '',
        dueDate: task.dueDate ? task.dueDate.split('T')[0] : '',
        dataSugeridaExecucao: (task.scheduledDate || task.dataSugeridaExecucao) ? (task.scheduledDate || task.dataSugeridaExecucao).split('T')[0] : new Date().toISOString().split('T')[0],
        periodoSugerido: task.scheduledPeriod || task.periodoSugerido || 'Manhã',
        energiaNecessaria: task.energiaNecessaria || 'Média',
        importance: task.importance || 'Média',
        urgency: task.urgency || 'Média',
        executionDifficulty: task.executionDifficulty || 'Direta',
        recurrenceFrequency: task.recurrenceFrequency || 'Nenhuma',
        status: task.status || 'pendente',
        microtarefas: normalizeMicrotasks(task.microtarefas, task.id),
        description: task.description || '' // Optional, might map to notes if schema updates
      });
      setIsDirty(false);
    }
  }, [task, isOpen]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  const validate = () => {
    const errors = [];
    if (!formData.title?.trim()) errors.push('Título');
    if (!formData.project?.trim()) errors.push('Projeto');
    if (!formData.timeEstimate) errors.push('Tempo Estimado');
    if (!formData.dataSugeridaExecucao) errors.push('Data Sugerida');
    if (!formData.energiaNecessaria) errors.push('Energia Necessária');

    if (errors.length > 0) {
      toast.error(`Preencha os campos obrigatórios: ${errors.join(', ')}`);
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;
    try {
      const payload = {
        ...formData,
        scheduledDate: formData.dataSugeridaExecucao,
        scheduledPeriod: formData.periodoSugerido,
        timeEstimate: parseInt(formData.timeEstimate) || 0
      };
      await updateTask(task.id, payload);
      await refreshTasks();
      toast.success('Tarefa atualizada com sucesso!');
      onClose();
    } catch (err) {
      console.error(err);
    }
  };

  const handleArchive = async () => {
    try {
      await updateTask(task.id, { status: 'arquivada' });
      await refreshTasks();
      toast.success('Tarefa arquivada no backlog.');
      onClose();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAttemptClose = () => {
    if (isDirty) {
      setShowCancelAlert(true);
    } else {
      onClose();
    }
  };

  const handleDelete = async () => {
    try {
      await deleteTask(task.id);
      await refreshTasks();
      toast.success('Tarefa excluída.');
      setShowDeleteAlert(false);
      onClose();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && handleAttemptClose()}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto bg-card text-foreground border-border p-0">
          <DialogHeader className="p-6 pb-4 border-b border-border sticky top-0 bg-card z-10">
            <DialogTitle className="text-2xl font-medium">Editar tarefa</DialogTitle>
          </DialogHeader>
          
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2 col-span-full">
                <Label>Título *</Label>
                <Input 
                  value={formData.title || ''} 
                  onChange={e => handleChange('title', e.target.value)} 
                  className="bg-background text-foreground"
                />
              </div>

              <div className="space-y-2">
                <Label>Projeto *</Label>
                <Input 
                  value={formData.project || ''} 
                  onChange={e => handleChange('project', e.target.value)} 
                  className="bg-background text-foreground"
                />
              </div>

              <div className="space-y-2">
                <Label>Tipo de Tarefa</Label>
                <Select value={formData.taskType} onValueChange={v => handleChange('taskType', v)}>
                  <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TASK_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 col-span-full">
                <Label>Ação Prática (Next Action)</Label>
                <Textarea 
                  value={formData.nextAction || ''} 
                  onChange={e => handleChange('nextAction', e.target.value)} 
                  className="bg-background min-h-[80px]"
                />
              </div>

              <div className="space-y-2 col-span-full">
                <Label>Descrição (Opcional)</Label>
                <Textarea 
                  value={formData.description || ''} 
                  onChange={e => handleChange('description', e.target.value)} 
                  className="bg-background"
                />
              </div>

              <div className="space-y-2">
                <Label>Tempo Estimado (min) *</Label>
                <Input 
                  type="number" 
                  value={formData.timeEstimate || ''} 
                  onChange={e => handleChange('timeEstimate', e.target.value)} 
                  className="bg-background"
                />
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={v => handleChange('status', v)}>
                  <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Data sugerida de execução *</Label>
                <Input 
                  type="date" 
                  value={formData.dataSugeridaExecucao || ''} 
                  onChange={e => handleChange('dataSugeridaExecucao', e.target.value)} 
                  className="bg-background"
                />
              </div>

              <div className="space-y-2">
                <Label>Data Limite (Due Date)</Label>
                <Input 
                  type="date" 
                  value={formData.dueDate || ''} 
                  onChange={e => handleChange('dueDate', e.target.value)} 
                  className="bg-background"
                />
              </div>

              <div className="space-y-2">
                <Label>Período de execução</Label>
                <Select value={formData.periodoSugerido} onValueChange={v => handleChange('periodoSugerido', v)}>
                  <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PERIODS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label>Energia Necessária *</Label>
                <RadioGroup 
                  value={formData.energiaNecessaria} 
                  onValueChange={v => handleChange('energiaNecessaria', v)}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Baixa" id="e-baixa" />
                    <Label htmlFor="e-baixa">Baixa</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Média" id="e-media" />
                    <Label htmlFor="e-media">Média</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Alta" id="e-alta" />
                    <Label htmlFor="e-alta">Alta</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label>Importância</Label>
                <Select value={formData.importance} onValueChange={v => handleChange('importance', v)}>
                  <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {IMPORTANCE_URGENCY.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Urgência</Label>
                <Select value={formData.urgency} onValueChange={v => handleChange('urgency', v)}>
                  <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {IMPORTANCE_URGENCY.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Dificuldade de execução</Label>
                <Select value={formData.executionDifficulty} onValueChange={v => handleChange('executionDifficulty', v)}>
                  <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EXECUTION_DIFFICULTIES.map((difficulty) => <SelectItem key={difficulty} value={difficulty}>{difficulty}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Repetir</Label>
                <Select value={formData.recurrenceFrequency} onValueChange={v => handleChange('recurrenceFrequency', v)}>
                  <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RECURRENCE_FREQUENCIES.map((frequency) => <SelectItem key={frequency} value={frequency}>{frequency}</SelectItem>)}
                  </SelectContent>
                </Select>
                {formData.recurrenceFrequency !== 'Nenhuma' && (
                  <p className="text-xs text-muted-foreground">Ao concluir, o Clareia cria automaticamente a próxima ocorrência.</p>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-border">
              <MicrotaskEditor 
                microtasks={formData.microtarefas} 
                onChange={v => handleChange('microtarefas', v)} 
              />
            </div>
          </div>

          <DialogFooter className="p-6 border-t border-border bg-muted/20 flex-col sm:flex-row gap-3">
            <Button variant="outline" onClick={handleArchive} className="sm:mr-auto">
              Arquivar tarefa
            </Button>
            <Button variant="destructive" onClick={() => setShowDeleteAlert(true)}>
              Deletar tarefa
            </Button>
            <Button variant="outline" onClick={handleAttemptClose}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              Salvar alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showCancelAlert} onOpenChange={setShowCancelAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar alterações?</AlertDialogTitle>
            <AlertDialogDescription>
              Você fez alterações que não foram salvas. Tem certeza que deseja sair?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowCancelAlert(false); onClose(); }} className="bg-destructive text-destructive-foreground">
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza que deseja excluir esta tarefa?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. A tarefa será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir tarefa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
