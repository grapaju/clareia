
import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Home, FolderKanban, Sparkles, Settings, Clock3, BarChart3, CalendarDays, BookOpen, UserRound, MoreHorizontal, Repeat, Bookmark } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { countPendingUnsortedNotes, subscribeToUnsortedNotes } from '@/lib/unsortedNotesStorage.js';
import { countOpenWaitingReturns } from '@/lib/waitingReturnLogic.js';
import { listWaitingReturns, subscribeToWaitingReturns } from '@/services/waitingReturnService.js';

const primaryItems = [
  { icon: Home, label: 'Hoje', path: '/' },
  { icon: Sparkles, label: 'Plano', path: '/plano-clareado' },
  { icon: FolderKanban, label: 'Projetos', path: '/projects' },
  { icon: CalendarDays, label: 'Calendário', path: '/calendario' },
];

const secondaryItems = [
  { icon: Bookmark, label: 'Guardados', path: '/guardados' },
  { icon: Clock3, label: 'Aguardando retorno', path: '/aguardando-retorno' },
  { icon: Repeat, label: 'Rotinas', path: '/rotinas' },
  { icon: BarChart3, label: 'Relatórios', path: '/relatorios' },
];

const supportItems = [
  { icon: Settings, label: 'Preferências', path: '/configuracoes' },
  { icon: BookOpen, label: 'Ajuda', path: '/guia' },
  { icon: UserRound, label: 'Conta', path: '/conta' },
];

export default function Sidebar({ compact = false }) {
  const { currentUser } = useAuth();
  const [savedCount, setSavedCount] = useState(0);
  const [waitingCount, setWaitingCount] = useState(0);

  useEffect(() => {
    const sync = () => {
      setSavedCount(countPendingUnsortedNotes(currentUser?.id));
      setWaitingCount(countOpenWaitingReturns(listWaitingReturns()));
    };
    sync();
    const unsubscribeSaved = subscribeToUnsortedNotes(sync);
    const unsubscribeWaiting = subscribeToWaitingReturns(sync);
    return () => {
      unsubscribeSaved();
      unsubscribeWaiting();
    };
  }, [currentUser?.id]);

  const renderItem = (item) => (
    <NavLink
      key={item.path}
      to={item.path}
      className={({ isActive }) => cn(
        'flex min-h-11 items-center gap-3 rounded-md text-sm font-medium transition-colors',
        compact ? 'px-2.5 py-2' : 'px-3 py-2.5',
        isActive
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
    >
      <item.icon className={cn('h-5 w-5 shrink-0', compact && 'h-4.5 w-4.5')} aria-hidden="true" />
      <span className={cn(compact && 'text-[13px]')}>{item.label}</span>
      {item.path === '/guardados' && savedCount > 0 && <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-xs tabular-nums text-muted-foreground" aria-label={`${savedCount} ${savedCount === 1 ? 'guardado' : 'guardados'}`}>{savedCount}</span>}
      {item.path === '/aguardando-retorno' && waitingCount > 0 && <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-xs tabular-nums text-muted-foreground" aria-label={`${waitingCount} ${waitingCount === 1 ? 'acompanhamento' : 'acompanhamentos'}`}>{waitingCount}</span>}
    </NavLink>
  );

  return (
    <aside className={cn(
      'hidden md:flex flex-col border-r border-border bg-card/50 min-h-[calc(100vh-4rem)] sticky top-16',
      compact ? 'w-52' : 'w-64'
    )}>
      <nav aria-label="Navegação principal" className={cn('flex flex-1 flex-col py-6', compact ? 'px-3' : 'px-4')}>
        <div className="space-y-1.5">{primaryItems.map(renderItem)}</div>

        <details className="group mt-2">
          <summary className={cn(
            'flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-md text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground',
            compact ? 'px-2.5 py-2' : 'px-3 py-2.5'
          )}>
            <MoreHorizontal className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span>Mais</span>
          </summary>
          <div className="mt-1 space-y-1 border-l border-border pl-2">{secondaryItems.map(renderItem)}</div>
        </details>

        <div className="mt-auto space-y-1.5 border-t border-border pt-4">{supportItems.map(renderItem)}</div>
      </nav>
    </aside>
  );
}
