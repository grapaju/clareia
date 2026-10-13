import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildProfessionalJourneyClosingNote,
  buildProfessionalJourneyWrapUp,
  normalizeWrapUpActivities,
  resolveProfessionalJourneyEndAt
} from './professionalJourneyWrapUpLogic.js';

test('permite encerrar sem preencher nenhum campo', () => {
  assert.deepEqual(buildProfessionalJourneyWrapUp(), {
    concluded: '',
    continueContext: '',
    waitingExternal: '',
    activities: []
  });
  assert.equal(buildProfessionalJourneyClosingNote(), '');
});

test('fluxo normal usa automaticamente o instante do clique', () => {
  const now = new Date('2026-09-10T21:35:00.000Z');
  assert.equal(resolveProfessionalJourneyEndAt({ now }), now.toISOString());
  assert.equal(resolveProfessionalJourneyEndAt({ correctedEndAt: '2026-09-09T10:00:00', now }), now.toISOString());
});

test('jornada anômala aceita correção manual habilitada', () => {
  assert.equal(resolveProfessionalJourneyEndAt({
    anomalous: true,
    correctionEnabled: true,
    correctedEndAt: '2026-09-10T18:20:00'
  }), new Date('2026-09-10T18:20:00').toISOString());
});

test('preserva uma ou várias atividades concluídas no histórico da Jornada', () => {
  const context = buildProfessionalJourneyWrapUp({
    concluded: 'Atualização da página\nRevisão dos documentos',
    continueContext: 'Continuar módulo de contratos',
    waitingExternal: 'Documento do financeiro'
  });
  const note = buildProfessionalJourneyClosingNote(context);
  assert.match(note, /Atualização da página\nRevisão dos documentos/);
  assert.match(note, /Para continuar:\nContinuar módulo de contratos/);
  assert.match(note, /Aguardando retorno externo:\nDocumento do financeiro/);
});

test('normaliza lista de atividades do encerramento sem exigir tarefa', () => {
  const items = normalizeWrapUpActivities([
    {
      description: 'Análise do GLPI',
      status: 'pausada',
      projectOrFront: 'InPACTA',
      durationMinutes: '95',
      nextStep: 'Retomar triagem',
      waitingOn: '',
      deliveryLink: 'https://example.com/entrega'
    },
    { description: '', nextStep: '', waitingOn: '' }
  ]);
  assert.equal(items.length, 1);
  assert.equal(items[0].status, 'pausada');
  assert.equal(items[0].durationMinutes, 95);
  assert.equal(items[0].deliveryLink, 'https://example.com/entrega');
});