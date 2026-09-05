
import React, { useEffect, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Home, Sparkles, FolderKanban, Settings, Clock3, BarChart3, CalendarDays, BookOpen, UserRound, MoreHorizontal, Repeat, Bookmark } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { countPendingUnsortedNotes, subscribeToUnsortedNotes } from '@/lib/unsortedNotesStorage.js';

const navItems = [
  { icon: Home, label: 'Hoje', path: '/' },
  { icon: Sparkles, label: 'Plano', path: '/plano-clareado' },
  { icon: FolderKanban, label: 'Projetos', path: '/projects' },
];

const moreItems = [
  { icon: Bookmark, label: 'Guardados', path: '/guardados' },
  { icon: CalendarDays, label: 'Calendário', path: '/calendario' },
  { icon: Clock3, label: 'Aguardando retorno', path: '/aguardando-retorno' },
  { icon: Repeat, label: 'Rotinas', path: '/rotinas' },
  { icon: BarChart3, label: 'Relat.', path: '/relatorios' },
  { icon: Settings, label: 'Preferências', path: '/configuracoes' },
  { icon: BookOpen, label: 'Ajuda', path: '/guia' },
  { icon: UserRound, label: 'Conta', path: '/conta' },
];

export default function MobileNav() {
  const location = useLocation();
  const { currentUser } = useAuth();
  const [savedCount, setSavedCount] = useState(0);

  useEffect(() => {
    const sync = () => setSavedCount(countPendingUnsortedNotes(currentUser?.id));
    sync();
    return subscribeToUnsortedNotes(sync);
  }, [currentUser?.id]);

  const isActive = (path) => {
    return location.pathname === path;
  };

  const isMoreActive = moreItems.some((item) => isActive(item.path));

  return (
    <nav aria-label="Navegação mobile" className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50 pb-safe">
      <div className="flex min-h-16 items-stretch justify-around px-1 py-1">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              "flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-md py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isActive(item.path)
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <div className="relative">
              <item.icon className={cn("w-5 h-5", isActive(item.path) && "fill-primary/20")} />
            </div>
            <span className="max-w-full truncate px-0.5 text-xs font-medium">{item.label}</span>
          </Link>
        ))}
        <DropdownMenu>
          <DropdownMenuTrigger className={cn(
            'flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-md py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            isMoreActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
          )}>
            <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
            <span>Mais</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={8} className="mb-1 min-w-56">
            {moreItems.map((item) => (
              <DropdownMenuItem key={item.path} asChild>
                <Link to={item.path} className="flex min-h-11 items-center gap-3">
                  <item.icon className="h-5 w-5" aria-hidden="true" />
                  {item.label}{item.path === '/guardados' && savedCount > 0 ? ` (${savedCount})` : ''}
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}
