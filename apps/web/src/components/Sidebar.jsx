
import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, FolderKanban, Sparkles, Settings, NotebookPen, Clock3, BarChart3, CalendarDays } from 'lucide-react';
import { Repeat } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppMode } from '@/contexts/AppModeContext.jsx';

const navItems = [
  { icon: Home, label: 'Hoje', path: '/' },
  { icon: NotebookPen, label: 'Descarregar mente', path: '/descarregar-mente' },
  { icon: Sparkles, label: 'Plano Clareado', path: '/plano-clareado' },
  { icon: Clock3, label: 'Aguardando retorno', path: '/aguardando-retorno' },
  { icon: CalendarDays, label: 'Calendário', path: '/calendario' },
  { icon: Repeat, label: 'Rotinas', path: '/rotinas' },
  { icon: FolderKanban, label: 'Projetos', path: '/projects' },
  { icon: BarChart3, label: 'Relatórios', path: '/relatorios' },
  { icon: Settings, label: 'Configurações', path: '/configuracoes' },
];

export default function Sidebar({ compact = false }) {
  const { isDailyMode, dailyNavPaths } = useAppMode();
  const visibleItems = isDailyMode
    ? navItems.filter((item) => dailyNavPaths.includes(item.path))
    : navItems;

  return (
    <aside className={cn(
      'hidden md:flex flex-col border-r border-border bg-card/50 min-h-[calc(100vh-4rem)] sticky top-16',
      compact ? 'w-52' : 'w-64'
    )}>
      <nav className={cn('flex-1 py-6 space-y-1.5', compact ? 'px-3' : 'px-4')}>
        {visibleItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => cn(
              'flex items-center gap-3 rounded-lg text-sm font-medium transition-colors',
              compact ? 'px-2.5 py-2' : 'px-3 py-2.5',
              isActive 
                ? 'bg-primary/10 text-primary' 
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <item.icon className={cn('h-5 w-5', compact && 'h-4.5 w-4.5')} />
            <span className={cn(compact && 'text-[13px]')}>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
