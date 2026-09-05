import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { listProjectProfilesApi } from '@/services/projectProfilesApiService.js';
import {
  closeProfessionalJourney,
  createProfessionalActivity,
  getCurrentProfessionalJourney,
  pauseProfessionalJourney,
  resumeProfessionalJourney,
  startProfessionalJourney,
  listProfessionalJourneys,
} from '@/services/professionalJourneyApiService.js';

const ProfessionalJourneyContext = createContext(null);

export function ProfessionalJourneyProvider({ children }) {
  const { currentUser } = useAuth();
  const [current, setCurrent] = useState({ item: null, pauses: [], activities: [] });
  const [professionalProjects, setProfessionalProjects] = useState([]);
  const [professionalHistory, setProfessionalHistory] = useState({ journeys: [], activities: [], edits: [] });
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!currentUser?.id) {
      setCurrent({ item: null, pauses: [], activities: [] });
      setProfessionalProjects([]);
      setProfessionalHistory({ journeys: [], activities: [], edits: [] });
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const [journey, profiles, history] = await Promise.all([
        getCurrentProfessionalJourney(),
        listProjectProfilesApi(),
        listProfessionalJourneys(),
      ]);
      setCurrent(journey || { item: null, pauses: [], activities: [] });
      setProfessionalProjects(profiles.filter((profile) => profile.professionalTrackingEnabled));
      setProfessionalHistory(history || { journeys: [], activities: [], edits: [] });
    } finally {
      setIsLoading(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    refresh().catch(() => setIsLoading(false));
  }, [refresh]);

  const startWork = async (projectName) => {
    const profile = professionalProjects.find((item) => item.name === projectName);
    const response = await startProfessionalJourney({
      projectName,
      timezone: profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      idempotencyKey: `work-${currentUser.id}-${projectName}-${new Date().toISOString().slice(0, 10)}`,
    });
    await refresh();
    return response?.item || null;
  };

  const pauseWork = async () => {
    if (!current.item?.id) return;
    await pauseProfessionalJourney(current.item.id);
    await refresh();
  };

  const resumeWork = async () => {
    if (!current.item?.id) return;
    await resumeProfessionalJourney(current.item.id);
    await refresh();
  };

  const closeWork = async (closingNote = '', endedAt) => {
    if (!current.item?.id) return;
    await closeProfessionalJourney(current.item.id, { closingNote, ...(endedAt ? { endedAt } : {}) });
    await refresh();
  };

  const startActivity = async ({ title, taskId, category, source = taskId ? 'task' : 'quick', notes = '', journeyId = '' }) => {
    const targetJourneyId = journeyId || current.item?.id;
    if (!targetJourneyId || (!journeyId && current.item.status !== 'active')) return null;
    const active = current.activities.find((item) => !item.endedAt);
    if (active && ((taskId && active.taskId === taskId) || (!taskId && active.title === title))) return active;
    const response = await createProfessionalActivity(targetJourneyId, {
      title, taskId, category, source, notes,
      idempotencyKey: `activity-${targetJourneyId}-${taskId || title}-${Date.now()}`,
    });
    await refresh();
    return response?.item || null;
  };

  return (
    <ProfessionalJourneyContext.Provider value={{
      currentJourney: current.item,
      journeyPauses: current.pauses,
      journeyActivities: current.activities,
      professionalProjects,
      professionalHistory,
      isLoading,
      refresh,
      startWork,
      pauseWork,
      resumeWork,
      closeWork,
      startActivity,
    }}>
      {children}
    </ProfessionalJourneyContext.Provider>
  );
}

export function useProfessionalJourney() {
  const value = useContext(ProfessionalJourneyContext);
  if (!value) throw new Error('useProfessionalJourney deve ser usado dentro do provider.');
  return value;
}