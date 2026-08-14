/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("billings");

  const record0 = new Record(collection);
    record0.id = "5k5u7lyj1lr6lyu";
    record0.set("client", "Leone Empreendimento");
    record0.set("amount", 5000);
    record0.set("dueDate", "2024-02-15");
    record0.set("status", "Enviada aguardando pagamento");
    record0.set("description", "Lan\u00e7amento de empreendimento no site");
    record0.set("invoiceNumber", "INV-001");
  try {
    app.save(record0);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record1 = new Record(collection);
    record1.id = "vlkzy1pdqqcb0my";
    record1.set("client", "Corcril Google Ads");
    record1.set("amount", 2500);
    record1.set("dueDate", "2024-02-10");
    record1.set("status", "Enviada aguardando pagamento");
    record1.set("description", "Campanha Google Ads - Fevereiro");
    record1.set("invoiceNumber", "INV-002");
  try {
    app.save(record1);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record2 = new Record(collection);
    record2.id = "diigsk5cvfftkzg";
    record2.set("client", "Expocentro Reuni\u00e3o");
    record2.set("amount", 1500);
    record2.set("dueDate", "2024-02-20");
    record2.set("status", "A enviar");
    record2.set("description", "Consultoria e reuni\u00e3o com diretor");
    record2.set("invoiceNumber", "INV-003");
  try {
    app.save(record2);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record3 = new Record(collection);
    record3.id = "u1bd1w4kkhbpj36";
    record3.set("client", "IDTPR Site");
    record3.set("amount", 3000);
    record3.set("dueDate", "2024-02-28");
    record3.set("status", "A enviar");
    record3.set("description", "Desenvolvimento e manuten\u00e7\u00e3o do site");
    record3.set("invoiceNumber", "INV-004");
  try {
    app.save(record3);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record4 = new Record(collection);
    record4.id = "brvwwg65fluc8u1";
    record4.set("client", "Torion Site integrado");
    record4.set("amount", 4000);
    record4.set("dueDate", "2024-03-05");
    record4.set("status", "A enviar");
    record4.set("description", "Site integrado com sistema");
    record4.set("invoiceNumber", "INV-005");
  try {
    app.save(record4);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record5 = new Record(collection);
    record5.id = "uihwkaa28zfhfle";
    record5.set("client", "Corcril Anterior");
    record5.set("amount", 1800);
    record5.set("dueDate", "2024-01-31");
    record5.set("status", "Vencida");
    record5.set("description", "Servi\u00e7os anteriores - Janeiro");
    record5.set("invoiceNumber", "INV-006");
  try {
    app.save(record5);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }
}, (app) => {
  const seededRecordIds = ["uihwkaa28zfhfle", "brvwwg65fluc8u1", "u1bd1w4kkhbpj36", "diigsk5cvfftkzg", "vlkzy1pdqqcb0my", "5k5u7lyj1lr6lyu"];
  for (const seededRecordId of seededRecordIds) {
    try {
      app.delete(app.findRecordById("billings", seededRecordId));
    } catch (error) {
      if (error.message.includes("no rows in result set")) {
        continue;
      }
      throw error;
    }
  }
})
