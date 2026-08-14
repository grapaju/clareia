/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("tasks");

  const existing = collection.fields.getByName("energiaNecessaria");
  if (existing) {
    if (existing.type === "select") {
      return; // field already exists with correct type, skip
    }
    collection.fields.removeByName("energiaNecessaria"); // exists with wrong type, remove first
  }

  collection.fields.add(new SelectField({
    name: "energiaNecessaria",
    required: true,
    values: ["Baixa", "M\u00e9dia", "Alta"]
  }));

  return app.save(collection);
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("tasks");
    collection.fields.removeByName("energiaNecessaria");
    return app.save(collection);
  } catch (e) {
    if (e.message.includes("no rows in result set")) {
      console.log("Collection not found, skipping revert");
      return;
    }
    throw e;
  }
})
