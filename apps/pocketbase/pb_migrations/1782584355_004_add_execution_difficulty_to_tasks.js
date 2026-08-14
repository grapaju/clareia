/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId('tasks');
  const existing = collection.fields.getByName('executionDifficulty');

  if (existing && existing.type !== 'select') {
    collection.fields.removeByName('executionDifficulty');
  }

  if (!collection.fields.getByName('executionDifficulty')) {
    collection.fields.add(new SelectField({
      name: 'executionDifficulty',
      required: false,
      maxSelect: 1,
      values: ['Rápida', 'Direta', 'Exige foco', 'Tem atrito', 'Grande demais']
    }));
  }

  return app.save(collection);
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId('tasks');
    collection.fields.removeByName('executionDifficulty');
    return app.save(collection);
  } catch (error) {
    if (error.message.includes('no rows in result set')) {
      return;
    }
    throw error;
  }
});