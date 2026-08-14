
import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { Receipt, CheckCircle2 } from 'lucide-react';
import Header from '@/components/Header.jsx';
import Sidebar from '@/components/Sidebar.jsx';
import MobileNav from '@/components/MobileNav.jsx';
import BillingCard from '@/components/BillingCard.jsx';
import { useBillingContext } from '@/hooks/useBillingContext.js';

function BillingSection({ title, charges, onMarkPaid, onMarkSent }) {
  const [showAll, setShowAll] = useState(false);
  if (charges.length === 0) return null;
  
  const displayCharges = showAll ? charges : charges.slice(0, 3);

  return (
    <div className="mb-12 animate-in">
      <h2 className="text-xl font-medium text-foreground mb-5 pb-2 border-b border-border flex items-center justify-between">
        {title}
        <span className="text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded-md">{charges.length}</span>
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {displayCharges.map(charge => (
          <BillingCard 
            key={charge.id} 
            charge={charge} 
            onMarkPaid={onMarkPaid}
            onMarkSent={onMarkSent}
          />
        ))}
      </div>
      {charges.length > 3 && (
        <div className="mt-6 flex justify-center">
          <button onClick={() => setShowAll(!showAll)} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            {showAll ? 'Ver menos' : `Mostrar mais ${charges.length - 3} cobranças`}
          </button>
        </div>
      )}
    </div>
  );
}

export default function BillingPage() {
  const { charges, updateCharge, markAsPaid } = useBillingContext();

  const todayStr = new Date().toISOString().split('T')[0];

  const categories = {
    aEnviar: [],
    venceHoje: [],
    vencidas: [],
    aguardando: [],
    pagas: []
  };

  charges.forEach(c => {
    if (c.status === 'Paga') {
      categories.pagas.push(c);
    } else if (c.status === 'A enviar') {
      categories.aEnviar.push(c);
    } else {
      if (c.dueDate < todayStr) {
        categories.vencidas.push(c);
      } else if (c.dueDate === todayStr) {
        categories.venceHoje.push(c);
      } else {
        categories.aguardando.push(c);
      }
    }
  });

  const handleMarkSent = (id) => updateCharge(id, { status: 'Enviada aguardando pagamento' });

  return (
    <>
      <Helmet><title>Cobranças - Clareia</title></Helmet>
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 pb-20 md:pb-8">
            <div className="page-container section-spacing">
              
              <div className="mb-10">
                <div className="flex items-center gap-3 mb-3">
                  <Receipt className="w-8 h-8 text-primary" />
                  <h1 className="text-3xl font-medium text-foreground">Acompanhe suas cobranças</h1>
                </div>
                <p className="text-lg text-muted-foreground">
                  Fique em dia com a saúde do seu negócio sem estresse.
                </p>
              </div>

              <BillingSection title="A enviar" charges={categories.aEnviar} onMarkPaid={markAsPaid} onMarkSent={handleMarkSent} />
              <BillingSection title="Vence hoje" charges={categories.venceHoje} onMarkPaid={markAsPaid} />
              <BillingSection title="Cobranças pendentes (Vencidas)" charges={categories.vencidas} onMarkPaid={markAsPaid} />
              <BillingSection title="Enviadas, aguardando pagamento" charges={categories.aguardando} onMarkPaid={markAsPaid} />
              <BillingSection title="Pagas recentemente" charges={categories.pagas} />

              {charges.length === 0 && (
                <div className="text-center py-16 bg-card border border-border rounded-xl shadow-sm">
                  <CheckCircle2 className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <h2 className="text-xl font-medium text-foreground mb-2">Sem cobranças</h2>
                  <p className="text-muted-foreground">Você não possui faturas cadastradas no momento.</p>
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
