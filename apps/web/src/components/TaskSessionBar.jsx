import React from 'react';
import { Pause, TimerReset } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useTaskContext } from '@/hooks/useTaskContext.js';
import { useTaskSession } from '@/hooks/useTaskSession.js';

function formatElapsed(seconds) {
  const safe = Math.max(0, Number(seconds || 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const remainingSeconds = Math.floor(safe % 60);
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
    : `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

export default function TaskSessionBar({ embedded = false, onReturnToFocus }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { tasks, pauseTask, setSelectedTask } = useTaskContext();
  const { session, elapsedSeconds } = useTaskSession();

  if (session?.state !== 'running' || (!embedded && ['/foco', '/login', '/signup'].includes(location.pathname))) return null;

  const task = tasks.find((item) => item.id === session.taskId);
  const title = task?.title || session.taskTitle || 'Tarefa em foco';

  const returnToFocus = () => {
    if (task) setSelectedTask(task);
    onReturnToFocus?.();
    navigate('/foco');
  };

  const toggleSession = async () => {
    await pauseTask(session.taskId, { note: '' });
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className={embedded ? 'task-session-control task-session-control-desk' : 'task-session-control'} role="group" aria-label="Sessão da tarefa em andamento">
        <span className="task-session-indicator" aria-hidden="true" />
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" className="task-session-time" onClick={returnToFocus} aria-label={`Tempo trabalhado em ${title}: ${formatElapsed(elapsedSeconds)}. Abrir foco.`}>
              <TimerReset aria-hidden="true" />
              <span>{formatElapsed(elapsedSeconds)}</span>
            </button>
          </TooltipTrigger>
          <TooltipContent>{title} · Tempo trabalhado</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="ghost" className="task-session-pause" onClick={toggleSession} aria-label={`Pausar sessão de ${title}`}>
              <Pause aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Pausar sessão</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}