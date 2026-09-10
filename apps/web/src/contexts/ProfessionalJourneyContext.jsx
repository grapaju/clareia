import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { listProjectProfilesApi } from '@/services/projectProfilesApiService.js';
import {
  closeProfessionalJourney,
  getCurrentProfessionalJourney,
  pauseProfessionalJourney,
  resumeProfessionalJourney,
  startProfessionalJourney,
  listProfessionalJourneys,
} from '@/services/professionalJourneyApiService.js';

const ProfessionalJourneyContext = createContext(null);

export function ProfessionalJourneyProvider({ children }) {
  const { currentUser } = useAuth();
  const [current, setCurrent] = useState({ item: null, pauses: [] });
  const [professionalProjects, setProfessionalProjects] = useState([]);
  const [professionalHistory, setProfessionalHistory] = useState({ journeys: [], pauses: [] });
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!currentUser?.id) {
      setCurrent({ item: null, pauses: [] });
      setProfessionalProjects([]);
      setProfessionalHistory({ journeys: [], pauses: [] });
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
      setCurrent({ item: journey?.item || null, pauses: journey?.pauses || [] });
      setProfessionalProjects(profiles.filter((profile) => profile.professionalTrackingEnabled));
      setProfessionalHistory({ journeys: history?.journeys || [], pauses: history?.pauses || [] });
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
      idempotencyKey: `work-${currentUser.id}-${projectName}-${Date.now()}`,
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
    const response = await closeProfessionalJourney(current.item.id, { closingNote, ...(endedAt ? { endedAt } : {}) });
    setCurrent({ item: null, pauses: [] });
    await refresh().catch(() => {});
    return response?.item || null;
  };

  return (
    <ProfessionalJourneyContext.Provider value={{
      currentJourney: current.item,
      journeyPauses: current.pauses,
      professionalProjects,
      professionalHistory,
      isLoading,
      refresh,
      startWork,
      pauseWork,
      resumeWork,
      closeWork,
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