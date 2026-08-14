/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId('tasks');

  const ensureField = (name, expectedType, fieldFactory) => {
    const existing = collection.fields.getByName(name);
    if (existing) {
      if (existing.type === expectedType) return;
      collection.fields.removeByName(name);
    }
    collection.fields.add(fieldFactory());
  };

  ensureField('recurrenceFrequency', 'select', () => new SelectField({
    name: 'recurrenceFrequency',
    required: false,
    maxSelect: 1,
    values: ['Nenhuma', 'Semanal', 'Mensal']
  }));
  ensureField('recurrenceAnchorDate', 'date', () => new DateField({
    name: 'recurrenceAnchorDate',
    required: false
  }));

  return app.save(collection);
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId('tasks');
    collection.fields.removeByName('recurrenceFrequency');
    collection.fields.removeByName('recurrenceAnchorDate');
    return app.save(collection);
  } catch (error) {
    if (error.message.includes('no rows in result set')) return;
    throw error;
  }
});