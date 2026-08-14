
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DollarSign, Send, CheckCircle2, Pencil } from 'lucide-react';
import { toast } from 'sonner';

export default function BillingCard({ charge, onMarkPaid, onMarkSent }) {
  const formatAmount = (amount) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);
  };
  
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
    return d.toLocaleDateString('pt-BR');
  };

  const handleEditClick = (e) => {
    e.stopPropagation();
    toast.info('Edição de cobrança será implementada em breve.');
  };

  return (
    <Card className="card-hover h-full flex flex-col bg-card border-border shadow-sm">
      <CardContent className="p-5 flex flex-col h-full gap-3">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-medium text-lg text-foreground mb-1">{charge.client}</h3>
            <p className="text-sm text-muted-foreground line-clamp-1">{charge.description || 'Sem descrição'}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0" onClick={handleEditClick} aria-label="Editar cobrança">
            <Pencil className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-1 font-medium text-lg text-foreground">
            <DollarSign className="w-4 h-4 text-muted-foreground" />
            {formatAmount(charge.amount)}
          </div>
          <div className="text-sm text-muted-foreground">
            Vence: {formatDate(charge.dueDate)}
          </div>
        </div>

        <div className="flex gap-2 mt-auto pt-4">
          {charge.status === 'A enviar' && onMarkSent && (
            <Button size="sm" variant="outline" onClick={() => onMarkSent(charge.id)} className="flex-1">
              <Send className="w-4 h-4 mr-2" /> Enviar
            </Button>
          )}
          {charge.status !== 'Paga' && onMarkPaid && (
            <Button size="sm" onClick={() => onMarkPaid(charge.id)} className="flex-1 bg-success/10 text-success hover:bg-success/20 border-transparent">
              <CheckCircle2 className="w-4 h-4 mr-2" /> Recebido
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
