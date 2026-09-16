import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMindDump } from './mindDumpParser.js';

const now = new Date(2026, 8, 16, 9, 0, 0);
const context = { projects: [{ id: 'corcril', name: 'Corcril' }, { id: 'idt', name: 'IDT-PR', aliases: ['IDTPR', 'IDT PR'] }] };

test('interpreta o exemplo Corcril estruturado sem inventar horário', () => {
  const parsed = parseMindDump(`Hoje — 16/09
Tarefa: Corcril — registrar situação atual da campanha Google Ads após correções de mensuração
Tempo estimado: 20 min
Descrição/notas: Registrar que Compra [V4] está como Compra secundária; checkout continua principal; WhatsApp foi corrigido; orçamento R$120/dia e ROAS 23% permanecem sem alteração.
Microtarefas esperadas: registrar estado atual; anotar o que não deve ser alterado; salvar observações para comparação futura.`, context, { now });
  const [task] = parsed.tasks;
  assert.equal(parsed.tasks.length, 1);
  assert.equal(task.project.name, 'Corcril');
  assert.equal(task.date, '2026-09-16');
  assert.equal(task.time, undefined);
  assert.equal(task.durationMinutes, 20);
  assert.equal(task.microtasks.length, 3);
  assert.ok(task.microtasks.every((item) => item.source === 'explicit'));
  assert.match(task.notes, /Compra \[V4\]/);
  assert.ok(task.constraints.some((item) => /orçamento/i.test(item)));
  assert.ok(task.constraints.some((item) => /ROAS/i.test(item)));
  assert.doesNotMatch(task.title, /alterar orçamento/i);
});

test('diferencia data, horário e duração', () => {
  const [task] = parseMindDump('amanhã às 14h revisar campanha por 20 min', context, { now }).tasks;
  assert.equal(task.date, '2026-09-17');
  assert.equal(task.time, '14:00');
  assert.equal(task.durationMinutes, 20);
});

test('separa data de execução, prazo e lembrete', () => {
  const [task] = parseMindDump('Quero começar amanhã e entregar relatório até sexta, me lembrar quinta às 10h', context, { now }).tasks;
  assert.equal(task.date, '2026-09-17');
  assert.equal(task.deadline.date, '2026-09-18');
  assert.equal(task.reminder.date, '2026-09-17');
  assert.equal(task.reminder.time, '10:00');
});

test('reconhece recorrência sem criar tarefas repetidas', () => {
  const parsed = parseMindDump('verificar pagamentos toda segunda', context, { now });
  assert.equal(parsed.tasks.length, 1);
  assert.equal(parsed.tasks[0].recurrence.frequency, 'Semanal');
});

test('normaliza variantes do mesmo projeto existente', () => {
  for (const name of ['IDTPR', 'IDT-PR', 'IDT PR']) {
    const [task] = parseMindDump(`Projeto: ${name}\nTarefa: revisar home`, context, { now }).tasks;
    assert.equal(task.project.name, 'IDT-PR');
    assert.equal(task.project.status, 'existing');
  }
});

test('não escolhe projeto ambíguo', () => {
  const ambiguous = { projects: [{ id: '1', name: 'IDT-PR', aliases: ['IDT'] }, { id: '2', name: 'IDT Cursos', aliases: ['IDT'] }] };
  const [task] = parseMindDump('Projeto: IDT\nTarefa: revisar home', ambiguous, { now }).tasks;
  assert.equal(task.project.status, 'ambiguous');
});

test('separa ações independentes e mantém etapas da mesma tarefa', () => {
  assert.equal(parseMindDump('revisar site e ligar para contador', context, { now }).tasks.length, 2);
  const parsed = parseMindDump('atualizar site revisando home, corrigindo textos e publicando conteúdo', context, { now });
  assert.equal(parsed.tasks.length, 1);
  assert.equal(parsed.tasks[0].microtasks.length, 3);
});

test('restrição isolada não vira ação positiva', () => {
  const parsed = parseMindDump('não alterar orçamento nem ROAS', context, { now });
  assert.equal(parsed.tasks.length, 0);
});

test('avisa sobre conflito entre data relativa e numérica', () => {
  const parsed = parseMindDump('Hoje — 17/09\nTarefa: revisar campanha', context, { now });
  assert.equal(parsed.warnings[0].code, 'conflicting_dates');
});

test('interpreta semanticamente o exemplo Corcril em texto natural', () => {
  const parsed = parseMindDump(`Amanhã preciso revisar a campanha da Corcril por uns 20 minutos.
Quero registrar como estão as conversões depois das correções.
Compra V4 continua secundária, checkout continua principal e o WhatsApp foi corrigido.
Não mexer no orçamento nem no ROAS. Quero deixar isso salvo para comparar depois.`, context, { now });
  assert.equal(parsed.tasks[0].project.name, 'Corcril');
  assert.equal(parsed.tasks[0].date, '2026-09-17');
  assert.equal(parsed.tasks[0].durationMinutes, 20);
  assert.ok(parsed.tasks[0].constraints.some((item) => /orçamento/i.test(item)));
  assert.ok(parsed.tasks.every((task) => !/alterar (?:orçamento|ROAS)/i.test(task.title)));
});

test('aceita rótulos equivalentes e preserva campos explícitos', () => {
  const [task] = parseMindDump(`Projeto: IDT PR
Data: amanhã
Horário: 14:30
Duração: 1h30
Tarefa: Atualizar home
Contexto: Publicação aprovada.
Checklist:
- revisar
- publicar
Restrições: não alterar menu`, context, { now }).tasks;
  assert.equal(task.project.name, 'IDT-PR');
  assert.equal(task.time, '14:30');
  assert.equal(task.durationMinutes, 90);
  assert.deepEqual(task.microtasks.map((item) => item.text), ['revisar', 'publicar']);
});

test('interpreta duração aproximada e não inventa duração ausente', () => {
  assert.equal(parseMindDump('revisar campanha por cerca de meia hora', context, { now }).tasks[0].durationMinutes, 30);
  assert.equal(parseMindDump('responder o Márcio', context, { now }).tasks[0].durationMinutes, undefined);
});

test('mantém horário sem inventar data', () => {
  const [task] = parseMindDump('reunião às 15h para revisar contrato', context, { now }).tasks;
  assert.equal(task.time, '15:00');
  assert.equal(task.date, undefined);
});

test('aplica data de cabeçalho às tarefas da lista', () => {
  const parsed = parseMindDump('Amanhã:\n- revisar Corcril\n- responder Márcio', context, { now });
  assert.equal(parsed.tasks.length, 2);
  assert.ok(parsed.tasks.every((task) => task.date === '2026-09-17'));
});

test('mantém datas distintas em várias tarefas', () => {
  const parsed = parseMindDump('amanhã revisar Corcril e sexta enviar relatório do IDT-PR', context, { now });
  assert.equal(parsed.tasks.length, 2);
  assert.equal(parsed.tasks[0].date, '2026-09-17');
  assert.equal(parsed.tasks[1].date, '2026-09-18');
});

test('aceita texto informal compacto', () => {
  const [task] = parseMindDump('16/09 corcril ver ads 20min nao mexer orçamento', context, { now }).tasks;
  assert.equal(task.date, '2026-09-16');
  assert.equal(task.durationMinutes, 20);
  assert.equal(task.project.name, 'Corcril');
  assert.ok(task.constraints.some((item) => /orçamento/i.test(item)));
});

test('separa texto sem pontuação pelo marcador depois', () => {
  const parsed = parseMindDump('amanha corcril revisar campanha 30 min depois responder marcio', context, { now });
  assert.equal(parsed.tasks.length, 2);
  assert.equal(parsed.tasks[0].durationMinutes, 30);
  assert.equal(parsed.tasks[1].durationMinutes, undefined);
});

test('frases descritivas e falha de interpretação não viram tarefas', () => {
  assert.equal(parseMindDump('Compra V4 está secundária. Checkout continua principal.', context, { now }).tasks.length, 0);
  assert.equal(parseMindDump('... ??? ...', context, { now }).tasks.length, 0);
});