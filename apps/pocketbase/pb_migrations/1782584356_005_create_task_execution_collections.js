/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const taskNotes = new Collection({
    type: 'base',
    name: 'taskNotes',
    listRule: 'userId = @request.auth.id',
    viewRule: 'userId = @request.auth.id',
    createRule: '@request.auth.id != \'\'',
    updateRule: 'userId = @request.auth.id',
    deleteRule: 'userId = @request.auth.id',
    indexes: ['CREATE INDEX idx_taskNotes_task_user ON taskNotes (taskId, userId)'],
    fields: [
      { autogeneratePattern: '[a-z0-9]{15}', hidden: false, id: 'textntid0000001', max: 15, min: 15, name: 'id', pattern: '^[a-z0-9]+$', presentable: false, primaryKey: true, required: true, system: true, type: 'text' },
      { autogeneratePattern: '', hidden: false, id: 'textntuser00001', max: 0, min: 0, name: 'userId', pattern: '', presentable: false, primaryKey: false, required: true, system: false, type: 'text' },
      { autogeneratePattern: '', hidden: false, id: 'textnttask00001', max: 0, min: 0, name: 'taskId', pattern: '', presentable: false, primaryKey: false, required: true, system: false, type: 'text' },
      { autogeneratePattern: '', hidden: false, id: 'textntcont00001', max: 0, min: 0, name: 'content', pattern: '', presentable: false, primaryKey: false, required: true, system: false, type: 'text' },
      { hidden: false, id: 'autodtntcreate1', name: 'created', onCreate: true, onUpdate: false, presentable: false, system: false, type: 'autodate' },
      { hidden: false, id: 'autodtntupdate1', name: 'updated', onCreate: true, onUpdate: true, presentable: false, system: false, type: 'autodate' }
    ]
  });

  const focusSessions = new Collection({
    type: 'base',
    name: 'focusSessions',
    listRule: 'userId = @request.auth.id',
    viewRule: 'userId = @request.auth.id',
    createRule: '@request.auth.id != \'\'',
    updateRule: 'userId = @request.auth.id',
    deleteRule: 'userId = @request.auth.id',
    indexes: ['CREATE INDEX idx_focusSessions_task_user ON focusSessions (taskId, userId)'],
    fields: [
      { autogeneratePattern: '[a-z0-9]{15}', hidden: false, id: 'textfsid0000001', max: 15, min: 15, name: 'id', pattern: '^[a-z0-9]+$', presentable: false, primaryKey: true, required: true, system: true, type: 'text' },
      { autogeneratePattern: '', hidden: false, id: 'textfsuser00001', max: 0, min: 0, name: 'userId', pattern: '', presentable: false, primaryKey: false, required: true, system: false, type: 'text' },
      { autogeneratePattern: '', hidden: false, id: 'textfstask00001', max: 0, min: 0, name: 'taskId', pattern: '', presentable: false, primaryKey: false, required: true, system: false, type: 'text' },
      { hidden: false, id: 'numfsdurat00001', max: null, min: 0, name: 'durationSeconds', onlyInt: true, presentable: false, required: true, system: false, type: 'number' },
      { autogeneratePattern: '', hidden: false, id: 'textfsobj000001', max: 0, min: 0, name: 'objective', pattern: '', presentable: false, primaryKey: false, required: false, system: false, type: 'text' },
      { autogeneratePattern: '', hidden: false, id: 'textfsres000001', max: 0, min: 0, name: 'result', pattern: '', presentable: false, primaryKey: false, required: false, system: false, type: 'text' },
      { autogeneratePattern: '', hidden: false, id: 'textfsend000001', max: 0, min: 0, name: 'endReason', pattern: '', presentable: false, primaryKey: false, required: false, system: false, type: 'text' },
      { hidden: false, id: 'autodtfscreate1', name: 'created', onCreate: true, onUpdate: false, presentable: false, system: false, type: 'autodate' },
      { hidden: false, id: 'autodtfsupdate1', name: 'updated', onCreate: true, onUpdate: true, presentable: false, system: false, type: 'autodate' }
    ]
  });

  app.save(taskNotes);
  return app.save(focusSessions);
}, (app) => {
  for (const name of ['focusSessions', 'taskNotes']) {
    try {
      app.delete(app.findCollectionByNameOrId(name));
    } catch (error) {
      if (!error.message.includes('no rows in result set')) {
        throw error;
      }
    }
  }
});