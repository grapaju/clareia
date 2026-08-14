
export function getTaskSteps(taskType, taskTitle = '') {
  const type = taskType?.toUpperCase() || 'OUTRO';
  const title = taskTitle.toLowerCase();

  if (type === 'REUNIÃO' || title.includes('reunião') || title.includes('call')) {
    return [
      'Listar os objetivos principais da conversa',
      'Separar materiais e links necessários',
      'Preparar um roteiro ou pauta simples',
      'Antecipar respostas para prazos, valores ou dúvidas comuns',
      'Revisar a proposta (se houver)',
      'Anotar os próximos passos logo após o término'
    ];
  }

  if (type === 'COBRANÇA' || title.includes('cobrança') || title.includes('fatura')) {
    return [
      'Abrir o sistema financeiro ou planilha',
      'Filtrar o que está vencido ou vence em breve',
      'Verificar se os valores estão corretos',
      'Gerar a nota fiscal ou link de pagamento',
      'Enviar mensagem amigável para o cliente',
      'Registrar o status de "enviado" no sistema'
    ];
  }

  if (type === 'GOOGLE ADS' || title.includes('ads') || title.includes('campanha')) {
    return [
      'Abrir a campanha no painel do Google Ads',
      'Revisar o objetivo principal (conversão, clique, etc)',
      'Criar ou ajustar o grupo de recursos/anúncios',
      'Revisar os textos (copy) e imagens',
      'Publicar as alterações',
      'Registrar o que foi mudado para acompanhar depois',
      'Anotar a data para checar as métricas'
    ];
  }

  if (type === 'SITE' || title.includes('site') || title.includes('página')) {
    return [
      'Abrir o site no navegador para ver o estado atual',
      'Checar qual conteúdo precisa ser alterado',
      'Separar os textos e imagens novos em uma pasta',
      'Fazer os ajustes de layout no editor/código',
      'Testar como ficou no computador',
      'Testar como ficou no celular',
      'Publicar as alterações'
    ];
  }

  if (type === 'DESENVOLVIMENTO' || title.includes('crm') || title.includes('sistema')) {
    return [
      'Abrir o projeto no ambiente de desenvolvimento',
      'Testar o login e permissões',
      'Testar as telas principais',
      'Verificar se o banco de dados/API está respondendo',
      'Listar o que já está funcionando bem',
      'Listar o que está quebrado ou faltando',
      'Definir qual é a prioridade técnica número 1 agora'
    ];
  }

  if (type === 'EVENTO' || title.includes('evento')) {
    return [
      'Verificar a fonte da informação do evento',
      'Coletar datas, horários e links importantes',
      'Registrar no sistema ou agenda',
      'Revisar a página publicada (se houver)',
      'Compartilhar as informações com a equipe'
    ];
  }

  // Default generic steps for breaking down tasks
  return [
    'Reunir todas as informações necessárias',
    'Fazer um rascunho ou planejamento inicial',
    'Executar a parte principal da tarefa',
    'Revisar o que foi feito',
    'Concluir e avisar os envolvidos (se necessário)'
  ];
}
