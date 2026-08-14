/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const scopedCollections = [
    { name: 'tasks', userField: 'userId' },
    { name: 'billings', userField: 'userId' },
    { name: 'anotacoes', userField: 'userId' },
    { name: 'planosClareados', userField: 'userId' },
    { name: 'taskNotes', userField: 'userId' },
    { name: 'focusSessions', userField: 'userId' },
    { name: 'notifications', userField: 'user_id' }
  ];

  const createScopedRules = (userField) => {
    const scopedAccess = `(accountId != '' && accountId = @request.auth.currentAccountId) || (accountId = '' && ${userField} = @request.auth.id)`;
    const scopedCreate = `@request.auth.id != '' && ((@request.auth.currentAccountId != '' && accountId = @request.auth.currentAccountId) || (@request.auth.currentAccountId = '' && ${userField} = @request.auth.id))`;

    return {
      createRule: scopedCreate,
      listRule: scopedAccess,
      viewRule: scopedAccess,
      updateRule: scopedAccess,
      deleteRule: scopedAccess
    };
  };

  const ensureTextField = (collection, fieldName) => {
    if (collection.fields.getByName(fieldName)) {
      return;
    }

    collection.fields.add(new TextField({
      name: fieldName,
      required: false,
      max: 0,
      min: 0,
      pattern: ''
    }));
  };

  const users = app.findCollectionByNameOrId('users');
  ensureTextField(users, 'currentAccountId');
  app.save(users);

  for (const config of scopedCollections) {
    try {
      const collection = app.findCollectionByNameOrId(config.name);
      ensureTextField(collection, 'accountId');

      const rules = createScopedRules(config.userField);
      collection.createRule = rules.createRule;
      collection.listRule = rules.listRule;
      collection.viewRule = rules.viewRule;
      collection.updateRule = rules.updateRule;
      collection.deleteRule = rules.deleteRule;

      app.save(collection);
    } catch (error) {
      if (!error.message.includes('no rows in result set')) {
        throw error;
      }
    }
  }

  try {
    app.findCollectionByNameOrId('accounts');
  } catch (error) {
    if (!error.message.includes('no rows in result set')) {
      throw error;
    }

    const accounts = new Collection({
      type: 'base',
      name: 'accounts',
      listRule: 'ownerUserId = @request.auth.id',
      viewRule: 'ownerUserId = @request.auth.id',
      createRule: '@request.auth.id != "" && ownerUserId = @request.auth.id',
      updateRule: 'ownerUserId = @request.auth.id',
      deleteRule: 'ownerUserId = @request.auth.id',
      indexes: [
        'CREATE UNIQUE INDEX idx_accounts_owner_user ON accounts (ownerUserId)'
      ],
      fields: [
        {
          autogeneratePattern: '[a-z0-9]{15}',
          hidden: false,
          id: 'textacctid000001',
          max: 15,
          min: 15,
          name: 'id',
          pattern: '^[a-z0-9]+$',
          presentable: false,
          primaryKey: true,
          required: true,
          system: true,
          type: 'text'
        },
        {
          hidden: false,
          id: 'textacctname0001',
          name: 'name',
          presentable: false,
          primaryKey: false,
          required: true,
          system: false,
          type: 'text',
          autogeneratePattern: '',
          max: 0,
          min: 0,
          pattern: ''
        },
        {
          hidden: false,
          id: 'textacctowner01',
          name: 'ownerUserId',
          presentable: false,
          primaryKey: false,
          required: true,
          system: false,
          type: 'text',
          autogeneratePattern: '',
          max: 0,
          min: 0,
          pattern: ''
        },
        {
          hidden: false,
          id: 'boolacctactive1',
          name: 'isActive',
          presentable: false,
          required: false,
          system: false,
          type: 'bool'
        },
        {
          hidden: false,
          id: 'autodtaccreate1',
          name: 'created',
          onCreate: true,
          onUpdate: false,
          presentable: false,
          system: false,
          type: 'autodate'
        },
        {
          hidden: false,
          id: 'autodtacupdate1',
          name: 'updated',
          onCreate: true,
          onUpdate: true,
          presentable: false,
          system: false,
          type: 'autodate'
        }
      ]
    });

    app.save(accounts);
  }
}, (app) => {
  const scopedCollections = [
    { name: 'tasks', userField: 'userId' },
    { name: 'billings', userField: 'userId' },
    { name: 'anotacoes', userField: 'userId' },
    { name: 'planosClareados', userField: 'userId' },
    { name: 'taskNotes', userField: 'userId' },
    { name: 'focusSessions', userField: 'userId' },
    { name: 'notifications', userField: 'user_id' }
  ];

  const revertRules = (userField) => ({
    createRule: '@request.auth.id != ""',
    listRule: `${userField} = @request.auth.id`,
    viewRule: `${userField} = @request.auth.id`,
    updateRule: `${userField} = @request.auth.id`,
    deleteRule: `${userField} = @request.auth.id`
  });

  try {
    const users = app.findCollectionByNameOrId('users');
    users.fields.removeByName('currentAccountId');
    app.save(users);
  } catch (error) {
    if (!error.message.includes('no rows in result set')) {
      throw error;
    }
  }

  for (const config of scopedCollections) {
    try {
      const collection = app.findCollectionByNameOrId(config.name);
      collection.fields.removeByName('accountId');

      const rules = revertRules(config.userField);
      collection.createRule = rules.createRule;
      collection.listRule = rules.listRule;
      collection.viewRule = rules.viewRule;
      collection.updateRule = rules.updateRule;
      collection.deleteRule = rules.deleteRule;

      app.save(collection);
    } catch (error) {
      if (!error.message.includes('no rows in result set')) {
        throw error;
      }
    }
  }

  try {
    const accounts = app.findCollectionByNameOrId('accounts');
    app.delete(accounts);
  } catch (error) {
    if (!error.message.includes('no rows in result set')) {
      throw error;
    }
  }
});
