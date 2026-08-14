
import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTaskContext } from '@/hooks/useTaskContext.js';
import { useBillingContext } from '@/hooks/useBillingContext.js';
import { toast } from 'sonner';

export function ReportExporter() {
  const { tasks } = useTaskContext();
  const { charges } = useBillingContext();
  const [loading, setLoading] = useState(false);

  const exportCSV = async () => {
    setLoading(true);
    try {
      // Dynamic import to keep bundle small
      const Papa = (await import('papaparse')).default;
      
      const taskData = tasks.map(t => ({
        Título: t.title,
        Projeto: t.project,
        Status: t.status,
        Tipo: t.type,
        'Tempo Estimado': t.estimatedTime
      }));

      const csv = Papa.unparse(taskData);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `clareia-relatorio-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Relatório CSV exportado com sucesso.');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao exportar CSV.');
    }
    setLoading(false);
  };

  const exportPDF = async () => {
    setLoading(true);
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      
      doc.setFontSize(20);
      doc.text("Relatório de Produtividade - Clareia", 20, 20);
      
      doc.setFontSize(12);
      doc.text(`Total de tarefas: ${tasks.length}`, 20, 40);
      doc.text(`Tarefas concluídas: ${tasks.filter(t => t.status === 'concluido').length}`, 20, 50);
      doc.text(`Cobranças pendentes: ${charges.filter(c => c.status !== 'paid').length}`, 20, 60);

      doc.save(`clareia-relatorio-${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success('Relatório PDF exportado com sucesso.');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao exportar PDF.');
    }
    setLoading(false);
  };

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={exportCSV} disabled={loading}>
        <Download className="w-4 h-4 mr-2" />
        CSV
      </Button>
      <Button variant="outline" size="sm" onClick={exportPDF} disabled={loading}>
        <Download className="w-4 h-4 mr-2" />
        PDF
      </Button>
    </div>
  );
}
