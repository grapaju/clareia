import React from 'react';
import { BatteryMedium, Brain, Clock3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDurationFriendly } from '@/lib/reportFormatting.js';
import { getDayPanelState } from '@/lib/todayViewLogic.js';

export default function TodayDayPanel({ checkIn, availableMinutes, onAdjust }) {
  const panel = getDayPanelState(checkIn, availableMinutes);

  return (
    <section className="today-motion-card mb-4 w-full rounded-lg border border-border bg-card p-3 transition-[border-color,box-shadow,transform] duration-300" aria-labelledby="day-panel-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="day-panel-title" className="text-xs font-semibold uppercase tracking-wide text-primary">Painel do dia</h2>
        <Button className="h-7 px-2" size="sm" variant="ghost" onClick={onAdjust}>Ajustar</Button>
      </div>

      <div className="mt-1">
        <div className="day-gauge group relative mx-auto w-full max-w-[144px] text-center">
          <svg
            viewBox="0 0 180 104"
            className="day-gauge-svg h-auto w-full transition-transform duration-300 ease-out group-hover:scale-[1.04]"
            role="meter"
            aria-label={panel.accessibleLabel}
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow={panel.meterValue}
          >
            <path d="M 20 88 A 70 70 0 0 1 160 88" pathLength="100" fill="none" stroke="currentColor" strokeWidth="14" strokeLinecap="round" className="text-muted" />
            <path d="M 20 88 A 70 70 0 0 1 160 88" pathLength="100" fill="none" stroke="currentColor" strokeWidth="14" strokeLinecap="round" className="day-meter-arc day-gauge-arc text-primary" style={{ '--meter-value': panel.meterValue }} />
          </svg>
          <p className="-mt-7 text-lg font-semibold text-foreground transition-transform duration-300 ease-out group-hover:scale-105">{panel.rhythm}</p>
          <p className="text-[11px] text-muted-foreground">Ritmo sugerido para hoje</p>
        </div>

        <dl className="mt-2 divide-y divide-border border-t border-border">
          <DayDatum icon={BatteryMedium} label="Energia" value={panel.label.replace('Energia ', '')} />
          <DayDatum icon={Brain} label="Mente" value={panel.mindLabel.replace('Mente ', '')} />
          <DayDatum icon={Clock3} label="Disponível agora" value={panel.availableMinutes ? formatDurationFriendly(panel.availableMinutes) : 'Não informado'} />
        </dl>
      </div>
    </section>
  );
}

function DayDatum({ icon: Icon, label, value }) {
  return (
    <div className="group flex min-w-0 items-center justify-between gap-3 py-1.5">
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5 shrink-0 text-primary transition-[transform,filter] duration-300 ease-out group-hover:scale-110 group-hover:drop-shadow-[0_0_4px_hsl(var(--primary)/0.5)]" aria-hidden="true" />
        {label}
      </dt>
      <dd className="truncate text-sm font-medium capitalize text-foreground">{value}</dd>
    </div>
  );
}