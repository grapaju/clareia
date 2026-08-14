
import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { ListTodo, CheckCircle2 } from 'lucide-react';
import Header from '@/components/Header.jsx';
import Sidebar from '@/components/Sidebar.jsx';
import MobileNav from '@/components/MobileNav.jsx';
import TaskCard from '@/components/TaskCard.jsx';
import { Button } from '@/components/ui/button';
import { useTaskContext } from '@/hooks/useTaskContext.js';
import { suggestPriority } from '@/lib/autoSuggestions';

function PrioritySection({ title, tasks, onComplete }) {
  const [showAll, setShowAll] = useState(false);
  if (tasks.length === 0) return null;
  
  const displayTasks = showAll ? tasks : tasks.slice(0, 3);

  return (
    <div className="mb-12 animate-in">
      <h2 className="text-xl font-medium text-foreground mb-5 pb-2 border-b border-border flex items-center justify-between">
        {title}
        <span className="text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded-md">{tasks.length}</span>
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {displayTasks.map(task => (
          <TaskCard 
            key={task.id} 
            task={task} 
            onComplete={onComplete}
            minimal={true}
          />
        ))}
      </div>
      {tasks.length > 3 && (
        <div className="mt-6 flex justify-center">
          <Button variant="outline" onClick={() => setShowAll(!showAll)} className="text-muted-foreground">
            {showAll ? 'Ver menos' : `Mostrar mais ${tasks.length - 3} tarefas`}
          </Button>
        </div>
      )}
    </div>
  );
}

export default function PrioritiesPage() {
  const { tasks, completeTask } = useTaskContext();
  const activeTasks = tasks.filter(t => t.status !== 'Concluída');

  const categories = {
    hojeSemFalta: [],
    emRisco: [],
    rapidas: [],
    estaSemana: [],
    aguardando: [],
    grandesDemais: []
  };

  activeTasks.forEach(t => {
    const p = suggestPriority(t.title, t.dueDate, t.status, t.updated);
    if (t.status === 'Aguardando') {
      categories.aguardando.push(t);
    } else if (p.color === 'red' || p.color === 'orange') {
      categories.hojeSemFalta.push(t);
    } else if (p.color === 'yellow') {
      categories.emRisco.push(t);
    } else if (t.timeEstimate && t.timeEstimate <= 30) {
      categories.rapidas.push(t);
    } else if (t.timeEstimate && t.timeEstimate > 90 && (!t.steps || t.steps.length === 0)) {
      categories.grandesDemais.push(t);
    } else {
      categories.estaSemana.push(t);
    }
  });

  return (
    <>
      <Helmet><title>Prioridades - Clareia</title></Helmet>
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 pb-20 md:pb-8">
            <div className="page-container section-spacing">
              
              <div className="mb-10">
                <div className="flex items-center gap-3 mb-3">
                  <ListTodo className="w-8 h-8 text-primary" />
                  <h1 className="text-3xl font-medium text-foreground">O que merece seu foco</h1>
                </div>
                <p className="text-lg text-muted-foreground">
                  Tarefas organizadas para não sobrecarregar você.
                </p>
              </div>

              <PrioritySection title="Hoje sem falta" tasks={categories.hojeSemFalta} onComplete={completeTask} />
              <PrioritySection title="Em risco (paradas há tempos)" tasks={categories.emRisco} onComplete={completeTask} />
              <PrioritySection title="Rápidas (até 30 min)" tasks={categories.rapidas} onComplete={completeTask} />
              <PrioritySection title="Esta semana" tasks={categories.estaSemana} onComplete={completeTask} />
              <PrioritySection title="Grandes demais: quebre em passos" tasks={categories.grandesDemais} onComplete={completeTask} />
              <PrioritySection title="Aguardando alguém" tasks={categories.aguardando} onComplete={completeTask} />

              {activeTasks.length === 0 && (
                <div className="text-center py-16 bg-card border border-border rounded-xl shadow-sm">
                  <CheckCircle2 className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <h2 className="text-xl font-medium text-foreground mb-2">Sem prioridades abertas</h2>
                  <p className="text-muted-foreground">Tudo está incrivelmente em dia. Aproveite o momento!</p>
                </div>
              )}
            </div>
          </main>
        </div>
        <MobileNav />
      </div>
    </>
  );
}
