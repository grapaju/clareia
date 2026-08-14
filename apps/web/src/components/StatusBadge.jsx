
import React from 'react';
import { Badge } from '@/components/ui/badge';

export default function StatusBadge({ status }) {
  const variants = {
    inbox: { variant: 'outline', label: 'Inbox' },
    today: { variant: 'default', label: 'Today' },
    doing: { variant: 'default', label: 'In progress' },
    awaiting: { variant: 'secondary', label: 'Awaiting' },
    completed: { variant: 'outline', label: 'Completed' },
    deferred: { variant: 'secondary', label: 'Deferred' }
  };

  const config = variants[status] || variants.inbox;

  return (
    <Badge variant={config.variant} className="text-xs">
      {config.label}
    </Badge>
  );
}
