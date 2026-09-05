import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, Bookmark, Clock3, LogOut, Moon, Sparkles, Sun, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useTheme } from '@/contexts/ThemeContext.jsx';
import { isPrivilegedUser } from '@/lib/accessControl.js';
import QuickCaptureDialog from '@/components/QuickCaptureDialog.jsx';
import { buildNotificationCenter, countUnreadAttention } from '@/lib/notificationLogic.js';
import { countPendingUnsortedNotes, subscribeToUnsortedNotes, syncUnsortedNotesFromApi } from '@/lib/unsortedNotesStorage.js';
import { listWaitingReturns, subscribeToWaitingReturns, syncWaitingReturnsWithCloud } from '@/services/waitingReturnService.js';
import { listReadNotificationIds, markNotificationRead, retainActiveNotificationReads } from '@/services/notificationStateService.js';

export default function Header() {
  const { currentUser, isAuthenticated, logout } = useAuth();
  const { theme, toggleTheme, lowStimulationMode, toggleLowStimulationMode } = useTheme();
  const navigate = useNavigate();
  const [modeAnnouncement, setModeAnnouncement] = useState('');
  const [waitingItems, setWaitingItems] = useState([]);
  const [savedCount, setSavedCount] = useState(0);
  const [readIds, setReadIds] = useState([]);
  const [loadedNotificationUserId, setLoadedNotificationUserId] = useState('');
  const userId = currentUser?.id || '';

  const refreshNotifications = useCallback(async () => {
    if (!userId) return;
    await Promise.allSettled([
      syncWaitingReturnsWithCloud(),
      syncUnsortedNotesFromApi(userId),
    ]);
    setWaitingItems(listWaitingReturns());
    setSavedCount(countPendingUnsortedNotes(userId));
    setLoadedNotificationUserId(userId);
  }, [userId]);

  useEffect(() => {
    if (!userId) return undefined;
    setWaitingItems([]);
    setSavedCount(0);
    setReadIds(listReadNotificationIds(userId));
    refreshNotifications();
    const refreshLocal = () => {
      setWaitingItems(listWaitingReturns());
      setSavedCount(countPendingUnsortedNotes(userId));
    };
    const unsubscribeWaiting = subscribeToWaitingReturns(refreshLocal);
    const unsubscribeSaved = subscribeToUnsortedNotes(refreshLocal);
    window.addEventListener('focus', refreshNotifications);
    return () => {
      unsubscribeWaiting();
      unsubscribeSaved();
      window.removeEventListener('focus', refreshNotifications);
    };
  }, [refreshNotifications, userId]);

  const notificationCenter = useMemo(
    () => buildNotificationCenter({ waitingItems, savedCount }),
    [savedCount, waitingItems]
  );
  const notificationCount = countUnreadAttention(notificationCenter, readIds);

  useEffect(() => {
    if (!userId || loadedNotificationUserId !== userId) return;
    setReadIds(retainActiveNotificationReads(notificationCenter.attention.map((item) => item.id), userId));
  }, [loadedNotificationUserId, notificationCenter.attention, userId]);

  const openNotification = (notification) => {
    if (notification.type !== 'summary') {
      setReadIds(markNotificationRead(notification.id, userId));
    }
    navigate(notification.href);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card">
      <div className="page-container flex h-16 items-center justify-between gap-2">
        <Link
          to="/"
          className="flex min-h-11 items-center gap-2 text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Clareia - Ir para Hoje"
        >
          <Sparkles className="h-6 w-6 text-primary" aria-hidden="true" />
          <span className="hidden text-xl font-semibold min-[390px]:inline">Clareia</span>
        </Link>

        <div className="flex items-center gap-1 sm:gap-2">
          {isAuthenticated && (
            <QuickCaptureDialog />
          )}

          {isAuthenticated && (
            <Button
              variant={lowStimulationMode ? 'default' : 'ghost'}
              size="sm"
              onClick={() => {
                toggleLowStimulationMode();
                setModeAnnouncement(lowStimulationMode
                  ? 'Modo tranquilo desativado. Todas as tarefas estão visíveis.'
                  : 'Modo tranquilo ativado. Mostrando apenas o próximo passo.');
              }}
              className="min-h-11 px-2 sm:px-3"
              aria-pressed={lowStimulationMode}
              aria-label={lowStimulationMode ? 'Sair do modo tranquilo' : 'Ativar modo tranquilo'}
            >
              {lowStimulationMode
                ? <><span className="hidden sm:inline">Sair do modo </span>tranquilo</>
                : <><span className="hidden sm:inline">Modo </span>tranquilo</>}
            </Button>
          )}
          <p className="sr-only" aria-live="polite">{modeAnnouncement}</p>

          {isAuthenticated && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative min-h-11 min-w-11 text-muted-foreground hover:text-foreground"
                  aria-label={notificationCount > 0 ? `Notificações: ${notificationCount} ${notificationCount === 1 ? 'aviso não lido' : 'avisos não lidos'} que ${notificationCount === 1 ? 'precisa' : 'precisam'} de atenção` : 'Notificações, nenhuma nova precisa de atenção'}
                >
                  <Bell className="h-5 w-5" aria-hidden="true" />
                  {notificationCount > 0 && <span className="absolute right-0.5 top-0.5 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground" aria-hidden="true">{notificationCount > 9 ? '9+' : notificationCount}</span>}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={8} className="w-[min(22rem,calc(100vw-1rem))] p-2">
                <DropdownMenuLabel className="px-2 py-2 text-base">Notificações</DropdownMenuLabel>
                {notificationCenter.attention.length > 0 && <>
                  <DropdownMenuLabel className="px-2 pb-1 pt-2 text-xs font-medium text-muted-foreground">Precisa de atenção</DropdownMenuLabel>
                  {notificationCenter.attention.map((item) => {
                    const unread = !readIds.includes(item.id);
                    return <DropdownMenuItem key={item.id} onSelect={() => openNotification(item)} className="min-h-11 items-start whitespace-normal py-2">
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${unread ? 'bg-primary' : 'bg-muted-foreground/30'}`} aria-hidden="true" />
                      <span className="min-w-0 break-words leading-5">{item.title}<span className="sr-only">{unread ? ', não lida' : ', lida'}</span></span>
                    </DropdownMenuItem>;
                  })}
                </>}
                {notificationCenter.tracking.length > 0 && <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="px-2 pb-1 pt-2 text-xs font-medium text-muted-foreground">Para acompanhar</DropdownMenuLabel>
                  {notificationCenter.tracking.map((item) => <DropdownMenuItem key={item.id} onSelect={() => openNotification({ ...item, type: 'summary' })} className="min-h-11 whitespace-normal py-2"><Clock3 className="mt-0.5" /><span>{item.title}</span></DropdownMenuItem>)}
                </>}
                {notificationCenter.organizing.length > 0 && <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="px-2 pb-1 pt-2 text-xs font-medium text-muted-foreground">Para organizar</DropdownMenuLabel>
                  {notificationCenter.organizing.map((item) => <DropdownMenuItem key={item.id} onSelect={() => openNotification({ ...item, type: 'summary' })} className="min-h-11 whitespace-normal py-2"><Bookmark className="mt-0.5" /><span>{item.title}</span></DropdownMenuItem>)}
                </>}
                {notificationCenter.attention.length === 0 && notificationCenter.tracking.length === 0 && notificationCenter.organizing.length === 0 && <p className="px-2 py-5 text-center text-sm text-muted-foreground">Nenhum aviso por enquanto.</p>}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label="Abrir menu do perfil">
                  <UserRound className="h-5 w-5" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-56">
                <DropdownMenuLabel className="truncate">{currentUser?.name || currentUser?.email || 'Meu perfil'}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={(event) => { event.preventDefault(); toggleTheme(); }}>
                  {theme === 'dark' ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
                  Tema {theme === 'dark' ? 'claro' : 'escuro'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/configuracoes')}>Preferências</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/guia')}>Ajuda</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/conta')}>Conta</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/guia#enviar-sugestao')}>Enviar sugestão</DropdownMenuItem>
                {isPrivilegedUser(currentUser) && (
                  <DropdownMenuItem onClick={() => navigate('/laboratorio')}>Laboratório</DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" aria-hidden="true" /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button onClick={() => navigate('/login')} size="sm">Entrar</Button>
          )}
        </div>
      </div>
    </header>
  );
}