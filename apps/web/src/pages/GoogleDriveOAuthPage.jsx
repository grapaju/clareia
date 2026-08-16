import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Cloud, Link2, ShieldCheck } from 'lucide-react';
import Header from '@/components/Header.jsx';
import Sidebar from '@/components/Sidebar.jsx';
import MobileNav from '@/components/MobileNav.jsx';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  disconnectGoogleDrive,
  getGoogleDriveAuthUrl,
  getGoogleDriveConfigChecklist,
  getGoogleDriveOAuthUserSetupStatus,
  getGoogleDriveStatus,
  saveGoogleDriveOAuthUserConfig,
  testGoogleDriveConnection
} from '@/services/googleDriveIntegrationService.js';
import { toast } from 'sonner';

function formatDate(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function getSuggestedRedirectUri() {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}/hcgi/api/google-drive/oauth/callback`;
}

export default function GoogleDriveOAuthPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState({ connected: false });
  const [checklist, setChecklist] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [setupStatus, setSetupStatus] = useState(null);
  const [oauthConfigForm, setOauthConfigForm] = useState({
    clientId: '',
    clientSecret: '',
    redirectUri: '',
    scopes: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email'
  });
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [isLoadingChecklist, setIsLoadingChecklist] = useState(true);
  const [isLoadingSetupStatus, setIsLoadingSetupStatus] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isSavingOAuthConfig, setIsSavingOAuthConfig] = useState(false);
  const [suggestedRedirectUri] = useState(() => getSuggestedRedirectUri());

  const loadStatus = async () => {
    setIsLoadingStatus(true);
    try {
      const result = await getGoogleDriveStatus();
      setStatus(result || { connected: false });
    } catch {
      setStatus({ connected: false });
    } finally {
      setIsLoadingStatus(false);
    }
  };

  const loadChecklist = async () => {
    setIsLoadingChecklist(true);
    try {
      const result = await getGoogleDriveConfigChecklist();
      setChecklist(result || null);
    } catch {
      setChecklist(null);
    } finally {
      setIsLoadingChecklist(false);
    }
  };

  const loadSetupStatus = async () => {
    setIsLoadingSetupStatus(true);
    try {
      const result = await getGoogleDriveOAuthUserSetupStatus();
      setSetupStatus(result || null);
      if (result?.redirectPreview?.valid && result?.redirectPreview?.host && result?.redirectPreview?.pathname) {
        const inferredRedirect = `${result.redirectPreview.scheme || 'https'}://${result.redirectPreview.host}${result.redirectPreview.pathname}`;
        setOauthConfigForm((current) => ({ ...current, redirectUri: current.redirectUri || inferredRedirect }));
      }
    } catch {
      setSetupStatus(null);
    } finally {
      setIsLoadingSetupStatus(false);
    }
  };

  useEffect(() => {
    loadStatus();
    loadChecklist();
    loadSetupStatus();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const url = new URL(window.location.href);
    if (url.searchParams.get('driveConnected') !== '1') return;

    toast.success('Google Drive conectado com sucesso.');
    url.searchParams.delete('driveConnected');
    url.searchParams.delete('driveProject');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    loadStatus();
    loadChecklist();
    loadSetupStatus();
  }, []);

  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      const response = await getGoogleDriveAuthUrl({
        returnTo: '/integracoes/google-drive-oauth'
      });

      if (!response?.authUrl) {
        toast.error('Nao foi possivel iniciar a autenticacao com o Google Drive.');
        return;
      }

      window.location.href = response.authUrl;
    } catch (error) {
      toast.error(error?.message || 'Falha ao iniciar conexao com Google Drive.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setIsDisconnecting(true);
      await disconnectGoogleDrive();
      toast.success('Conexao com Google Drive removida.');
      await loadStatus();
      await loadChecklist();
      await loadSetupStatus();
    } catch (error) {
      toast.error(error?.message || 'Nao foi possivel desconectar o Google Drive.');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleTestConnection = async () => {
    if (!status.connected) {
      toast.error('Conecte o Google Drive antes de executar o teste.');
      return;
    }

    try {
      setIsTestingConnection(true);
      const result = await testGoogleDriveConnection({});
      setTestResult(result);
      toast.success('Teste executado. Arquivo de verificação criado no Google Drive.');
    } catch (error) {
      toast.error(error?.message || 'Nao foi possivel testar a conexao com Google Drive.');
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleSaveOAuthConfig = async () => {
    if (!oauthConfigForm.clientId || !oauthConfigForm.clientSecret || !oauthConfigForm.redirectUri) {
      toast.error('Preencha Client ID, Client Secret e Redirect URI.');
      return;
    }

    try {
      setIsSavingOAuthConfig(true);
      await saveGoogleDriveOAuthUserConfig(oauthConfigForm);
      toast.success('Configuracao OAuth salva na API com sucesso.');
      await Promise.all([loadSetupStatus(), loadChecklist()]);
    } catch (error) {
      toast.error(error?.message || 'Nao foi possivel salvar a configuracao OAuth.');
    } finally {
      setIsSavingOAuthConfig(false);
    }
  };

  const handleOpenGoogleCloudConsole = () => {
    window.open('https://console.cloud.google.com/apis/credentials', '_blank', 'noopener,noreferrer');
  };

  const handleCopyRedirectUri = async () => {
    const target = oauthConfigForm.redirectUri || suggestedRedirectUri;
    if (!target) {
      toast.error('Nao foi possivel identificar a Redirect URI automaticamente.');
      return;
    }

    try {
      await navigator.clipboard.writeText(target);
      toast.success('Redirect URI copiada para a area de transferencia.');
    } catch {
      toast.error('Nao foi possivel copiar a Redirect URI.');
    }
  };

  const checklistRows = [
    {
      label: 'GOOGLE_OAUTH_CLIENT_ID',
      ok: Boolean(checklist?.oauth?.clientIdConfigured),
      details: 'Configurado na API'
    },
    {
      label: 'GOOGLE_OAUTH_CLIENT_SECRET',
      ok: Boolean(checklist?.oauth?.clientSecretConfigured),
      details: 'Configurado na API'
    },
    {
      label: 'GOOGLE_OAUTH_REDIRECT_URI',
      ok: Boolean(checklist?.oauth?.redirectUriConfigured) && Boolean(checklist?.oauth?.redirectUriValid),
      details: checklist?.oauth?.redirectHost
        ? `${checklist.oauth.redirectScheme}://${checklist.oauth.redirectHost}${checklist.oauth.redirectPathname || ''}`
        : 'Nao detectado'
    },
    {
      label: 'GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY',
      ok: Boolean(checklist?.tokenSecurity?.encryptionKeyConfigured),
      details: 'Chave de criptografia de token'
    },
    {
      label: 'Escopos OAuth',
      ok: Boolean(checklist?.oauth?.scopesConfigured),
      details: `${checklist?.oauth?.scopeCount || 0} escopo(s)`
    },
    {
      label: 'Refresh token armazenado',
      ok: Boolean(checklist?.connection?.refreshTokenStored),
      details: checklist?.connection?.connected ? 'Conexao ativa' : 'Sem conexao ativa'
    }
  ];

  const diagnostics = (() => {
    if (!checklist) {
      return [];
    }

    const items = [];

    if (!checklist?.oauth?.clientIdConfigured) {
      items.push({
        id: 'client-id',
        severity: 'erro',
        title: 'GOOGLE_OAUTH_CLIENT_ID ausente',
        recommendation: 'Defina GOOGLE_OAUTH_CLIENT_ID no .env da API com o Client ID do app OAuth no Google Cloud.'
      });
    }

    if (!checklist?.oauth?.clientSecretConfigured) {
      items.push({
        id: 'client-secret',
        severity: 'erro',
        title: 'GOOGLE_OAUTH_CLIENT_SECRET ausente',
        recommendation: 'Defina GOOGLE_OAUTH_CLIENT_SECRET no .env da API com o Client Secret correspondente.'
      });
    }

    if (!checklist?.oauth?.redirectUriConfigured) {
      items.push({
        id: 'redirect-missing',
        severity: 'erro',
        title: 'GOOGLE_OAUTH_REDIRECT_URI ausente',
        recommendation: 'Defina a URI de callback no .env da API e registre a mesma URI no app OAuth do Google Cloud.'
      });
    } else if (!checklist?.oauth?.redirectUriValid) {
      items.push({
        id: 'redirect-invalid',
        severity: 'erro',
        title: 'GOOGLE_OAUTH_REDIRECT_URI invalida',
        recommendation: 'Use URI absoluta com esquema e host validos, por exemplo https://seu-dominio/hcgi/api/google-drive/oauth/callback.'
      });
    }

    if (!checklist?.tokenSecurity?.encryptionKeyConfigured) {
      items.push({
        id: 'encryption-key',
        severity: 'erro',
        title: 'GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY ausente',
        recommendation: 'Defina a chave de criptografia no .env da API para armazenar refresh token com segurança.'
      });
    }

    if (!checklist?.oauth?.scopesConfigured || Number(checklist?.oauth?.scopeCount || 0) === 0) {
      items.push({
        id: 'scopes',
        severity: 'alerta',
        title: 'Escopos OAuth nao detectados',
        recommendation: 'Defina GOOGLE_OAUTH_SCOPES na API com ao menos drive.file e userinfo.email.'
      });
    }

    if (!checklist?.connection?.connected) {
      items.push({
        id: 'not-connected',
        severity: 'info',
        title: 'Conta Google ainda nao conectada',
        recommendation: 'Clique em Conectar com Google para concluir o fluxo OAuth e liberar automações.'
      });
    } else if (!checklist?.connection?.refreshTokenStored) {
      items.push({
        id: 'refresh-missing',
        severity: 'alerta',
        title: 'Refresh token nao encontrado',
        recommendation: 'Reconecte clicando em Conectar com Google e aceite as permissões para renovar o token offline.'
      });
    }

    return items;
  })();

  const checklistOkCount = checklistRows.filter((row) => row.ok).length;
  const checklistTotal = checklistRows.length;
  const readinessPercent = checklistTotal > 0
    ? Math.round((checklistOkCount / checklistTotal) * 100)
    : 0;

  return (
    <>
      <Helmet>
        <title>Integracao Google Drive - Clareia</title>
      </Helmet>
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 pb-20 md:pb-8">
            <div className="page-container section-spacing max-w-4xl space-y-6">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <Cloud className="w-8 h-8 text-primary" />
                  <h1 className="text-3xl font-medium text-foreground">Google Drive por OAuth</h1>
                </div>
                <p className="text-lg text-muted-foreground">
                  Conecte sua conta Google com segurança para criar e atualizar documentos automaticamente nos projetos.
                </p>
              </div>

              <Card className="bg-card border-border shadow-sm">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <h2 className="text-lg font-medium text-foreground">Configurar OAuth no próprio Clareia</h2>
                      <p className="text-sm text-muted-foreground">Insira as variáveis do Google aqui. A API salva no .env local e aplica na sessão atual.</p>
                    </div>
                    <Button variant="outline" onClick={loadSetupStatus} disabled={isLoadingSetupStatus}>
                      {isLoadingSetupStatus ? 'Verificando...' : 'Atualizar status'}
                    </Button>
                  </div>

                  <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                    {setupStatus?.configured
                      ? 'Configuracao OAuth detectada na API.'
                      : 'Configuracao OAuth ainda nao completa na API.'}
                    {setupStatus?.envPath ? ` Arquivo alvo: ${setupStatus.envPath}` : ''}
                  </div>

                  <div className="rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground space-y-2">
                    <p className="text-foreground font-medium">Redirect URI sugerida para este ambiente</p>
                    <p className="break-all">{suggestedRedirectUri || 'Nao disponivel'}</p>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" onClick={handleCopyRedirectUri}>
                        Copiar Redirect URI
                      </Button>
                      <Button type="button" variant="outline" onClick={handleOpenGoogleCloudConsole}>
                        Abrir Google Cloud Console
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-sm font-medium text-foreground">Client ID</label>
                      <input
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                        value={oauthConfigForm.clientId}
                        onChange={(event) => setOauthConfigForm((current) => ({ ...current, clientId: event.target.value }))}
                        placeholder="Ex.: 1234567890-abc.apps.googleusercontent.com"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-sm font-medium text-foreground">Client Secret</label>
                      <input
                        type="password"
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                        value={oauthConfigForm.clientSecret}
                        onChange={(event) => setOauthConfigForm((current) => ({ ...current, clientSecret: event.target.value }))}
                        placeholder="Ex.: GOCSPX-..."
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-sm font-medium text-foreground">Redirect URI</label>
                      <input
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                        value={oauthConfigForm.redirectUri}
                        onChange={(event) => setOauthConfigForm((current) => ({ ...current, redirectUri: event.target.value }))}
                        placeholder="https://seu-dominio/hcgi/api/google-drive/oauth/callback"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-sm font-medium text-foreground">Scopes (opcional)</label>
                      <input
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                        value={oauthConfigForm.scopes}
                        onChange={(event) => setOauthConfigForm((current) => ({ ...current, scopes: event.target.value }))}
                        placeholder="https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button onClick={handleSaveOAuthConfig} disabled={isSavingOAuthConfig}>
                      {isSavingOAuthConfig ? 'Salvando...' : 'Salvar configuração OAuth'}
                    </Button>
                  </div>

                  <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground space-y-2">
                    <p className="font-medium text-foreground">Onde pegar essas variáveis no Google Cloud</p>
                    <ol className="list-decimal pl-5 space-y-1">
                      <li>Acesse Google Cloud Console e selecione/crie um projeto.</li>
                      <li>Ative a API Google Drive em APIs e Serviços.</li>
                      <li>Em Tela de consentimento OAuth, configure app e escopos.</li>
                      <li>Em Credenciais, crie Credencial do tipo ID do cliente OAuth (aplicação Web).</li>
                      <li>Copie Client ID e Client Secret.</li>
                      <li>Em URIs de redirecionamento autorizados, adicione exatamente a Redirect URI usada acima.</li>
                    </ol>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border shadow-sm">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <h2 className="text-lg font-medium text-foreground">Status da conexao</h2>
                      {isLoadingStatus ? (
                        <p className="text-sm text-muted-foreground">Verificando status...</p>
                      ) : status.connected ? (
                        <div className="text-sm text-muted-foreground space-y-1">
                          <p>Conectado como: <span className="text-foreground font-medium">{status.email || 'conta Google'}</span></p>
                          <p>Conectado em: <span className="text-foreground">{formatDate(status.connectedAt)}</span></p>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Nenhuma conta Google conectada.</p>
                      )}
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      <Button onClick={handleConnect} disabled={isConnecting}>
                        <Link2 className="w-4 h-4 mr-2" />
                        {isConnecting ? 'Conectando...' : 'Conectar com Google'}
                      </Button>
                      {status.connected && (
                        <Button variant="outline" onClick={handleDisconnect} disabled={isDisconnecting}>
                          {isDisconnecting ? 'Desconectando...' : 'Desconectar'}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border shadow-sm">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <h2 className="text-lg font-medium text-foreground">Diagnóstico rápido</h2>
                      <p className="text-sm text-muted-foreground">Resumo das pendências com ações sugeridas para concluir a integração.</p>
                    </div>
                    <div className="rounded-lg border border-border px-3 py-2 text-sm">
                      <p className="text-muted-foreground">Prontidão</p>
                      <p className="text-foreground font-semibold">{readinessPercent}% ({checklistOkCount}/{checklistTotal})</p>
                    </div>
                  </div>

                  {diagnostics.length === 0 ? (
                    <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                      Nenhuma pendência crítica detectada. Você pode testar a conexão e começar a automação de documentos.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {diagnostics.map((item) => {
                        const tone = item.severity === 'erro'
                          ? 'border-rose-300 bg-rose-50 text-rose-900'
                          : item.severity === 'alerta'
                            ? 'border-amber-300 bg-amber-50 text-amber-900'
                            : 'border-sky-300 bg-sky-50 text-sky-900';

                        return (
                          <div key={item.id} className={`rounded-lg border px-3 py-2 ${tone}`}>
                            <p className="text-sm font-medium">{item.title}</p>
                            <p className="text-xs mt-1">{item.recommendation}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-card border-border shadow-sm">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <h2 className="text-lg font-medium text-foreground">Checklist tecnico da configuracao</h2>
                      <p className="text-sm text-muted-foreground">Validacao sem exibir segredos. Mostra apenas se cada item esta configurado.</p>
                    </div>
                    <Button variant="outline" onClick={loadChecklist} disabled={isLoadingChecklist}>
                      {isLoadingChecklist ? 'Atualizando...' : 'Atualizar checklist'}
                    </Button>
                  </div>

                  <div className="rounded-lg border border-border overflow-hidden">
                    <div className="grid grid-cols-12 bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
                      <div className="col-span-6">Item</div>
                      <div className="col-span-2">Status</div>
                      <div className="col-span-4">Detalhe</div>
                    </div>
                    {checklistRows.map((row) => (
                      <div key={row.label} className="grid grid-cols-12 px-3 py-2 text-sm border-t border-border items-center gap-2">
                        <div className="col-span-6 break-all text-foreground">{row.label}</div>
                        <div className="col-span-2">
                          <span className={row.ok ? 'text-emerald-600 font-medium' : 'text-rose-600 font-medium'}>
                            {row.ok ? 'OK' : 'Pendente'}
                          </span>
                        </div>
                        <div className="col-span-4 break-all text-muted-foreground">{row.details}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border shadow-sm">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-primary" />
                    <h2 className="text-lg font-medium text-foreground">Como fazer a conexao OAuth</h2>
                  </div>

                  <ol className="list-decimal pl-5 space-y-2 text-sm text-foreground">
                    <li>Confirme com o time tecnico que a API possui as variaveis de OAuth do Google configuradas.</li>
                    <li>Clique em Conectar com Google nesta tela.</li>
                    <li>Escolha sua conta Google e aceite as permissoes solicitadas.</li>
                    <li>Ao retornar ao Clareia, verifique se o status aparece como conectado.</li>
                    <li>No modulo de Projetos, use o modal de Drive para criar subpastas e ativar sincronizacao automatica dos materiais.</li>
                  </ol>

                  <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground space-y-2">
                    <p className="font-medium text-foreground">Dicas importantes</p>
                    <p>Use uma conta Google corporativa para evitar perda de acesso.</p>
                    <p>Se aparecer Estado OAuth expirado, reinicie o processo clicando em Conectar com Google novamente.</p>
                    <p>Se a conexao nao concluir, valide URL de callback e escopos no backend.</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border shadow-sm">
                <CardContent className="p-6 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => navigate('/projects')}>Voltar para Projetos</Button>
                    <Button variant="outline" onClick={() => navigate('/configuracoes')}>Ir para Configuracoes</Button>
                    <Button onClick={handleConnect} disabled={isConnecting}>{isConnecting ? 'Conectando...' : 'Iniciar OAuth agora'}</Button>
                    <Button variant="outline" onClick={handleTestConnection} disabled={isTestingConnection || !status.connected}>
                      {isTestingConnection ? 'Testando...' : 'Testar conexao (criar arquivo)'}
                    </Button>
                  </div>

                  {testResult?.webViewLink && (
                    <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                      <p className="text-foreground font-medium">Teste concluido com sucesso</p>
                      <p>Arquivo: {testResult.fileName}</p>
                      <a
                        href={testResult.webViewLink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline break-all"
                      >
                        Abrir arquivo de verificação no Google Drive
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="rounded-lg border border-border bg-card p-4 text-xs text-muted-foreground flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 mt-0.5 text-primary" />
                <p>
                  Depois da conexao, o Clareia pode criar ou atualizar documentos automaticamente no Google Drive quando voce marcar sincronizacao no cadastro de material do projeto.
                </p>
              </div>
            </div>
          </main>
        </div>
        <MobileNav />
      </div>
    </>
  );
}
