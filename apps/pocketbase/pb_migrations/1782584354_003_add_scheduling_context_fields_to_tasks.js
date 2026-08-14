/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId('tasks');

  const ensureField = (name, expectedType, fieldFactory) => {
    const existing = collection.fields.getByName(name);
    if (existing) {
      if (existing.type === expectedType) {
        return;
      }
      collection.fields.removeByName(name);
    }

    collection.fields.add(fieldFactory());
  };

  ensureField('scheduledDate', 'date', () => new DateField({
    name: 'scheduledDate',
    required: false
  }));

  ensureField('scheduledPeriod', 'text', () => new TextField({
    name: 'scheduledPeriod',
    required: false
  }));

  ensureField('scheduledLabel', 'text', () => new TextField({
    name: 'scheduledLabel',
    required: false
  }));

  ensureField('isBusinessTask', 'bool', () => new BoolField({
    name: 'isBusinessTask',
    required: false
  }));

  ensureField('isClientTask', 'bool', () => new BoolField({
    name: 'isClientTask',
    required: false
  }));

  return app.save(collection);
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId('tasks');
    collection.fields.removeByName('scheduledDate');
    collection.fields.removeByName('scheduledPeriod');
    collection.fields.removeByName('scheduledLabel');
    collection.fields.removeByName('isBusinessTask');
    collection.fields.removeByName('isClientTask');
    return app.save(collection);
  } catch (e) {
    if (e.message.includes('no rows in result set')) {
      console.log('Collection not found, skipping revert');
      return;
    }
    throw e;
  }
});
