import React, { useEffect, useState } from 'react';
import { Battery, Brain, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useTaskContext } from '@/hooks/useTaskContext.js';
import { cn } from '@/lib/utils';

const CAPACITY_OPTIONS = [
  { value: 'baixa', label: 'Energia baixa' },
  { value: 'média', label: 'Energia média' },
  { value: 'alta', label: 'Energia alta' },
];

const TIME_OPTIONS = [
  { value: '15min', label: '15 min' },
  { value: '30min', label: '30 min' },
  { value: '1h', label: '1h' },
  { value: '2h', label: '2h ou mais' },
];

export default function CheckInCard({ compact = false }) {
  const { checkIn, setCheckIn, hasTodayCheckIn, isCheckInEditing, openCheckInEditor } = useTaskContext();
  const [energia, setEnergia] = useState(checkIn?.energia || 'média');
  const [tempo, setTempo] = useState(checkIn?.tempo || '2h');
  const [mente, setMente] = useState(checkIn?.mente || 'normal');
  const [prioridadePrincipal, setPrioridadePrincipal] = useState(checkIn?.prioridadePrincipal || '');
  const [showFineTune, setShowFineTune] = useState(false);

  useEffect(() => {
    setEnergia(checkIn?.energia || 'média');
    setTempo(checkIn?.tempo || '2h');
    setMente(checkIn?.mente || 'normal');
    setPrioridadePrincipal(checkIn?.prioridadePrincipal || '');
  }, [checkIn]);

  if (hasTodayCheckIn && !isCheckInEditing) {
    const capacityLabel = CAPACITY_OPTIONS.find((option) => option.value === checkIn?.energia)?.label || 'Energia média';
    const timeLabel = TIME_OPTIONS.find((option) => option.value === checkIn?.tempo)?.label || checkIn?.tempo || '2h';
    return (
      <div className={cn('mb-8 flex min-h-11 flex-wrap items-center justify-between gap-3 border-b border-border py-3', compact && 'mx-auto max-w-2xl')}>
        <p className="text-sm font-medium text-foreground">{capacityLabel} · {timeLabel} disponíveis</p>
        <Button size="sm" variant="ghost" onClick={openCheckInEditor}>Ajustar</Button>
      </div>
    );
  }

  return (
    <Card className={cn('mb-8 border-border bg-card shadow-sm', compact && 'mx-auto max-w-3xl')}>
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div><h2 className="text-lg">Como está sua energia agora?</h2><p className="mt-1 text-sm text-muted-foreground">Uma estimativa já é suficiente.</p></div>
        <SelectionGroup icon={Battery} options={CAPACITY_OPTIONS} selected={energia} onSelect={setEnergia} />

        <div><h3 className="text-base">Quanto tempo você tem?</h3></div>
        <SelectionGroup icon={Clock} options={TIME_OPTIONS} selected={tempo} onSelect={setTempo} />

        <details className="rounded-md border border-border px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium">Tenho algo urgente hoje</summary>
          <div className="mt-3 space-y-2">
            <label htmlFor="today-essential" className="text-sm text-muted-foreground">O que precisa acontecer? <span>(opcional)</span></label>
            <Input id="today-essential" value={prioridadePrincipal} onChange={(event) => setPrioridadePrincipal(event.target.value)} />
          </div>
        </details>

        <button type="button" className="text-sm font-medium text-primary hover:underline" onClick={() => setShowFineTune((value) => !value)} aria-expanded={showFineTune}>
          Quer ajustar melhor a sugestão?
        </button>
        {showFineTune && (
          <div className="space-y-3 rounded-md bg-muted p-4">
            <div className="flex items-center gap-2 text-sm font-medium"><Brain className="h-4 w-4" />Como está sua mente?</div>
            <SelectionGroup options={[{ value: 'sobrecarregada', label: 'Sobrecarregada' }, { value: 'normal', label: 'Normal' }, { value: 'tranquila', label: 'Tranquila' }]} selected={mente} onSelect={setMente} />
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={() => setCheckIn({ energia, mente, tempo, prioridadePrincipal })}>Encontrar meu próximo passo</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SelectionGroup({ icon: Icon, options, selected, onSelect }) {
  return (
    <div className="flex flex-wrap gap-2" role="group">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onSelect(option.value)}
          aria-pressed={selected === option.value}
          className={cn('min-h-11 rounded-md border px-4 py-2 text-base transition-colors', selected === option.value ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background hover:bg-muted')}
        >
          {Icon && <Icon className="mr-2 inline h-4 w-4" aria-hidden="true" />}{option.label}
        </button>
      ))}
    </div>
  );
}