import React, { useEffect, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { useAppMode } from '@/contexts/AppModeContext.jsx';

export default function ModeRouteGuard({ children }) {
  const location = useLocation();
  const { isDailyMode, isPathAllowedInDailyMode } = useAppMode();
  const lastBlockedRef = useRef('');

  const blocked = isDailyMode && !isPathAllowedInDailyMode(location.pathname);

  useEffect(() => {
    if (!blocked) return;
    if (lastBlockedRef.current === location.pathname) return;

    toast.message('Modo Uso Diario ativo: telas de desenvolvimento estao ocultas no momento.');
    lastBlockedRef.current = location.pathname;
  }, [blocked, location.pathname]);

  if (blocked) {
    return <Navigate to="/" replace />;
  }

  return children;
}
