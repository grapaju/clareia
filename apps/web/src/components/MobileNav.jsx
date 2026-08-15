
import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Home, Sparkles, FolderKanban, Settings, NotebookPen, Clock3, BarChart3, CalendarDays, BookOpen } from 'lucide-react';
import { Repeat } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppMode } from '@/contexts/AppModeContext.jsx';

const navItems = [
  { icon: Home, label: 'Hoje', path: '/' },
  { icon: NotebookPen, label: 'Descarregar', path: '/descarregar-mente' },
  { icon: CalendarDays, label: 'Calend.', path: '/calendario' },
  { icon: Clock3, label: 'Aguard.', path: '/aguardando-retorno' },
  { icon: Repeat, label: 'Rotinas', path: '/rotinas' },
  { icon: Sparkles, label: 'Plano', path: '/plano-clareado' },
  { icon: FolderKanban, label: 'Projetos', path: '/projects' },
  { icon: BarChart3, label: 'Relat.', path: '/relatorios' },
  { icon: Settings, label: 'Config.', path: '/configuracoes' },
  { icon: BookOpen, label: 'Guia', path: '/guia' },
];

export default function MobileNav() {
  const location = useLocation();
  const { isDailyMode, dailyNavPaths } = useAppMode();
  const visibleItems = isDailyMode
    ? navItems.filter((item) => dailyNavPaths.includes(item.path))
    : navItems;

  const isActive = (path) => {
    return location.pathname === path;
  };

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50 pb-safe">
      <div className="flex items-center justify-around px-1 py-2">
        {visibleItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg py-1 transition-colors",
              isActive(item.path)
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <div className="relative">
              <item.icon className={cn("w-5 h-5", isActive(item.path) && "fill-primary/20")} />
            </div>
            <span className="max-w-full truncate px-0.5 text-[9px] font-medium">{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
