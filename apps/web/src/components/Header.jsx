import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, LogOut, Moon, Sparkles, Sun, UserRound } from 'lucide-react';
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

export default function Header({ notificationCount = 0, onOpenNotifications }) {
  const { currentUser, isAuthenticated, logout } = useAuth();
  const { theme, toggleTheme, lowStimulationMode, toggleLowStimulationMode } = useTheme();
  const navigate = useNavigate();

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
              onClick={toggleLowStimulationMode}
              className="min-h-11 px-2 sm:px-3"
              aria-pressed={lowStimulationMode}
            >
              <span className="hidden sm:inline">Modo </span>tranquilo
            </Button>
          )}

          {isAuthenticated && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onOpenNotifications}
              className="relative min-h-11 min-w-11 text-muted-foreground hover:text-foreground"
              aria-label={notificationCount > 0 ? `Notificações: ${notificationCount} novas` : 'Notificações'}
            >
              <Bell className="h-5 w-5" aria-hidden="true" />
              {notificationCount > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-destructive" />}
            </Button>
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