/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId('anotacoes');

  const ensureField = (name, expectedType, fieldFactory) => {
    const existing = collection.fields.getByName(name);
    if (existing) {
      if (existing.type === expectedType) return;
      collection.fields.removeByName(name);
    }
    collection.fields.add(fieldFactory());
  };

  ensureField('titulo', 'text', () => new TextField({ name: 'titulo', required: false }));
  ensureField('projeto', 'text', () => new TextField({ name: 'projeto', required: false }));
  ensureField('tipo', 'select', () => new SelectField({
    name: 'tipo',
    required: false,
    maxSelect: 1,
    values: ['Solução', 'Ideia', 'Decisão', 'Acesso', 'Referência', 'Reunião', 'Geral']
  }));
  ensureField('tags', 'text', () => new TextField({ name: 'tags', required: false }));
  ensureField('fixada', 'bool', () => new BoolField({ name: 'fixada', required: false }));

  return app.save(collection);
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId('anotacoes');
    for (const fieldName of ['titulo', 'projeto', 'tipo', 'tags', 'fixada']) {
      collection.fields.removeByName(fieldName);
    }
    return app.save(collection);
  } catch (error) {
    if (error.message.includes('no rows in result set')) return;
    throw error;
  }
});