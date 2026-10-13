import React, { useEffect, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { listProjectWorkFrontsApi } from '@/services/projectWorkFrontsApiService.js';

function normalizeText(value) {
  return String(value || '').trim();
}

export default function WorkFrontSelect({ projectName = '', value = '', onChange, disabled = false, reloadKey = 0 }) {
  const [fronts, setFronts] = useState([]);

  useEffect(() => {
    const project = normalizeText(projectName);
    if (!project) {
      setFronts([]);
      return;
    }

    let active = true;
    listProjectWorkFrontsApi(project)
      .then((items) => {
        if (!active) return;
        setFronts(Array.isArray(items) ? items : []);
      })
      .catch(() => {
        if (!active) return;
        setFronts([]);
      });
    return () => {
      active = false;
    };
  }, [projectName, reloadKey]);

  const safeValue = normalizeText(value) || 'none';

  return (
    <Select
      value={safeValue}
      onValueChange={(nextValue) => onChange?.(nextValue === 'none' ? '' : nextValue)}
      disabled={disabled || !normalizeText(projectName)}
    >
      <SelectTrigger className="bg-background">
        <SelectValue placeholder="Sem frente" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">Sem frente</SelectItem>
        {fronts.map((front) => (
          <SelectItem key={front.id} value={String(front.id)}>
            {front.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
