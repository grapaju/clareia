const GENERIC_STEP_PATTERNS = [
  /atividade principal/i,
  /fazer a tarefa/i,
  /executar a tarefa/i,
  /dar continuidade/i,
  /resolver (?:a|o|esta|esse)\b/i,
  /material relacionado/i,
  /crit[eé]rio de aprova[cç][aã]o/i,
  /informa[cç][oõ]es obrigat[oó]rias aplic[aá]veis/i,
  /pend[eê]ncias necess[aá]rias/i,
  /revisar (?:o )?resultado/i,
  /providenciar ajustes/i,
];

const CLASSIFICATION_RULES = [
  {
    domain: 'debugging',
    subdomain: 'backend',
    intent: 'diagnosticar e corrigir falha',
    objectSignals: /(n[aã]o (?:est[aá]|foi|consegue)|erro|falha|bug|quebrou|parou|incidente|automaticamente)/i,
    contextSignals: /(backend|fastify|api|sistema|automa[cç][aã]o|job|recorr[eê]ncia)/i,
    score: 100,
  },
  {
    domain: 'frontend',
    subdomain: 'responsive_ui',
    intent: 'revisar e corrigir responsividade',
    objectSignals: /(layout|interface|tela|p[aá]gina).*(mobile|responsiv|celular|viewport|overflow)|(?:mobile|responsiv|viewport|overflow).*(layout|interface|tela|p[aá]gina)/i,
    contextSignals: /(wordpress|elementor|frontend|site|css)/i,
    score: 95,
  },
  {
    domain: 'analytics',
    subdomain: 'tracking',
    intent: 'configurar e validar mensuração',
    objectSignals: /(analytics|gtm|tag manager|convers[aã]o|evento de compra|tracking|rastreamento|pixel)/i,
    contextSignals: /(google ads|ads|campanha|analytics|gtm|convers[aã]o)/i,
    score: 90,
  },
  {
    domain: 'reporting',
    subdomain: 'communication',
    intent: 'conferir e enviar relatório',
    actionSignals: /(enviar|encaminhar|compartilhar|entregar)/i,
    objectSignals: /(relat[oó]rio|demonstrativo|fechamento)/i,
    score: 88,
  },
  {
    domain: 'technical',
    subdomain: 'monitoring',
    intent: 'analisar cenário técnico',
    objectSignals: /(monitoramento|observabilidade|health ?check|uptime|lat[eê]ncia|incidente|logs?)/i,
    contextSignals: /(site|backend|infraestrutura|servidor|sistema)/i,
    score: 82,
  },
  {
    domain: 'frontend',
    subdomain: 'wordpress',
    intent: 'alterar e validar interface web',
    objectSignals: /(wordpress|elementor|site|landing page|p[aá]gina|frontend|css|layout)/i,
    contextSignals: /(wordpress|elementor|site|frontend|css)/i,
    score: 78,
  },
  {
    domain: 'delivery',
    subdomain: 'communication',
    intent: 'preparar e enviar uma entrega',
    actionSignals: /(enviar|encaminhar|entregar|compartilhar|publicar|submeter)/i,
    objectSignals: /(or[cç]amento|proposta|arquivo|documento|material)/i,
    score: 75,
  },
  {
    domain: 'finance',
    subdomain: 'financial_review',
    intent: 'conferir informação financeira',
    objectSignals: /(fatura|boleto|pagamento|cobran[cç]a|vencimento|fluxo de caixa|recorr[eê]ncia)/i,
    score: 72,
  },
  {
    domain: 'documentation',
    subdomain: 'document_review',
    intent: 'revisar documento',
    actionSignals: /(revisar|conferir|validar|aprovar|analisar)/i,
    objectSignals: /(contrato|documento|proposta|or[cç]amento|texto|termo|manual|documenta[cç][aã]o)/i,
    score: 68,
  },
  {
    domain: 'meeting',
    subdomain: 'communication',
    intent: 'preparar e conduzir alinhamento',
    objectSignals: /(reuni[aã]o|call|alinhamento|apresenta[cç][aã]o)/i,
    score: 60,
  },
  {
    domain: 'integration',
    subdomain: 'backend',
    intent: 'implementar e validar integração',
    objectSignals: /(integra[cç][aã]o|webhook|api|sincroniza[cç][aã]o)/i,
    contextSignals: /(backend|fastify|api|webhook)/i,
    score: 58,
  },
  {
    domain: 'ads',
    subdomain: 'marketing',
    intent: 'configurar ou analisar campanha',
    objectSignals: /(google ads|campanha|an[uú]ncio|grupo de recursos)/i,
    contextSignals: /(google ads|marketing|campanha|m[ií]dia paga)/i,
    score: 55,
  },
  {
    domain: 'communication',
    subdomain: 'contact',
    intent: 'realizar contato e registrar retorno',
    objectSignals: /(falar com|entrar em contato|contatar|ligar|mandar mensagem|enviar mensagem|retornar para)/i,
    score: 50,
  },
  {
    domain: 'file_organization',
    subdomain: 'organization',
    intent: 'organizar arquivos',
    objectSignals: /(organizar|renomear|mover|separar).*(arquivo|pasta|drive|documento)/i,
    score: 48,
  },
  {
    domain: 'backend',
    subdomain: 'development',
    intent: 'analisar ou implementar uma mudança técnica',
    objectSignals: /(logs?|api|servidor|backend|fastify|banco de dados|job|c[oó]digo|implementar|desenvolver|sistema|crm)/i,
    contextSignals: /(backend|fastify|api|servidor|sistema|crm)/i,
    score: 45,
  },
];

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalize(value) {
  return clean(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function taskText(task = {}) {
  return clean([task.title, task.description, task.originalText, task.objective].filter(Boolean).join('. '));
}

function projectContext(context = {}) {
  const project = context.projectProfile || context.project || {};
  return {
    name: clean(project.name || context.projectName),
    summary: clean(project.summary || context.projectSummary),
    projectType: clean(project.projectType || context.projectType),
  };
}

function extractAction(text) {
  return normalize(text).match(/\b(revisar|conferir|validar|aprovar|analisar|enviar|encaminhar|compartilhar|entregar|corrigir|investigar|testar|configurar|continuar|retomar|organizar|criar|implementar|publicar)\b/)?.[1] || '';
}

function extractObject(text) {
  return clean(text)
    .replace(/^[^-:]{2,30}\s*[-:]\s*/, '')
    .replace(/^(revisar|conferir|validar|aprovar|analisar|enviar|encaminhar|compartilhar|entregar|corrigir|investigar|testar|configurar|continuar|retomar|organizar|criar|implementar|publicar)\s+/i, '')
    .trim();
}

function classifyTask(text, project) {
  const normalizedText = normalize(text);
  const normalizedContext = normalize(`${project.name}. ${project.projectType}. ${project.summary}`);
  const matches = CLASSIFICATION_RULES.map((rule) => {
    const objectMatch = rule.objectSignals?.test(normalizedText) || false;
    const actionMatch = rule.actionSignals?.test(normalizedText) || false;
    const contextMatch = rule.contextSignals?.test(normalizedContext) || false;
    if (!objectMatch && !contextMatch) return null;
    if (rule.actionSignals && !actionMatch) return null;
    return {
      ...rule,
      score: rule.score + (objectMatch ? 30 : 0) + (actionMatch ? 10 : 0) + (contextMatch ? 8 : 0),
      source: objectMatch ? (contextMatch ? 'semantic_contextual' : 'semantic') : 'contextual',
    };
  }).filter(Boolean);
  return matches.sort((left, right) => right.score - left.score)[0] || null;
}

export function interpretTask(task = {}, context = {}) {
  const text = taskText(task);
  const project = projectContext(context);
  const classification = classifyTask(text, project);
  const financeSystem = classification?.domain === 'debugging'
    && /fatura|boleto|pagamento|cobran[cç]a|fluxo de caixa|recorr[eê]ncia/i.test(text);
  const fullContext = `${text} ${project.summary} ${project.projectType}`;
  const adsContext = /google ads|campanha|convers[aã]o|gtm/i.test(fullContext);
  const wordpressContext = /wordpress/i.test(fullContext);
  const elementorContext = /elementor/i.test(fullContext);

  return {
    text,
    action: extractAction(text),
    object: extractObject(task.title || text),
    domain: classification?.domain || 'general',
    subdomain: classification?.subdomain || 'general',
    facets: [
      classification?.domain,
      classification?.subdomain,
      financeSystem ? 'finance_system' : '',
      adsContext ? 'ads' : '',
      wordpressContext ? 'wordpress' : '',
      elementorContext ? 'elementor' : '',
    ].filter(Boolean),
    intent: classification?.intent || 'transformar a tarefa em uma entrega verificável',
    project,
    source: classification?.source || 'fallback',
    confidence: classification ? Math.min(0.98, classification.score / 150) : 0.35,
  };
}

export function inferExpectedOutcome(interpretation) {
  const outcomes = {
    debugging: 'Falha reproduzida, causa corrigida e fluxo validado no cenário afetado.',
    technical: 'Cenário técnico analisado, mudança aplicada e resultado validado com evidências.',
    backend: 'Mudança implementada no fluxo de backend e validada no cenário afetado.',
    integration: 'Integração configurada e validada de ponta a ponta.',
    frontend: 'Interface corrigida e validada nas condições de exibição relevantes.',
    reporting: 'Relatório conferido e entregue ao destinatário correto.',
    analytics: 'Mensuração configurada e validada com evidências de disparo.',
    ads: 'Campanha configurada ou analisada, com alterações e resultado registrados.',
    finance: 'Informação financeira conferida e situação registrada.',
    documentation: 'Documento revisado com os critérios pertinentes ao seu conteúdo.',
    communication: 'Contato realizado com objetivo claro e envio confirmado.',
    file_organization: 'Arquivos organizados em uma estrutura localizável.',
    delivery: 'Entrega revisada, enviada ao destinatário correto e envio registrado.',
    meeting: 'Alinhamento realizado com decisões e responsáveis registrados.',
  };
  return outcomes[interpretation.domain] || `Resultado verificável de “${interpretation.text || 'esta tarefa'}” concluído e revisado.`;
}

function semanticSteps(interpretation) {
  const subject = interpretation.text || '';
  const object = interpretation.object || 'item';
  const normalizedSubject = normalize(subject);
  const recipient = subject.match(/\bpara\s+(?:a|o)?\s*([\p{L}][\p{L}\s-]{1,40})$/iu)?.[1]?.trim();
  const whatsappContact = subject.match(/\b(?:o|a)\s+([\p{L}-]+)\s+(?:pediu|solicitou)/iu)?.[1];
  const reportName = object.replace(/\s+para\s+(?:a|o)?\s*[\p{L}][\p{L}\s-]*$/iu, '').trim() || 'relatório';
  const usesElementor = /elementor/i.test(`${subject} ${interpretation.project.summary}`);
  const financeFailure = interpretation.facets.includes('finance_system');
  const steps = {
    debugging: financeFailure ? [
      'Reproduzir a falha com uma recorrência',
      'Identificar a recorrência e a fatura afetadas',
      'Verificar o job e a regra de geração automática',
      'Conferir os logs da execução',
      'Corrigir a causa da falha',
      'Testar novamente a geração de faturas',
    ] : [
      `Reproduzir a falha em ${object}`,
      'Registrar a entrada e o comportamento observado',
      'Verificar os logs do fluxo afetado',
      'Localizar a etapa que interrompe o resultado',
      'Corrigir a causa da falha',
      'Testar o cenário corrigido e uma regressão próxima',
    ],
    technical: [
      'Mapear o estado atual do monitoramento',
      'Verificar métricas, alertas e cobertura das rotas críticas',
      'Analisar incidentes e falsos positivos recentes',
      'Priorizar melhorias por impacto e esforço',
      'Validar a configuração proposta com dados do ambiente',
      'Registrar as mudanças e os critérios de acompanhamento',
    ],
    frontend: interpretation.subdomain === 'responsive_ui' ? [
      'Abrir a página em largura mobile',
      'Verificar menu, cabeçalho, alinhamentos e espaçamentos',
      'Identificar overflow, quebras e elementos fora da tela',
      usesElementor ? 'Corrigir a responsividade no Elementor ou CSS' : 'Corrigir a responsividade no CSS ou componente',
      'Testar novamente em diferentes larguras',
    ] : [
      whatsappContact ? `Abrir a conversa do ${whatsappContact} no WhatsApp e localizar o pedido` : `Abrir ${object} no navegador`,
      'Localizar o componente ou seção que precisa mudar',
      'Aplicar o ajuste no editor ou código',
      'Testar o comportamento no desktop e no celular',
      'Validar a alteração antes de publicar',
    ],
    reporting: [
      `Abrir o ${reportName.replace(/^o\s+/i, '')}`,
      normalizedSubject.includes('pagamento') ? 'Conferir o período e os valores' : 'Conferir o período e os dados apresentados',
      'Exportar a versão final',
      recipient ? `Enviar para ${recipient}` : 'Enviar ao destinatário indicado',
    ],
    analytics: [
      'Retomar a configuração atual de mensuração',
      'Verificar o evento de compra ou conversão',
      'Validar o disparo da tag no GTM',
      'Conferir a configuração da conversão no Google Ads',
      'Registrar o resultado da validação',
    ],
    delivery: [
      `Abrir ${object}`,
      'Conferir o conteúdo e o formato do arquivo',
      'Preparar uma mensagem curta de envio',
      recipient ? `Enviar para ${recipient}` : 'Enviar pelo canal indicado',
      'Confirmar que o envio foi concluído',
    ],
    documentation: [
      `Abrir ${object}`,
      /proposta|or[cç]amento/i.test(subject) ? 'Conferir escopo, valores e condições apresentadas' : 'Conferir cláusulas, referências e consistência do texto',
      'Marcar trechos inconsistentes ou incompletos',
      'Aplicar as correções no documento',
      'Reler os trechos alterados',
    ],
    finance: [
      `Abrir ${object}`,
      'Conferir os lançamentos e valores envolvidos',
      'Identificar divergências financeiras',
      'Corrigir ou sinalizar cada divergência',
      'Registrar a situação atualizada',
    ],
    meeting: [
      'Definir o objetivo específico da reunião',
      'Listar as decisões e dúvidas para alinhamento',
      'Separar as referências necessárias para a conversa',
      'Confirmar participantes, horário e canal',
      'Conduzir o alinhamento e registrar decisões',
      'Enviar o resumo e os próximos passos aos participantes',
    ],
    ads: [
      'Abrir a conta do Google Ads',
      'Confirmar objetivo, período e indicadores relevantes',
      'Analisar configurações, alertas e desempenho atual',
      'Aplicar apenas os ajustes sustentados pelos dados encontrados',
      'Revisar as alterações antes de publicar',
      'Registrar o que mudou e quando o resultado será reavaliado',
    ],
    communication: [
      `Definir o objetivo do contato sobre ${object}`,
      'Localizar a conversa anterior e os dados necessários',
      'Escrever uma mensagem curta com contexto e pedido claro',
      'Revisar destinatário, tom e informação enviada',
      'Enviar a mensagem pelo canal adequado',
      'Registrar o retorno ou a data do próximo acompanhamento',
    ],
    integration: [
      `Mapear o fluxo de ${object}`,
      'Identificar origem, destino e formato dos dados',
      'Implementar a troca de dados entre os serviços',
      'Tratar falhas e respostas inesperadas',
      'Testar a integração de ponta a ponta',
    ],
    backend: [
      `Abrir o fluxo de backend de ${object}`,
      'Localizar regra, serviço e persistência envolvidos',
      'Implementar a alteração necessária',
      'Cobrir o cenário com teste automatizado',
      'Validar a resposta e os efeitos no banco',
    ],
    file_organization: [
      `Localizar os arquivos de ${object}`,
      'Separar os itens por tipo ou finalidade',
      'Renomear os arquivos com um padrão consistente',
      'Mover os arquivos para as pastas corretas',
      'Confirmar que os itens continuam localizáveis',
    ],
  };
  return steps[interpretation.domain] || [];
}

export function generateSemanticSteps(interpretation, options = {}) {
  const duration = Number(options.timeEstimate || 0);
  const limit = duration > 0 ? (duration <= 20 ? 3 : duration <= 60 ? 5 : 6) : 7;
  return semanticSteps(interpretation).slice(0, limit);
}

export function validateSteps(steps = [], context = {}) {
  const unique = [];
  const signatures = new Set();
  const taskSource = clean([context.task?.title, context.task?.description, context.interpretation?.project?.summary].filter(Boolean).join(' '));
  const normalizedSource = normalize(taskSource);
  const normalizedTitle = normalize(context.task?.title).replace(/[^a-z0-9]+/g, ' ').trim();
  const forbiddenConcepts = [
    { term: /\bvalor(?:es)?\b/i, evidence: /valor|pagamento|finance|or[cç]amento|proposta|fatura|boleto/ },
    { term: /\bprazo(?:s)?\b/i, evidence: /prazo|data|vencimento|contrato|proposta/ },
    { term: /aprova[cç][aã]o/i, evidence: /aprova|proposta|or[cç]amento|publica/ },
    { term: /\brespons[aá]vel\b/i, evidence: /respons[aá]vel|cliente|equipe|para\s+[a-z]/ },
    { term: /\b(documento|documentos)\b/i, evidence: /documento|contrato|relat[oó]rio|arquivo|proposta|or[cç]amento/ },
  ];

  steps.forEach((step) => {
    const value = clean(step);
    const signature = normalize(value).replace(/[^a-z0-9]+/g, ' ');
    const repeatsTitle = normalizedTitle.length >= 8 && signature.includes(normalizedTitle);
    const inventsConcept = normalizedSource && forbiddenConcepts.some(({ term, evidence }) => term.test(value) && !evidence.test(normalizedSource));
    if (!value || value.length < 12 || GENERIC_STEP_PATTERNS.some((pattern) => pattern.test(value)) || repeatsTitle || inventsConcept || signatures.has(signature)) return;
    signatures.add(signature);
    unique.push(value);
  });

  return {
    valid: unique.length >= 3,
    steps: unique.slice(0, 7),
    rejectedCount: Math.max(0, steps.length - unique.length),
  };
}

export function genericFallbackSteps(task = {}, options = {}) {
  if (Number(options.timeEstimate || task.timeEstimate || 30) > 60) {
    return [
      'Identificar o resultado concreto esperado',
      'Separar as informações necessárias para começar',
      'Produzir essa primeira entrega',
      'Conferir o resultado produzido',
      'Registrar o próximo passo específico',
    ];
  }
  return [
    'Identificar o resultado concreto esperado',
    'Executar o primeiro bloco de trabalho',
    'Conferir o resultado produzido',
  ];
}

export function generateTaskBreakdown(task = {}, context = {}, options = {}) {
  const interpretation = interpretTask(task, context);
  const generated = generateSemanticSteps(interpretation, { ...options, timeEstimate: options.timeEstimate || task.timeEstimate });
  const validation = validateSteps(generated, { task, interpretation });
  const steps = validation.valid ? validation.steps : genericFallbackSteps(task, options);
  const generationSource = validation.valid ? interpretation.source : 'fallback';
  const suggestedTimeByDomain = {
    debugging: 90,
    technical: 90,
    backend: 90,
    integration: 90,
    frontend: 60,
    reporting: 30,
    analytics: 60,
    ads: 60,
    finance: 30,
    documentation: 45,
    communication: 20,
    file_organization: 30,
    delivery: 30,
    meeting: 60,
  };
  const suggestedTimeEstimate = suggestedTimeByDomain[interpretation.domain] || Number(task.timeEstimate || 30);

  return {
    interpretation,
    expectedOutcome: inferExpectedOutcome(interpretation),
    steps,
    firstAction: steps[0],
    generationSource,
    confidence: generationSource === 'fallback' ? 0.35 : interpretation.confidence,
    suggestedDomain: interpretation.domain,
    suggestedSubdomain: interpretation.subdomain,
    semanticFacets: interpretation.facets,
    suggestedTimeEstimate,
    suggestedEnergy: suggestedTimeEstimate >= 90 ? 'Alta' : suggestedTimeEstimate <= 30 ? 'Baixa' : 'Média',
  };
}