/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("tasks");

  const existing = collection.fields.getByName("dataSugeridaExecucao");
  if (existing) {
    if (existing.type === "date") {
      return; // field already exists with correct type, skip
    }
    collection.fields.removeByName("dataSugeridaExecucao"); // exists with wrong type, remove first
  }

  collection.fields.add(new DateField({
    name: "dataSugeridaExecucao",
    required: true
  }));

  return app.save(collection);
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("tasks");
    collection.fields.removeByName("dataSugeridaExecucao");
    return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})
