/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId('tasks');

  const ensureField = (name, expectedType, fieldFactory) => {
    const existing = collection.fields.getByName(name);
    if (existing) {
      if (existing.type === expectedType) return existing;
      collection.fields.removeByName(name);
    }
    const created = fieldFactory();
    collection.fields.add(created);
    return created;
  };

  const statusField = ensureField('status', 'select', () => new SelectField({
    name: 'status',
    required: false,
    maxSelect: 1,
    values: []
  }));

  statusField.values = [
    'pendente',
    'em_andamento',
    'pausada',
    'concluida',
    'aguardando_retorno',
    'arquivada',
    'Hoje',
    'Esta semana',
    'Próxima semana',
    'Backlog',
    'Concluída',
    'Pendente',
    'Fazendo',
    'Adiado'
  ];

  ensureField('lastActiveSubtaskId', 'text', () => new TextField({
    name: 'lastActiveSubtaskId',
    required: false
  }));

  ensureField('pauseNote', 'text', () => new TextField({
    name: 'pauseNote',
    required: false
  }));

  return app.save(collection);
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId('tasks');

    const statusField = collection.fields.getByName('status');
    if (statusField?.type === 'select') {
      statusField.values = ['Hoje', 'Esta semana', 'Próxima semana', 'Backlog', 'Concluída'];
    }

    collection.fields.removeByName('lastActiveSubtaskId');
    collection.fields.removeByName('pauseNote');

    return app.save(collection);
  } catch (error) {
    if (error.message.includes('no rows in result set')) return;
    throw error;
  }
});
