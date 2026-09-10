import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildProfessionalJourneyClosingNote,
  buildProfessionalJourneyWrapUp,
  resolveProfessionalJourneyEndAt
} from './professionalJourneyWrapUpLogic.js';

test('permite encerrar sem preencher nenhum campo', () => {
  assert.deepEqual(buildProfessionalJourneyWrapUp(), {
    concluded: '',
    continueContext: '',
    waitingExternal: ''
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