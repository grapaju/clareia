import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveProjectAssociation, resolvePlanProjectAssociations } from './projectAssociationLogic.js';

const context = {
  projects: [
    { name: 'Corcril' },
    { name: 'IDT-PR' },
    { name: 'InPACTA' },
    { name: 'Leone Pavan' },
  ],
  aliases: [{ alias: 'site da Leone', projectName: 'Leone Pavan' }],
};

test('reutiliza projetos existentes apesar de caixa, hifen e espacos', () => {
  const tasks = resolvePlanProjectAssociations([
    { title: 'Acompanhar Google Ads da CORCRIL' },
    { title: 'Cobrar fatura do IDT PR' },
    { title: 'Revisar contrato do IDTPR' },
    { title: 'Enviar relatório do IDT-PR' },
    { title: 'Cobrar a inpacta' },
  ], context);

  assert.deepEqual(tasks.map((task) => task.project), ['Corcril', 'IDT-PR', 'IDT-PR', 'IDT-PR', 'InPACTA']);
  assert.ok(tasks.every((task) => task.projectStatus === 'existing'));
  assert.deepEqual(tasks.slice(0, 2).map((task) => task.projectAlias), ['CORCRIL', 'IDT PR']);
});

test('reutiliza associacao aprendida', () => {
  const result = resolveProjectAssociation({ title: 'Publicar o site da Leone' }, context);
  assert.equal(result.project, 'Leone Pavan');
  assert.equal(result.projectStatus, 'existing');
});

test('sugere projeto novo sem cria-lo durante a analise', () => {
  const result = resolveProjectAssociation({ title: 'Preparar orçamento para a Clínica Aurora' }, context);
  assert.equal(result.project, 'Clínica Aurora');
  assert.equal(result.projectStatus, 'new');
});

test('classifica tarefa explicitamente pessoal no projeto padrao', () => {
  const result = resolveProjectAssociation({ title: 'Marcar meu dentista' }, context);
  assert.equal(result.project, 'Pessoal');
  assert.equal(result.projectStatus, 'personal');
});

test('nao envia tarefa profissional ambigua para Pessoal', () => {
  const result = resolveProjectAssociation({ title: 'Enviar a proposta' }, context);
  assert.equal(result.project, '');
  assert.equal(result.projectStatus, 'undecided');
});

test('nao transforma trecho de cobranca em projeto', () => {
  const projectContext = {
    ...context,
    projects: [...context.projects, { name: 'IDP-PR' }],
  };
  const result = resolveProjectAssociation(
    { title: 'Enviar fatura de cobrança para o IDP-PR' },
    projectContext
  );

  assert.equal(result.project, 'IDP-PR');
  assert.equal(result.projectStatus, 'existing');
  assert.equal(result.projectAlias, 'IDP-PR');
  assert.notEqual(result.project, 'cobrança o');
});