
import React from 'react';
import { Badge } from '@/components/ui/badge';

export default function PriorityBadge({ level }) {
  const variants = {
    high: { variant: 'destructive', label: 'High priority' },
    medium: { variant: 'secondary', label: 'Medium priority' },
    low: { variant: 'outline', label: 'Low priority' }
  };

  const config = variants[level] || variants.medium;

  return (
    <Badge variant={config.variant} className="text-xs">
      {config.label}
    </Badge>
  );
}
