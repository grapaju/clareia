
import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FolderKanban, AlertCircle, CheckCircle2, Pencil } from 'lucide-react';
import EditTaskModal from '@/components/EditTaskModal.jsx';
import { isTaskOpenStatus } from '@/lib/taskExecution.js';

export default function ProjectCard({ project, tasks }) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState(null);

  const projectTasks = tasks.filter(t => t.project === project && isTaskOpenStatus(t.status));
  const urgentTasks = projectTasks.filter(t => {
    const deadline = t.dueDate ? new Date(t.dueDate) : null;
    const daysDiff = deadline ? Math.ceil((deadline - new Date()) / (1000 * 60 * 60 * 24)) : null;
    return daysDiff !== null && daysDiff >= 0 && daysDiff <= 2;
  });

  const nextAction = projectTasks.find(t => t.nextAction && t.nextAction.trim() !== '');

  const getStatusColor = () => {
    if (urgentTasks.length > 0) return 'text-destructive';
    if (projectTasks.length === 0) return 'text-green-600 dark:text-green-400';
    return 'text-primary';
  };

  const handleEditClick = (e) => {
    e.stopPropagation();
    if (projectTasks.length > 0) {
      setTaskToEdit(projectTasks[0]);
      setIsEditModalOpen(true);
    }
  };

  return (
    <>
      <Card className="card-hover transition-all duration-200 border-border bg-card">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <FolderKanban className={`w-5 h-5 ${getStatusColor()}`} />
                <h3 className="font-semibold text-foreground">{project}</h3>
              </div>
              <div className="flex items-center gap-1">
                {projectTasks.length === 0 && (
                  <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                )}
                {projectTasks.length > 0 && (
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={handleEditClick} aria-label="Editar tarefa principal">
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-xs">
                {projectTasks.length} {projectTasks.length === 1 ? 'tarefa' : 'tarefas'}
              </Badge>
              {urgentTasks.length > 0 && (
                <Badge variant="destructive" className="text-xs">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  {urgentTasks.length} urgentes
                </Badge>
              )}
            </div>

            {nextAction && (
              <div className="bg-accent/10 rounded-lg p-3 border border-accent/20">
                <p className="text-sm text-foreground">
                  <span className="font-medium text-accent">Próximo passo:</span> {nextAction.nextAction}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      {taskToEdit && (
        <EditTaskModal 
          task={taskToEdit} 
          isOpen={isEditModalOpen} 
          onClose={() => setIsEditModalOpen(false)} 
        />
      )}
    </>
  );
}
