import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { KeyRound, UserRound } from 'lucide-react';
import Header from '@/components/Header.jsx';
import Sidebar from '@/components/Sidebar.jsx';
import MobileNav from '@/components/MobileNav.jsx';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { toast } from 'sonner';

function formatDate(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

export default function AccountPage() {
  const { currentUser, changePassword } = useAuth();
  const [form, setForm] = useState({
    currentPassword: '',
    newPassword: '',
    newPasswordConfirm: ''
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.currentPassword || !form.newPassword || !form.newPasswordConfirm) {
      toast.error('Preencha todos os campos de senha.');
      return;
    }

    if (form.newPassword !== form.newPasswordConfirm) {
      toast.error('A nova senha e a confirmacao precisam ser iguais.');
      return;
    }

    if (form.newPassword.length < 8) {
      toast.error('A nova senha precisa ter pelo menos 8 caracteres.');
      return;
    }

    setIsSaving(true);
    const result = await changePassword(form);

    if (result.success) {
      setForm({ currentPassword: '', newPassword: '', newPasswordConfirm: '' });
      toast.success('Senha alterada com sucesso.');
    } else {
      toast.error(result.error || 'Nao foi possivel alterar a senha.');
    }

    setIsSaving(false);
  };

  return (
    <>
      <Helmet>
        <title>Conta - Clareia</title>
      </Helmet>
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 pb-20 md:pb-8">
            <div className="page-container section-spacing max-w-3xl">
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-3">
                  <UserRound className="w-8 h-8 text-primary" />
                  <h1 className="text-3xl font-medium text-foreground">Conta</h1>
                </div>
                <p className="text-lg text-muted-foreground">Veja qual usuario esta conectado e atualize sua senha com seguranca.</p>
              </div>

              <Card className="bg-card border-border shadow-sm mb-6">
                <CardContent className="p-6 space-y-3">
                  <h2 className="text-lg font-medium text-foreground">Usuario logado</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Nome</p>
                      <p className="text-foreground font-medium">{currentUser?.name || '-'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">E-mail</p>
                      <p className="text-foreground font-medium">{currentUser?.email || '-'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">ID do usuario</p>
                      <p className="text-foreground font-medium break-all">{currentUser?.id || '-'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Ultimo acesso conhecido</p>
                      <p className="text-foreground font-medium">{formatDate(currentUser?.updated || currentUser?.created)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <KeyRound className="w-5 h-5 text-primary" />
                    <h2 className="text-lg font-medium text-foreground">Alterar senha</h2>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="current-password">Senha atual</Label>
                      <Input
                        id="current-password"
                        type="password"
                        value={form.currentPassword}
                        onChange={(event) => setForm((current) => ({ ...current, currentPassword: event.target.value }))}
                        autoComplete="current-password"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="new-password">Nova senha</Label>
                      <Input
                        id="new-password"
                        type="password"
                        value={form.newPassword}
                        onChange={(event) => setForm((current) => ({ ...current, newPassword: event.target.value }))}
                        autoComplete="new-password"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="new-password-confirm">Confirmar nova senha</Label>
                      <Input
                        id="new-password-confirm"
                        type="password"
                        value={form.newPasswordConfirm}
                        onChange={(event) => setForm((current) => ({ ...current, newPasswordConfirm: event.target.value }))}
                        autoComplete="new-password"
                      />
                    </div>

                    <Button type="submit" disabled={isSaving}>
                      {isSaving ? 'Salvando...' : 'Atualizar senha'}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
        <MobileNav />
      </div>
    </>
  );
}
