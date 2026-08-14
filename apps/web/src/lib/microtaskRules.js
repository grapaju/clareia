
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
      'Abrir o sistema ou planilha financeira',
      'Verificar o valor exato e a data de vencimento',
      'Gerar o link de pagamento ou nota fiscal',
      'Escrever mensagem amigável de lembrete',
      'Enviar para o cliente',
      'Registrar que a cobrança foi enviada'
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
      'Testar visualização no celular',
      'Publicar alterações'
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
      'Reunir todas as informações e ferramentas',
      'Fazer a primeira parte do trabalho (foco em começar)',
      'Avançar no desenvolvimento da tarefa principal',
      'Fazer uma pausa rápida',
      'Revisar o que foi feito',
      'Finalizar e comunicar os envolvidos'
    ]);
  }

  return createTasks([
    'Reunir o que é necessário para começar',
    'Focar na execução principal',
    'Revisar e concluir'
  ]);
}
