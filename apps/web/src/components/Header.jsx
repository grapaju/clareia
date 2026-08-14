
import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Sparkles, LogOut, Bell, MoreHorizontal } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/contexts/ThemeContext.jsx';
import { useAppMode } from '@/contexts/AppModeContext.jsx';
import { useTaskContext } from '@/hooks/useTaskContext.js';
import { saveImprovementForLater } from '@/lib/improvementCapture.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

const SCREEN_OPTIONS = [
  { value: 'Hoje', label: 'Hoje' },
  { value: 'Descarregar mente', label: 'Descarregar mente' },
  { value: 'Aguardando retorno', label: 'Aguardando retorno' },
  { value: 'Projetos', label: 'Projetos' },
  { value: 'Relatórios', label: 'Relatórios' },
  { value: 'Configurações', label: 'Configurações' },
  { value: 'Outra', label: 'Outra' }
];

export default function Header({ notificationCount = 0, onOpenNotifications }) {
  const { isAuthenticated, logout } = useAuth();
  const { lowStimulationMode, toggleLowStimulationMode } = useTheme();
  const { addTask } = useTaskContext();
  const { mode, isDailyMode, requestModeChange } = useAppMode();
  const navigate = useNavigate();
  const location = useLocation();
  const [improvementOpen, setImprovementOpen] = React.useState(false);
  const [isSavingImprovement, setIsSavingImprovement] = React.useState(false);
  const [devBlockOpen, setDevBlockOpen] = React.useState(false);
  const [improvementDraft, setImprovementDraft] = React.useState({
    title: '',
    relatedScreen: 'Hoje',
    description: '',
    priority: 'media',
    reviewWhen: 'esta_semana',
    includeInToday: false
  });

  React.useEffect(() => {
    const route = location.pathname;
    if (route.startsWith('/descarregar-mente')) {
      setImprovementDraft((prev) => ({ ...prev, relatedScreen: 'Descarregar mente' }));
      return;
    }
    if (route.startsWith('/aguardando-retorno')) {
      setImprovementDraft((prev) => ({ ...prev, relatedScreen: 'Aguardando retorno' }));
      return;
    }
    if (route.startsWith('/projects')) {
      setImprovementDraft((prev) => ({ ...prev, relatedScreen: 'Projetos' }));
      return;
    }
    if (route.startsWith('/relatorios')) {
      setImprovementDraft((prev) => ({ ...prev, relatedScreen: 'Relatórios' }));
      return;
    }
    if (route.startsWith('/configuracoes')) {
      setImprovementDraft((prev) => ({ ...prev, relatedScreen: 'Configurações' }));
      return;
    }
    setImprovementDraft((prev) => ({ ...prev, relatedScreen: 'Hoje' }));
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleModeToggle = () => {
    if (mode === 'development') {
      requestModeChange('daily');
      toast.success('Modo Uso Diário ativado.');
      navigate('/');
      return;
    }

    const result = requestModeChange('development');
    if (result?.blocked) {
      setDevBlockOpen(true);
      return;
    }

    toast.success('Modo Desenvolvimento ativado.');
  };

  const handleForceDevelopment = () => {
    requestModeChange('development', { force: true });
    setDevBlockOpen(false);
    toast.message('Modo Desenvolvimento liberado manualmente para este momento.');
  };

  const handleSaveImprovement = async () => {
    setIsSavingImprovement(true);
    try {
      await saveImprovementForLater({
        addTask,
        title: improvementDraft.title,
        relatedScreen: improvementDraft.relatedScreen,
        description: improvementDraft.description,
        priority: improvementDraft.priority,
        reviewWhen: improvementDraft.reviewWhen,
        includeInToday: improvementDraft.includeInToday
      });

      toast.success('Melhoria guardada no projeto Clareia.');
      setImprovementOpen(false);
      setImprovementDraft((prev) => ({
        ...prev,
        title: '',
        description: '',
        priority: 'media',
        reviewWhen: 'esta_semana',
        includeInToday: false
      }));
    } catch (error) {
      console.error(error);
      toast.error(error?.message || 'Não foi possível guardar a melhoria.');
    } finally {
      setIsSavingImprovement(false);
    }
  };

  return (
    <>
    <header className="bg-card border-b border-border sticky top-0 z-40">
      <div className="page-container">
        <div className="flex items-center justify-between h-16 gap-2">
          <Link to="/" className="flex items-center gap-2 text-foreground hover:text-primary transition-colors duration-200">
            <Sparkles className="w-6 h-6 text-primary" />
            <span className="text-xl font-semibold">Clareia</span>
          </Link>

          <div className="flex items-center gap-2">
            <ThemeToggle />

            {isAuthenticated && (
              <Button
                variant={isDailyMode ? 'default' : 'outline'}
                size="sm"
                onClick={handleModeToggle}
                className="hidden lg:inline-flex"
              >
                {isDailyMode ? 'Modo Uso Diario' : 'Modo Desenvolvimento'}
              </Button>
            )}

            {isAuthenticated && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setImprovementOpen(true)}
                className="hidden md:inline-flex"
              >
                Guardar melhoria para depois
              </Button>
            )}

            {isAuthenticated && (
              <Button
                variant={lowStimulationMode ? 'default' : 'outline'}
                size="sm"
                onClick={toggleLowStimulationMode}
                className="hidden sm:inline-flex"
              >
                {lowStimulationMode ? 'Baixa estimulação: ON' : 'Baixa estimulação'}
              </Button>
            )}
            
            {isAuthenticated && (
              <>
                <Button variant="ghost" size="icon" onClick={onOpenNotifications} className="relative text-muted-foreground hover:text-foreground">
                  <Bell className="w-5 h-5" />
                  {notificationCount > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full" />
                  )}
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                      <MoreHorizontal className="w-5 h-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setImprovementOpen(true)}>
                      Guardar melhoria para depois
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleModeToggle}>
                      {isDailyMode ? 'Entrar em Modo Desenvolvimento' : 'Voltar para Modo Uso Diário'}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate('/configuracoes')}>
                      Ajustar regras de desenvolvimento
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-foreground">
                  <LogOut className="w-4 h-4 mr-2 hidden sm:inline" />
                  Sair
                </Button>
              </>
            )}
            
            {!isAuthenticated && (
              <Button onClick={() => navigate('/login')} size="sm">
                Entrar
              </Button>
            )}
          </div>
        </div>
        {isAuthenticated && isDailyMode && (
          <div className="pb-2">
            <p className="text-xs text-muted-foreground">Hoje o Clareia é ferramenta, não projeto.</p>
          </div>
        )}
      </div>
    </header>

    <Dialog open={improvementOpen} onOpenChange={setImprovementOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Guardar melhoria para depois</DialogTitle>
          <DialogDescription>
            Registre a ideia sem interromper sua execução agora.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="improvement-title">Título da melhoria</Label>
            <Input
              id="improvement-title"
              value={improvementDraft.title}
              onChange={(event) => setImprovementDraft((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="Ex.: Simplificar filtro de tarefas"
            />
          </div>

          <div className="space-y-2">
            <Label>Tela relacionada</Label>
            <Select value={improvementDraft.relatedScreen} onValueChange={(value) => setImprovementDraft((prev) => ({ ...prev, relatedScreen: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a tela" />
              </SelectTrigger>
              <SelectContent>
                {SCREEN_OPTIONS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="improvement-description">Descrição</Label>
            <Textarea
              id="improvement-description"
              rows={4}
              value={improvementDraft.description}
              onChange={(event) => setImprovementDraft((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="Contexto da melhoria, impacto esperado e critério de sucesso."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select value={improvementDraft.priority} onValueChange={(value) => setImprovementDraft((prev) => ({ ...prev, priority: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Revisar em</Label>
              <Select value={improvementDraft.reviewWhen} onValueChange={(value) => setImprovementDraft((prev) => ({ ...prev, reviewWhen: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hoje">Hoje</SelectItem>
                  <SelectItem value="esta_semana">Esta semana</SelectItem>
                  <SelectItem value="sabado">Sábado</SelectItem>
                  <SelectItem value="algum_dia">Algum dia</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <label className="flex items-center gap-2 rounded-lg border border-border p-3">
            <Checkbox
              checked={improvementDraft.includeInToday}
              onCheckedChange={(checked) => setImprovementDraft((prev) => ({ ...prev, includeInToday: Boolean(checked) }))}
            />
            <span className="text-sm text-foreground">Adicionar na tela Hoje agora</span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setImprovementOpen(false)} disabled={isSavingImprovement}>Cancelar</Button>
          <Button onClick={handleSaveImprovement} disabled={isSavingImprovement}>{isSavingImprovement ? 'Salvando...' : 'Guardar melhoria'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <AlertDialog open={devBlockOpen} onOpenChange={setDevBlockOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Bloqueio gentil de desenvolvimento</AlertDialogTitle>
          <AlertDialogDescription>
            Essa melhoria pode esperar. Vou guardar para depois para você continuar no fluxo de execução.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => { setDevBlockOpen(false); navigate('/'); }}>Voltar para Hoje</AlertDialogCancel>
          <AlertDialogAction onClick={() => { setDevBlockOpen(false); setImprovementOpen(true); }}>
            Guardar melhoria
          </AlertDialogAction>
          <AlertDialogAction onClick={handleForceDevelopment} className="bg-secondary text-secondary-foreground hover:bg-secondary/80">
            Continuar mesmo assim
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
