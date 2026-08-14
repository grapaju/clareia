/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("tasks");

  const record0 = new Record(collection);
    record0.id = "61ww87xs8kz7sn5";
    record0.set("title", "Preparar reuni\u00e3o com diretor do Expocentro");
    record0.set("taskType", "Reuni\u00e3o");
    record0.set("status", "Hoje");
    record0.set("importance", "Alta");
    record0.set("urgency", "Alta");
    record0.set("energyLevel", "Alta");
    record0.set("project", "Expocentro");
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
    record1.id = "0rt1p17pip5naw1";
    record1.set("title", "Verificar cobran\u00e7as no fluxo de caixa");
    record1.set("taskType", "Cobran\u00e7a");
    record1.set("status", "Hoje");
    record1.set("importance", "Alta");
    record1.set("urgency", "Alta");
    record1.set("energyLevel", "M\u00e9dia");
    record1.set("project", "Financeiro");
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
    record2.id = "3a3oxqpqcukdead";
    record2.set("title", "Criar grupo de recursos no Google Ads da Corcril");
    record2.set("taskType", "Google Ads");
    record2.set("status", "Esta semana");
    record2.set("importance", "Alta");
    record2.set("urgency", "M\u00e9dia");
    record2.set("energyLevel", "Alta");
    record2.set("project", "Corcril");
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
    record3.id = "20413rnaoyxs426";
    record3.set("title", "Atualizar sistema explicando altera\u00e7\u00f5es");
    record3.set("taskType", "Desenvolvimento");
    record3.set("status", "Esta semana");
    record3.set("importance", "M\u00e9dia");
    record3.set("urgency", "M\u00e9dia");
    record3.set("energyLevel", "Alta");
    record3.set("project", "Sistema");
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
    record4.id = "ywwr0n6d0drqz95";
    record4.set("title", "Acompanhar campanha da Corcril");
    record4.set("taskType", "Google Ads");
    record4.set("status", "Esta semana");
    record4.set("importance", "M\u00e9dia");
    record4.set("urgency", "M\u00e9dia");
    record4.set("energyLevel", "M\u00e9dia");
    record4.set("project", "Corcril");
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
    record5.id = "srsizvapt36y51i";
    record5.set("title", "Lan\u00e7ar empreendimento no site da Leone");
    record5.set("taskType", "Site");
    record5.set("status", "Pr\u00f3xima semana");
    record5.set("importance", "Alta");
    record5.set("urgency", "M\u00e9dia");
    record5.set("energyLevel", "Alta");
    record5.set("project", "Leone");
  try {
    app.save(record5);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record6 = new Record(collection);
    record6.id = "x1jgh8dxxa2k59u";
    record6.set("title", "Verificar site do IDTPR");
    record6.set("taskType", "Site");
    record6.set("status", "Pr\u00f3xima semana");
    record6.set("importance", "M\u00e9dia");
    record6.set("urgency", "Baixa");
    record6.set("energyLevel", "M\u00e9dia");
    record6.set("project", "IDTPR");
  try {
    app.save(record6);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record7 = new Record(collection);
    record7.id = "zvezlo7sbc3gcr8";
    record7.set("title", "Retomar CRM da Leone");
    record7.set("taskType", "Desenvolvimento");
    record7.set("status", "Backlog");
    record7.set("importance", "M\u00e9dia");
    record7.set("urgency", "Baixa");
    record7.set("energyLevel", "M\u00e9dia");
    record7.set("project", "Leone");
  try {
    app.save(record7);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }

  const record8 = new Record(collection);
    record8.id = "gwty0kpufxj7iuj";
    record8.set("title", "Falar com equipe da Torion");
    record8.set("taskType", "Atendimento");
    record8.set("status", "Backlog");
    record8.set("importance", "Baixa");
    record8.set("urgency", "Baixa");
    record8.set("energyLevel", "Baixa");
    record8.set("project", "Torion");
  try {
    app.save(record8);
  } catch (e) {
    if (e.message.includes("Value must be unique")) {
      console.log("Record with unique value already exists, skipping");
    } else {
      throw e;
    }
  }
}, (app) => {
  const seededRecordIds = ["gwty0kpufxj7iuj", "zvezlo7sbc3gcr8", "x1jgh8dxxa2k59u", "srsizvapt36y51i", "ywwr0n6d0drqz95", "20413rnaoyxs426", "3a3oxqpqcukdead", "0rt1p17pip5naw1", "61ww87xs8kz7sn5"];
  for (const seededRecordId of seededRecordIds) {
    try {
      app.delete(app.findRecordById("tasks", seededRecordId));
    } catch (error) {
      if (error.message.includes("no rows in result set")) {
        continue;
      }
      throw error;
    }
  }
})
