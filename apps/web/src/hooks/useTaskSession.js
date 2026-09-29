import { useContext } from 'react';
import { TaskSessionContext } from '@/contexts/TaskSessionContext.jsx';

export function useTaskSession() {
  const context = useContext(TaskSessionContext);
  if (!context) throw new Error('useTaskSession deve ser usado dentro de TaskSessionProvider.');
  return context;
}