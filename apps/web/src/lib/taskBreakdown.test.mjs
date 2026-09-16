import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateTaskBreakdown,
  interpretTask,
  validateSteps,
} from './taskBreakdown.js';

test('prioriza intenção técnica sobre a palavra fatura', () => {
  const result = generateTaskBreakdown({ title: 'Fluxo de caixa não está criando as faturas automaticamente' });
  assert.equal(result.suggestedDomain, 'debugging');
  assert.match(result.firstAction, /reproduzir a falha/i);
  assert.ok(result.steps.every((step) => !/enviar.*fatura/i.test(step)));
});

test('identifica envio como entrega, não como revisão', () => {
  const result = generateTaskBreakdown({ title: 'Enviar orçamento aprovado ao diretor' });
  assert.equal(result.suggestedDomain, 'delivery');
  assert.ok(result.steps.some((step) => /destinatário|enviar/i.test(step)));
});

test('identifica revisão com critérios verificáveis', () => {
  const result = generateTaskBreakdown({ title: 'Revisar proposta comercial da Expocentro' });
  assert.equal(result.suggestedDomain, 'documentation');
  assert.ok(result.steps.some((step) => /escopo, valores/i.test(step)));
});

test('gera fluxo técnico para bug explícito', () => {
  const result = generateTaskBreakdown({ title: 'Corrigir bug no login do CRM' });
  assert.equal(result.suggestedDomain, 'debugging');
  assert.match(result.firstAction, /reproduzir.*login/i);
  assert.ok(result.steps.some((step) => /logs/i.test(step)));
  assert.ok(result.steps.some((step) => /corrigir/i.test(step)));
});

test('primeira ação é o primeiro passo retornado', () => {
  const result = generateTaskBreakdown({ title: 'Atualizar imagens da página do empreendimento' });
  assert.equal(result.firstAction, result.steps[0]);
});

test('remove passos duplicados', () => {
  const result = validateSteps(['Abrir o documento correto', 'Abrir o documento correto', 'Conferir todos os valores', 'Registrar o resultado final']);
  assert.equal(result.steps.length, 3);
  assert.equal(result.rejectedCount, 1);
});

test('varia a quantidade conforme o tempo estimado', () => {
  const short = generateTaskBreakdown({ title: 'Preparar reunião', timeEstimate: 15 });
  const long = generateTaskBreakdown({ title: 'Preparar reunião', timeEstimate: 90 });
  assert.equal(short.steps.length, 3);
  assert.equal(long.steps.length, 6);
});

test('usa contexto compatível quando o texto é ambíguo', () => {
  const result = generateTaskBreakdown(
    { title: 'Preparar atualização' },
    { projectProfile: { name: 'Portal', projectType: 'Site', summary: 'Manutenção e publicação do site institucional' } },
  );
  assert.equal(result.generationSource, 'contextual');
  assert.equal(result.suggestedDomain, 'frontend');
});

test('usa fallback explícito quando não há intenção reconhecível', () => {
  const result = generateTaskBreakdown({ title: 'Assunto diverso' });
  assert.equal(result.generationSource, 'fallback');
  assert.match(result.firstAction, /resultado concreto/i);
});

test('produz resultado esperado coerente com o domínio', () => {
  const result = generateTaskBreakdown({ title: 'Corrigir erro na API de cadastro' });
  assert.match(result.expectedOutcome, /falha reproduzida.*causa corrigida.*validado/i);
});

test('rejeita passos vagos antes de aceitar a geração', () => {
  const result = validateSteps(['Executar a atividade principal', 'Fazer a tarefa', 'Registrar o resultado final']);
  assert.equal(result.valid, false);
  assert.deepEqual(result.steps, ['Registrar o resultado final']);
});

test('mantém precedência da evidência textual sobre o tipo do projeto', () => {
  const result = interpretTask(
    { title: 'Investigar por que o sistema parou de gerar boletos' },
    { projectProfile: { projectType: 'Financeiro', summary: 'Cobranças e pagamentos' } },
  );
  assert.equal(result.domain, 'debugging');
  assert.equal(result.source, 'semantic');
});

test('distingue análise técnica de correção de bug', () => {
  const result = generateTaskBreakdown({ title: 'Analisar o monitoramento dos sites e priorizar melhorias' });
  assert.equal(result.suggestedDomain, 'technical');
  assert.match(result.firstAction, /mapear o estado atual/i);
});

test('classifica layout mobile como frontend responsivo, não como revisão documental', () => {
  const result = generateTaskBreakdown(
    { title: 'IDTPR - revisar layout mobile' },
    { projectProfile: { name: 'IDTPR', projectType: 'Site', summary: 'WordPress, Elementor, eventos e manutenção do site' } },
  );

  assert.equal(result.interpretation.action, 'revisar');
  assert.equal(result.interpretation.object, 'layout mobile');
  assert.equal(result.suggestedDomain, 'frontend');
  assert.equal(result.suggestedSubdomain, 'responsive_ui');
  assert.equal(result.firstAction, 'Abrir a página em largura mobile');
  assert.ok(result.steps.some((step) => /overflow.*quebras/i.test(step)));
  assert.ok(result.steps.some((step) => /Elementor.*CSS/i.test(step)));
  assert.ok(result.steps.every((step) => !/material relacionado|critério de aprovação|valores|prazos|leitura final/i.test(step)));
});

test('gera envio de relatório curto, natural e sem repetir o título', () => {
  const title = 'IDTPR - enviar relatório de pagamentos para a Rosi';
  const result = generateTaskBreakdown({ title });

  assert.equal(result.suggestedDomain, 'reporting');
  assert.equal(result.suggestedSubdomain, 'communication');
  assert.deepEqual(result.steps, [
    'Abrir o relatório de pagamentos',
    'Conferir o período e os valores',
    'Exportar a versão final',
    'Enviar para Rosi',
  ]);
  assert.ok(result.steps.every((step) => !step.includes(title)));
  assert.ok(result.steps.every((step) => !/critério de aprovação/i.test(step)));
});

test('classifica falha automática de faturas como debugging backend financeiro', () => {
  const result = generateTaskBreakdown(
    { title: 'Fluxo de caixa não está criando as faturas automaticamente' },
    { projectProfile: { name: 'Fluxo de Caixa', projectType: 'Sistema', summary: 'React, Fastify, faturas e recorrências' } },
  );

  assert.equal(result.suggestedDomain, 'debugging');
  assert.equal(result.suggestedSubdomain, 'backend');
  assert.ok(result.semanticFacets.includes('finance_system'));
  assert.equal(result.firstAction, 'Reproduzir a falha com uma recorrência');
  assert.ok(result.steps.some((step) => /job.*geração automática/i.test(step)));
  assert.equal(result.steps.length, 6);
});

test('classifica conversões como analytics e usa contexto de Ads', () => {
  const result = generateTaskBreakdown(
    { title: 'Continuar Google Analytics / conversões da Corcril' },
    { projectProfile: { name: 'Corcril', projectType: 'Google Ads', summary: 'Google Ads, GTM, Analytics e conversões' } },
  );

  assert.equal(result.suggestedDomain, 'analytics');
  assert.equal(result.suggestedSubdomain, 'tracking');
  assert.ok(result.semanticFacets.includes('ads'));
  assert.match(result.firstAction, /retomar.*mensuração/i);
  assert.ok(result.steps.some((step) => /disparo da tag.*GTM/i.test(step)));
});

test('validador rejeita vagueza, repetição do título e conceitos inventados', () => {
  const title = 'IDTPR - revisar layout mobile';
  const result = validateSteps([
    'Abrir o material relacionado',
    `Localizar a versão final relacionada a ${title}`,
    'Conferir valores e prazos',
    'Identificar overflow na largura mobile',
    'Testar o menu em viewport de 375 pixels',
    'Corrigir a responsividade no CSS',
  ], {
    task: { title },
    interpretation: interpretTask({ title }),
  });

  assert.deepEqual(result.steps, [
    'Identificar overflow na largura mobile',
    'Testar o menu em viewport de 375 pixels',
    'Corrigir a responsividade no CSS',
  ]);
  assert.equal(result.valid, true);
  assert.equal(result.rejectedCount, 3);
});