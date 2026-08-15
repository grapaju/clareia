import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { ensureClareiaInternalProject } from '@/services/internalProjectService.js';
import {
  DEFAULT_DEV_LOCK,
  isDevelopmentAllowed,
  readAppMode,
  readDevelopmentLock,
  writeAppMode,
  writeDevelopmentLock
} from '@/services/appModeService.js';

const AppModeContext = createContext();

export const DAILY_MODE_NAV_PATHS = ['/', '/descarregar-mente', '/aguardando-retorno', '/projects', '/relatorios', '/guia'];

const DAILY_ALLOWED_PATHS = new Set([
  '/',
  '/descarregar-mente',
  '/aguardando-retorno',
  '/projects',
  '/relatorios',
  '/guia',
  '/foco'
]);

function normalizePath(pathname) {
  if (!pathname) return '/';
  if (pathname === '/') return '/';
  return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

function isPathAllowedInDailyMode(pathname) {
  const normalized = normalizePath(pathname);
  if (DAILY_ALLOWED_PATHS.has(normalized)) return true;
  return false;
}

export function AppModeProvider({ children }) {
  const { currentUser } = useAuth();
  const userId = currentUser?.id || 'anonymous';

  const [mode, setMode] = useState(() => readAppMode(userId));
  const [developmentLock, setDevelopmentLock] = useState(() => readDevelopmentLock(userId));

  useEffect(() => {
    setMode(readAppMode(userId));
    setDevelopmentLock(readDevelopmentLock(userId));
  }, [userId]);

  useEffect(() => {
    if (!currentUser?.id) return;
    ensureClareiaInternalProject();
  }, [currentUser?.id]);

  const updateDevelopmentLock = (updates) => {
    const saved = writeDevelopmentLock(userId, updates);
    setDevelopmentLock(saved);
    return saved;
  };

  const requestModeChange = (nextMode, options = {}) => {
    const normalized = nextMode === 'development' ? 'development' : 'daily';
    const force = Boolean(options.force);

    if (normalized === 'development' && !force) {
      const allowed = isDevelopmentAllowed(developmentLock, new Date());
      if (!allowed) {
        return {
          changed: false,
          blocked: true,
          message: 'Essa melhoria pode esperar. Vou guardar para depois para você continuar o que estava fazendo.'
        };
      }
    }

    const saved = writeAppMode(userId, normalized);
    setMode(saved);
    return {
      changed: true,
      blocked: false,
      mode: saved
    };
  };

  const value = useMemo(() => ({
    mode,
    isDailyMode: mode === 'daily',
    isDevelopmentMode: mode === 'development',
    developmentLock: developmentLock || DEFAULT_DEV_LOCK,
    dailyNavPaths: DAILY_MODE_NAV_PATHS,
    isPathAllowedInDailyMode,
    updateDevelopmentLock,
    requestModeChange
  }), [mode, developmentLock]);

  return (
    <AppModeContext.Provider value={value}>
      {children}
    </AppModeContext.Provider>
  );
}

export function useAppMode() {
  const context = useContext(AppModeContext);
  if (!context) {
    throw new Error('useAppMode must be used within an AppModeProvider');
  }
  return context;
}
