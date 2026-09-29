import React, { createContext, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext.jsx';
import {
  finishTaskSessionInApi,
  getCurrentTaskSessionFromApi,
  pauseTaskSessionInApi,
  resumeTaskSessionInApi,
  startNextTaskBlockInApi,
  startTaskSessionInApi,
} from '@/services/tasksApiService.js';
import { getTaskBlockRemainingSeconds, getTaskSessionElapsedSeconds } from '@/lib/taskSessionTiming.js';

export const TaskSessionContext = createContext(null);

const CHANNEL_NAME = 'clareia-task-session';
const STORAGE_SYNC_KEY = 'clareia_task_session_sync';

export function TaskSessionProvider({ children }) {
  const { currentUser } = useAuth();
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [now, setNow] = useState(Date.now());
  const channelRef = useRef(null);
  const operationRef = useRef(null);

  const refreshSession = async ({ quiet = false, broadcast = false } = {}) => {
    if (!currentUser?.id) {
      setSession(null);
      return null;
    }
    if (!quiet) setIsLoading(true);
    try {
      const current = await getCurrentTaskSessionFromApi();
      setSession(current ? { ...current, receivedAt: Date.now() } : null);
      setNow(Date.now());
      if (broadcast) channelRef.current?.postMessage({ type: 'session-changed' });
      return current;
    } catch (error) {
      if (!quiet) toast.error(error.message || 'Não foi possível recuperar a sessão da tarefa.');
      throw error;
    } finally {
      if (!quiet) setIsLoading(false);
    }
  };

  const broadcastChange = () => {
    channelRef.current?.postMessage({ type: 'session-changed' });
    localStorage.setItem(STORAGE_SYNC_KEY, String(Date.now()));
  };

  const runTransition = async (operation, { silentStatuses = [] } = {}) => {
    if (operationRef.current) return operationRef.current;
    const request = operation()
      .then((result) => {
        setSession(result?.session ? { ...result.session, receivedAt: Date.now() } : null);
        setNow(Date.now());
        broadcastChange();
        return result;
      })
      .catch((error) => {
        if (!silentStatuses.includes(error.status)) {
          toast.error(error.message || 'A alteração da sessão não foi confirmada.');
        }
        throw error;
      });
    operationRef.current = request;
    try {
      return await request;
    } finally {
      if (operationRef.current === request) operationRef.current = null;
    }
  };

  useEffect(() => {
    if (!currentUser?.id) {
      setSession(null);
      return undefined;
    }
    refreshSession().catch(() => {});
    return undefined;
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser?.id) return undefined;
    const refreshFromAnotherTab = () => refreshSession({ quiet: true }).catch(() => {});
    const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL_NAME);
    channelRef.current = channel;
    if (channel) channel.onmessage = refreshFromAnotherTab;
    const handleStorage = (event) => {
      if (event.key === STORAGE_SYNC_KEY) refreshFromAnotherTab();
    };
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
      channel?.close();
      if (channelRef.current === channel) channelRef.current = null;
    };
  }, [currentUser?.id]);

  useEffect(() => {
    if (session?.state !== 'running') return undefined;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [session?.id, session?.state]);

  const startSession = async (task, options = {}) => {
    const payload = {
      taskId: task.id,
      blockDurationSeconds: Number(options.blockDurationSeconds || 1200),
    };
    try {
      return await runTransition(() => startTaskSessionInApi(payload), { silentStatuses: [409] });
    } catch (error) {
      if (error.status !== 409 || error.payload?.code !== 'ACTIVE_TASK_SESSION_CONFLICT') throw error;
      const currentTitle = error.payload?.session?.taskTitle || 'a tarefa atual';
      const confirmed = window.confirm(`Pausar “${currentTitle}” e iniciar “${task.title}”?`);
      if (!confirmed) return { cancelled: true, session: error.payload.session };
      return runTransition(() => startTaskSessionInApi({ ...payload, confirmSwitch: true }));
    }
  };

  const pauseSession = () => runTransition(pauseTaskSessionInApi);
  const resumeSession = () => runTransition(resumeTaskSessionInApi);
  const finishSession = () => runTransition(finishTaskSessionInApi);
  const startNextBlock = (blockDurationSeconds) => runTransition(() => startNextTaskBlockInApi({ blockDurationSeconds }));

  return (
    <TaskSessionContext.Provider value={{
      session,
      isLoading,
      elapsedSeconds: getTaskSessionElapsedSeconds(session, now),
      blockRemainingSeconds: getTaskBlockRemainingSeconds(session, now),
      refreshSession,
      startSession,
      pauseSession,
      resumeSession,
      finishSession,
      startNextBlock,
    }}>
      {children}
    </TaskSessionContext.Provider>
  );
}