
import React from 'react';
import { AlertCircle, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

export function NotificationBanner({ notifications }) {
  if (!notifications || notifications.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 mb-6">
      {notifications.map((notif, index) => {
        const isUrgent = notif.type === 'overdue';
        const Icon = isUrgent ? AlertCircle : Calendar;
        
        return (
          <div 
            key={index}
            className={cn(
              "flex items-center gap-3 p-3 rounded-lg border text-sm font-medium",
              isUrgent 
                ? "bg-destructive/10 border-destructive/20 text-destructive"
                : "bg-orange-500/10 border-orange-500/20 text-orange-600 dark:text-orange-400"
            )}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span>{notif.message}</span>
          </div>
        );
      })}
    </div>
  );
}
