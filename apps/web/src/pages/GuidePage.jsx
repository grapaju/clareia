import React from 'react';
import { Helmet } from 'react-helmet';
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FolderKanban,
  NotebookPen,
  Settings,
  Sparkles,
  BarChart3
} from 'lucide-react';
import Header from '@/components/Header.jsx';
import Sidebar from '@/components/Sidebar.jsx';
import MobileNav from '@/components/MobileNav.jsx';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const STEPS = [
  {
    title: '1) Comece pelo check-in diário',
    description: 'Abra a tela Hoje e responda energia, mente e tempo disponível. Isso ajusta as sugestões para sua realidade do dia.'
  },
  {
    title: '2) Esvazie a cabeça sem organizar',
    description: 'Na tela Descarregar mente, escreva tudo que lembrar (pessoal e trabalho). Depois clique para gerar o Plano Clareado.'
  },
  {
    title: '3) Revise o Plano Clareado antes de criar',
    description: 'Edite, divida ou exclua itens. Essa etapa evita tarefas confusas e deixa tudo executável.'
  },
  {
    title: '4) Execute uma tarefa por vez',
    description: 'Volte para Hoje e siga a ordem sugerida. O objetivo é reduzir troca de contexto e concluir mais.'
  }
];

const FEATURES = [
  {
    icon: NotebookPen,
    title: 'Descarregar mente',
    howTo: 'Escreva como vier, sem filtro. No fim, use o botão de organizar para transformar em plano.'
  },
  {
    icon: Sparkles,
    title: 'Plano Clareado',
    howTo: 'Revise os cards sugeridos e confirme para criar tarefas com prioridade e próximos passos.'
  },
  {
    icon: Clock3,
    title: 'Aguardando retorno',
    howTo: 'Registre dependências de cliente/parceiro e datas de follow-up para nada se perder.'
  },
  {
    icon: CalendarDays,
    title: 'Calendário',
    howTo: 'Veja tarefas por dia/período, mova por drag-and-drop e equilibre carga da semana.'
  },
  {
    icon: FolderKanban,
    title: 'Projetos',
    howTo: 'Centralize tarefas, materiais, links, acessos e notas por projeto para ter contexto completo.'
  },
  {
    icon: BarChart3,
    title: 'Relatórios',
    howTo: 'Acompanhe horas, tarefas concluídas e fechamento diário para medir consistência.'
  },
  {
    icon: Settings,
    title: 'Configurações',
    howTo: 'Ajuste dias úteis, regras de agenda e modo de baixa estimulação conforme seu estilo.'
  }
];

export default function GuidePage() {
  return (
    <>
      <Helmet><title>Guia de Uso - Clareia</title></Helmet>
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 pb-20 md:pb-8">
            <div className="page-container section-spacing max-w-5xl">
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-3">
                  <BookOpen className="w-8 h-8 text-primary" />
                  <h1 className="text-3xl font-medium text-foreground">Guia de uso do Clareia</h1>
                </div>
                <p className="text-lg text-muted-foreground">
                  Página de orientação para começar rápido, entender cada funcionalidade e usar o sistema com segurança no dia a dia.
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Este guia foi pensado para primeira experiência: siga na ordem e teste uma funcionalidade de cada vez.
                </p>
              </div>

              <Card className="bg-card border-border shadow-sm mb-6">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <h2 className="text-xl font-medium text-foreground">Primeiros 15 minutos</h2>
                    <Badge variant="secondary">Comece aqui</Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {STEPS.map((step) => (
                      <div key={step.title} className="rounded-lg border border-border p-4 bg-muted/20">
                        <p className="text-sm font-medium text-foreground mb-1">{step.title}</p>
                        <p className="text-sm text-muted-foreground">{step.description}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border shadow-sm mb-6">
                <CardContent className="p-6">
                  <h2 className="text-xl font-medium text-foreground mb-4">Funcionalidades e como usar</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {FEATURES.map((feature) => (
                      <div key={feature.title} className="rounded-lg border border-border p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <feature.icon className="w-4 h-4 text-primary" />
                          <p className="text-sm font-medium text-foreground">{feature.title}</p>
                        </div>
                        <p className="text-sm text-muted-foreground">{feature.howTo}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border shadow-sm mb-6">
                <CardContent className="p-6 space-y-3">
                  <h2 className="text-xl font-medium text-foreground">Mapa rápido: onde clicar para cada objetivo</h2>
                  <p className="text-sm text-muted-foreground">Use este atalho quando bater dúvida de navegação.</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="rounded-lg border border-border p-3 bg-muted/20">
                      <p className="text-sm font-medium text-foreground mb-1">Quero organizar meu dia</p>
                      <p className="text-sm text-muted-foreground">Hoje → escolher prioridade → começar tarefa.</p>
                    </div>
                    <div className="rounded-lg border border-border p-3 bg-muted/20">
                      <p className="text-sm font-medium text-foreground mb-1">Quero transformar ideias em tarefas</p>
                      <p className="text-sm text-muted-foreground">Descarregar mente → Plano Clareado → criar tarefas.</p>
                    </div>
                    <div className="rounded-lg border border-border p-3 bg-muted/20">
                      <p className="text-sm font-medium text-foreground mb-1">Quero acompanhar pendências de terceiros</p>
                      <p className="text-sm text-muted-foreground">Aguardando retorno → criar acompanhamento + data de follow-up.</p>
                    </div>
                    <div className="rounded-lg border border-border p-3 bg-muted/20">
                      <p className="text-sm font-medium text-foreground mb-1">Quero centralizar tudo de um cliente/projeto</p>
                      <p className="text-sm text-muted-foreground">Projetos → abrir projeto → tarefas, arquivos, links, notas e acessos.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border shadow-sm mb-6">
                <CardContent className="p-6 space-y-3">
                  <h2 className="text-xl font-medium text-foreground">Rotina sugerida para teste (7 dias)</h2>
                  <p className="text-sm text-muted-foreground">Use este roteiro para validar o Clareia sem sobrecarga.</p>
                  <div className="space-y-2">
                    <p className="text-sm text-foreground"><strong>Dias 1 e 2:</strong> focar em check-in + descarregar mente + criar plano.</p>
                    <p className="text-sm text-foreground"><strong>Dias 3 e 4:</strong> executar tarefas na tela Hoje e registrar pausas/retomadas.</p>
                    <p className="text-sm text-foreground"><strong>Dias 5 e 6:</strong> organizar um projeto com arquivos, links e notas.</p>
                    <p className="text-sm text-foreground"><strong>Dia 7:</strong> revisar Relatórios e Encerramento do dia para avaliar ganhos.</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border shadow-sm">
                <CardContent className="p-6">
                  <h2 className="text-xl font-medium text-foreground mb-3">Boas práticas rápidas</h2>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-primary mt-0.5" />Defina uma única prioridade principal por dia.</li>
                    <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-primary mt-0.5" />Sempre preencha a primeira ação prática ao criar tarefas.</li>
                    <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-primary mt-0.5" />Use "Aguardando retorno" para tudo que depende de terceiros.</li>
                    <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-primary mt-0.5" />Feche o dia com o resumo para continuar sem atrito no dia seguinte.</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="bg-card border-border shadow-sm mt-6">
                <CardContent className="p-6 space-y-3">
                  <h2 className="text-xl font-medium text-foreground">Dúvidas comuns (rápido)</h2>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p><strong className="text-foreground">"Perdi uma tarefa"</strong>: verifique filtro em Projetos ou no Calendário e confirme status (aberta, arquivada, concluída).</p>
                    <p><strong className="text-foreground">"Minha semana ficou pesada"</strong>: use Calendário para mover tarefas de dia/período.</p>
                    <p><strong className="text-foreground">"Depende de outra pessoa"</strong>: registre em Aguardando retorno com data de cobrança.</p>
                    <p><strong className="text-foreground">"Quero melhorar o sistema"</strong>: use Guardar melhoria para depois e siga a execução do dia.</p>
                  </div>
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
