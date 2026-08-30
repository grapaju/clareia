import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Clock3, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import Header from '@/components/Header.jsx';
import Sidebar from '@/components/Sidebar.jsx';
import MobileNav from '@/components/MobileNav.jsx';
import ProjectSelect from '@/components/ProjectSelect.jsx';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import {
  createWaitingReturn,
  deleteWaitingReturnEverywhere,
  listWaitingReturns,
  syncWaitingReturnsWithCloud,
  updateWaitingReturn
} from '@/services/waitingReturnService.js';

const STATUS_OPTIONS = ['Aguardando retorno', 'Concluido'];

export default function WaitingReturnPage() {
  const [items, setItems] = useState(() => listWaitingReturns());
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [form, setForm] = useState({
    title: '',
    project: '',
    contactName: '',
    waitingFor: '',
    lastContactDate: '',
    reminderDate: '',
    nextFollowUp: '',
    nextFollowUpDate: '',
    observations: '',
    status: 'Aguardando retorno'
  });

  const openCount = useMemo(() => items.filter((item) => item.status !== 'Concluido').length, [items]);

  const refresh = () => setItems(listWaitingReturns());

  useEffect(() => {
    syncWaitingReturnsWithCloud().then(() => refresh());
  }, []);

  const handleCreate = () => {
    const created = createWaitingReturn({
      ...form,
      title: form.title || form.waitingFor,
      status: form.status || 'Aguardando retorno'
    });
    if (!created) {
      toast.error('Preencha titulo, projeto, contato e o que está aguardando.');
      return;
    }

    setForm({
      title: '',
      project: '',
      contactName: '',
      waitingFor: '',
      lastContactDate: '',
      reminderDate: '',
      nextFollowUp: '',
      nextFollowUpDate: '',
      observations: '',
      status: 'Aguardando retorno'
    });
    setShowAdvanced(false);
    refresh();
    syncWaitingReturnsWithCloud();
    toast.success('Item em aguardando retorno criado.');
  };

  const handleToggleDone = (item) => {
    updateWaitingReturn(item.id, {
      status: item.status === 'Concluido' ? 'Aguardando retorno' : 'Concluido'
    });
    refresh();
    syncWaitingReturnsWithCloud();
  };

  const handleDelete = (id) => {
    setItemToDelete(id);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      await deleteWaitingReturnEverywhere(itemToDelete);
      refresh();
      setItemToDelete(null);
      toast.success('Acompanhamento removido.');
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível remover o acompanhamento.');
    }
  };

  return (
    <>
      <Helmet><title>Aguardando retorno - Clareia</title></Helmet>
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 pb-20 md:pb-8">
            <div className="page-container section-spacing max-w-5xl">
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                  <Clock3 className="w-7 h-7 text-primary" />
                  <h1 className="text-3xl font-medium text-foreground">Aguardando retorno</h1>
                </div>
                <p className="text-muted-foreground">Separar dependências externas reduz ansiedade de execução e melhora retomada.</p>
              </div>

              <Card className="bg-card border-border shadow-sm mb-6">
                <CardContent className="p-6 space-y-4">
                  <h2 className="text-lg font-medium">Novo acompanhamento</h2>
                  <p className="text-sm text-muted-foreground">Modo simples para registrar rápido sem sobrecarga.</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-2 md:col-span-2"><Label>O que estou aguardando?</Label><Textarea value={form.waitingFor} onChange={(e) => setForm((c) => ({ ...c, waitingFor: e.target.value }))} className="min-h-20" /></div>
                    <div className="space-y-2"><Label>De quem?</Label><Input value={form.contactName} onChange={(e) => setForm((c) => ({ ...c, contactName: e.target.value }))} /></div>
                    <div className="space-y-2"><Label>Projeto</Label><ProjectSelect value={form.project} onChange={(project) => setForm((current) => ({ ...current, project }))} /></div>
                    <div className="space-y-2"><Label>Quando lembrar?</Label><Input type="date" value={form.reminderDate} onChange={(e) => setForm((c) => ({ ...c, reminderDate: e.target.value, nextFollowUpDate: e.target.value }))} /></div>
                    <div className="space-y-2"><Label>Título (opcional)</Label><Input value={form.title} onChange={(e) => setForm((c) => ({ ...c, title: e.target.value }))} placeholder="Se vazio, usa o texto de aguardando" /></div>
                  </div>

                  <Button variant="outline" onClick={() => setShowAdvanced((prev) => !prev)}>
                    {showAdvanced ? 'Ocultar detalhes avançados' : 'Mostrar detalhes avançados'}
                  </Button>

                  {showAdvanced && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 rounded-lg border border-border p-4">
                      <div className="space-y-2"><Label>Último contato</Label><Input type="date" value={form.lastContactDate} onChange={(e) => setForm((c) => ({ ...c, lastContactDate: e.target.value }))} /></div>
                      <div className="space-y-2"><Label>Status</Label><Select value={form.status} onValueChange={(value) => setForm((c) => ({ ...c, status: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STATUS_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select></div>
                      <div className="space-y-2 md:col-span-2"><Label>Próximo follow-up</Label><Input value={form.nextFollowUp} onChange={(e) => setForm((c) => ({ ...c, nextFollowUp: e.target.value }))} placeholder="Ex.: cobrar resposta por WhatsApp" /></div>
                      <div className="space-y-2 md:col-span-2"><Label>Observações</Label><Textarea value={form.observations} onChange={(e) => setForm((c) => ({ ...c, observations: e.target.value }))} className="min-h-20" /></div>
                    </div>
                  )}
                  <Button onClick={handleCreate}><Plus className="w-4 h-4 mr-2" /> Salvar acompanhamento</Button>
                </CardContent>
              </Card>

              <Card className="bg-card border-border shadow-sm">
                <CardContent className="p-6 space-y-4">
                  <h2 className="text-lg font-medium">Acompanhamentos ({openCount} abertos)</h2>
                  {items.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum item em aguardando retorno.</p>
                  ) : (
                    <ul className="space-y-3">
                      {items.map((item) => (
                        <li key={item.id} className="rounded-lg border border-border p-3">
                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div>
                              <p className="text-sm font-medium text-foreground">{item.title}</p>
                              <p className="text-xs text-muted-foreground">Projeto: {item.project} • Contato: {item.contactName}</p>
                              <p className="text-xs text-foreground mt-2">{item.waitingFor}</p>
                              {item.observations && <p className="text-xs text-muted-foreground mt-1">Obs.: {item.observations}</p>}
                              <p className="text-xs text-muted-foreground mt-2">Follow-up: {item.nextFollowUp || '-'} {item.nextFollowUpDate ? `(${item.nextFollowUpDate})` : ''}</p>
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => handleToggleDone(item)}>
                                <CheckCircle2 className="w-4 h-4 mr-2" />
                                {item.status === 'Concluido' ? 'Reabrir' : 'Concluir'}
                              </Button>
                              <Button size="sm" variant="outline" className="text-destructive" onClick={() => handleDelete(item.id)}>
                                <Trash2 className="w-4 h-4 mr-2" /> Excluir
                              </Button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
        <MobileNav />

        <AlertDialog open={Boolean(itemToDelete)} onOpenChange={(open) => !open && setItemToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir acompanhamento</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação remove o item de aguardando retorno permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </>
  );
}
