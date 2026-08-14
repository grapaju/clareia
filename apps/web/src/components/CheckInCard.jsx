
import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Battery, Brain, Clock, Sparkles } from 'lucide-react';
import { useTaskContext } from '@/hooks/useTaskContext.js';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';

const CheckInCard = ({ compact = false }) => {
  const { checkIn, setCheckIn, hasTodayCheckIn, isCheckInEditing, openCheckInEditor } = useTaskContext();
  
  const [energia, setEnergia] = useState(checkIn?.energia || 'média');
  const [mente, setMente] = useState(checkIn?.mente || 'normal');
  const [tempo, setTempo] = useState(checkIn?.tempo || '2h');
  const [prioridadePrincipal, setPrioridadePrincipal] = useState(checkIn?.prioridadePrincipal || '');

  useEffect(() => {
    setEnergia(checkIn?.energia || 'média');
    setMente(checkIn?.mente || 'normal');
    setTempo(checkIn?.tempo || '2h');
    setPrioridadePrincipal(checkIn?.prioridadePrincipal || '');
  }, [checkIn?.energia, checkIn?.mente, checkIn?.tempo, checkIn?.prioridadePrincipal]);

  const handleUpdate = () => {
    setCheckIn({ energia, mente, tempo, prioridadePrincipal });
    toast.success('Check-in atualizado! Sua agenda foi reorganizada.', { icon: <Sparkles className="w-4 h-4 text-primary" /> });
  };

  if (hasTodayCheckIn && !isCheckInEditing) {
    return (
      <Card className={`bg-secondary/20 border-border mb-8 shadow-sm ${compact ? 'max-w-2xl mx-auto' : ''}`}>
        <CardContent className={`${compact ? 'p-3' : 'p-4 md:p-5'} flex flex-col md:flex-row md:items-center gap-3 md:gap-5 justify-between`}>
          <p className={`${compact ? 'text-sm' : 'text-sm md:text-base'} text-foreground font-medium`}>
            Hoje: energia {checkIn?.energia || 'média'} · mente {checkIn?.mente || 'normal'} · {checkIn?.tempo || '2h'} disponíveis
          </p>
          {checkIn?.prioridadePrincipal && (
            <p className="text-xs text-muted-foreground">Prioridade principal: {checkIn.prioridadePrincipal}</p>
          )}
          <Button size={compact ? 'sm' : 'default'} variant="outline" onClick={openCheckInEditor} className="rounded-xl border-border text-foreground hover:bg-muted">
            Alterar check-in
          </Button>
        </CardContent>
      </Card>
    );
  }

  const SelectionGroup = ({ icon: Icon, title, options, selected, onSelect }) => (
    <div className="flex-1 min-w-[200px]">
      <div className="flex items-center gap-2 mb-3 text-sm font-medium text-muted-foreground">
        <Icon className="w-4 h-4" />
        <span>{title}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => onSelect(opt)}
            className={cn(
              "px-3 py-1.5 text-sm rounded-lg transition-all border",
              selected === opt 
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-card text-foreground border-border hover:bg-muted"
            )}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <Card className={`bg-secondary/30 border-border mb-8 shadow-sm ${compact ? 'max-w-3xl mx-auto' : ''}`}>
      <CardContent className={compact ? 'p-4' : 'p-6'}>
        <h3 className={`${compact ? 'text-base' : 'text-lg'} font-medium text-foreground mb-4`}>Check-in diário</h3>
        <div className="flex flex-col md:flex-row gap-6 mb-6">
          <SelectionGroup 
            icon={Battery} 
            title="Energia" 
            options={['baixa', 'média', 'alta']} 
            selected={energia} 
            onSelect={setEnergia} 
          />
          <SelectionGroup 
            icon={Brain} 
            title="Mente" 
            options={['sobrecarregada', 'normal', 'tranquila']} 
            selected={mente} 
            onSelect={setMente} 
          />
          <SelectionGroup 
            icon={Clock} 
            title="Tempo disponível hoje" 
            options={['30min', '1h', '2h', '4h', 'dia inteiro']} 
            selected={tempo} 
            onSelect={setTempo} 
          />
        </div>
        <div className="mb-6 space-y-2">
          <label htmlFor="prioridade-principal" className="text-sm font-medium text-muted-foreground">Prioridade principal do dia</label>
          <Input
            id="prioridade-principal"
            value={prioridadePrincipal}
            onChange={(event) => setPrioridadePrincipal(event.target.value)}
            placeholder="Ex.: enviar proposta para cliente X"
          />
        </div>
        <div className="flex justify-end">
          <Button size={compact ? 'sm' : 'default'} onClick={handleUpdate} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            Salvar check-in do dia
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default CheckInCard;
