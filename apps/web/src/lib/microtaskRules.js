
export function generateMicrotasks(taskType, taskTitle = '', timeEstimate = 30) {
  const type = taskType?.toLowerCase() || 'outro';
  const title = taskTitle.toLowerCase();
  
  const generateId = () => Math.random().toString(36).substr(2, 9);
  
  const createTasks = (texts) => texts.map((desc, index) => ({
    id: generateId(),
    taskId: '',
    title: desc,
    completed: false,
    completedAt: null,
    orderIndex: index,
    descricao: desc,
    status: 'não iniciada'
  }));

  if (type === 'reunião' || title.includes('reunião')) {
    return createTasks([
      'Listar os objetivos principais da conversa',
      'Separar links, documentos e materiais necessários',
      'Escrever tópicos ou dúvidas para abordar',
      'Acessar a sala/link 5 minutos antes',
      'Anotar os próximos passos ao final'
    ]);
  }

  if (type === 'cobrança' || title.includes('cobrança') || title.includes('fatura')) {
    return createTasks([
      `Abrir o e-mail e localizar a conversa relacionada a “${taskTitle}”`,
      'Identificar a pendência e o vencimento mais recentes',
      'Abrir a conversa ou o documento de cobrança',
      'Escrever e revisar a mensagem',
      'Enviar e registrar o retorno esperado'
    ]);
  }

  if (type === 'google ads' || title.includes('ads') || title.includes('campanha')) {
    return createTasks([
      'Acessar a conta do Google Ads',
      'Revisar o objetivo da campanha',
      'Checar métricas de custo e conversão',
      'Ajustar lances ou pausas de palavras-chave ruins',
      'Salvar as alterações e monitorar o status'
    ]);
  }

  if (type === 'site' || title.includes('site') || title.includes('landing page')) {
    return createTasks([
      'Acessar o editor ou painel do site',
      'Localizar a seção que precisa de ajuste',
      'Preparar textos ou imagens novos',
      'Aplicar as mudanças de layout ou conteúdo',
      'Testar no celular e publicar as alterações'
    ]);
  }

  if (type === 'desenvolvimento' || title.includes('api') || title.includes('código')) {
    return createTasks([
      'Abrir o ambiente local do projeto',
      'Revisar a documentação ou requisitos da funcionalidade',
      'Escrever o código principal / lógica',
      'Realizar testes básicos locais',
      'Fazer o commit e deploy'
    ]);
  }

  if (type === 'evento' || title.includes('evento')) {
    return createTasks([
      'Verificar as informações de data e local',
      'Confirmar presença ou comprar ingresso (se aplicável)',
      'Bloquear o horário na agenda principal',
      'Anotar detalhes de logística (transporte, materiais)'
    ]);
  }

  // Generic fallback especially if time > 60
  if (timeEstimate > 60) {
    return createTasks([
      `Abrir os materiais necessários para “${taskTitle}”`,
      `Identificar a primeira entrega concreta de “${taskTitle}”`,
      'Produzir essa primeira entrega',
      'Verificar o resultado obtido',
      'Registrar o próximo passo específico'
    ]);
  }

  return createTasks([
    `Abrir o material necessário para “${taskTitle}”`,
    `Fazer a primeira ação concreta de “${taskTitle}”`,
    `Verificar o resultado de “${taskTitle}”`
  ]);
}

export function suggestSmallerSteps(task = {}) {
  const safeTask = task || {};
  const pendingMicrotask = (Array.isArray(safeTask.microtarefas) ? safeTask.microtarefas : [])
    .find((item) => !item?.completed && String(item?.title || item?.descricao || '').trim());
  if (pendingMicrotask) {
    return [String(pendingMicrotask.title || pendingMicrotask.descricao).trim()];
  }

  const generated = generateMicrotasks(safeTask.taskType, safeTask.title, safeTask.timeEstimate)
    .map((item) => item.title)
    .filter(Boolean);
  if (generated.length > 0 && safeTask.taskType && safeTask.taskType !== 'Outro') {
    return generated.slice(0, 3);
  }

  const title = String(safeTask.title || 'esta tarefa').trim();
  return [
    `Abrir os materiais de “${title}”`,
    `Escrever o primeiro resultado necessário para “${title}”`,
    `Trabalhar por 5 minutos somente no início de “${title}”`,
  ];
}
