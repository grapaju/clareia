
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, Zap, Play, Pause, CheckCircle2 } from 'lucide-react';

export default function NextActionCard({ task, reason, onStart, onDefer, onComplete }) {
  if (!task) return null;

  return (
    <Card className="bg-primary/5 border-primary/20">
      <CardContent className="p-6">
        <div className="flex flex-col gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold text-foreground">What to do now</h3>
            </div>
            <p className="text-sm text-muted-foreground">{reason}</p>
          </div>

          <div className="bg-card rounded-xl p-4 border border-border">
            <h4 className="font-semibold text-foreground text-xl mb-2">
              {task.title}
            </h4>
            
            <div className="flex flex-wrap gap-2 mb-3">
              {task.project && (
                <Badge variant="outline" className="text-xs">
                  {task.project}
                </Badge>
              )}
              {task.estimatedTime && (
                <Badge variant="secondary" className="text-xs">
                  <Clock className="w-3 h-3 mr-1" />
                  {task.estimatedTime} min
                </Badge>
              )}
            </div>

            {task.nextAction && (
              <div className="bg-accent/50 rounded-lg p-3 mb-4">
                <p className="text-sm text-accent-foreground">
                  <span className="font-medium">First action:</span> {task.nextAction}
                </p>
              </div>
            )}

            <div className="flex gap-2">
              {onStart && (
                <Button
                  onClick={() => onStart(task)}
                  className="flex-1 transition-all duration-200 active:scale-[0.98]"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Start working
                </Button>
              )}
              {onComplete && (
                <Button
                  onClick={() => onComplete(task.id)}
                  variant="outline"
                  className="transition-all duration-200 active:scale-[0.98]"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Complete
                </Button>
              )}
              {onDefer && (
                <Button
                  onClick={() => onDefer(task.id)}
                  variant="outline"
                  className="transition-all duration-200 active:scale-[0.98]"
                >
                  <Pause className="w-4 h-4 mr-2" />
                  Defer
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
