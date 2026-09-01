
import { suggestTaskSchedule } from './schedulingRules.js';
import { toIsoDate } from './localDate.js';

const ACTION_VERBS = [
  'lançar',
  'lancar',
  'analisar',
  'criar',
  'atualizar',
  'acompanhar',
  'avaliar',
  'verificar',
  'conferir',
  'olhar',
  'enviar',
  'preparar',
  'publicar',
  'marcar',
  'agendar',
  'revisar',
  'resolver',
  'retomar',
  'testar',
  'falar com',
  'retornar',
  'cobrar',
  'gerar'
];

const FOLLOW_UP_VERBS = ['acompanhar', 'avaliar', 'verificar', 'olhar'];
const VERB_PATTERN = ACTION_VERBS.map(v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');

const PROJECT_KEYWORDS = [
  { pattern: /\binpacta\b/i, value: 'InPACTA' },
  { pattern: /\bleone\b/i, value: 'Leone' },
  { pattern: /\bcorcril\b/i, value: 'Corcril' },
  { pattern: /\bexpocentro\b/i, value: 'Expocentro' },
  { pattern: /\bidtpr\b/i, value: 'IDTPR' },
  { pattern: /\btorion\b/i, value: 'Torion' },
  { pattern: /\bfluxo de caixa\b|\bgov\.br\b|\bdorval\b|\bcontador\b/i, value: 'Administrativo' },
  { pattern: /\bpessoal\b/i, value: 'Pessoal' }
];

const SENSITIVE_ACCESS_WARNING = 'Evite salvar senhas sensíveis diretamente no Clareia. Use um gerenciador seguro ou registre apenas onde o acesso está armazenado.';

function uid(prefix = 'task') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeSpaces(value) {
  return value
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;!?])/g, '$1')
    .trim();
}

function cleanIntro(text) {
  return normalizeSpaces(
    text
      .replace(/^(preciso|tenho que|tenho de|vou|quero|devo|precisamos)\s+/i, '')
      .replace(/^(tamb[eé]m|al[eé]m disso|depois)\s+/i, '')
      .replace(/^e\s+/i, '')
      .replace(/^,\s*/, '')
  );
}

function splitByPunctuation(rawText) {
  return rawText
    .replace(/\r/g, '\n')
    .split(/[\n;]+|(?<=[.!?])\s+/)
    .map(chunk => normalizeSpaces(chunk.replace(/^[-*•]\s*/, '')))
    .filter(chunk => chunk.length > 2);
}

function splitClauseByActions(clause) {
  const cleaned = cleanIntro(clause);
  if (!cleaned) return [];

  const normalized = cleaned
    .replace(/\be\s+precisa\s+ser\s+testad[oa]s?\b/gi, ', testar')
    .replace(/\be\s+deve\s+ser\s+testad[oa]s?\b/gi, ', testar')
    .replace(/\be\s+ser[aá]\s+testad[oa]s?\b/gi, ', testar');

  const splitter = new RegExp(`(?:,|\\be\\b|\\btamb[eé]m\\b|\\be depois\\b)\\s+(?=(?:${VERB_PATTERN})\\b)`, 'gi');
  const parts = normalized.split(splitter).map(part => cleanIntro(part)).filter(Boolean);

  if (parts.length === 0) return [];
  return parts;
}

function normalizeForSignature(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function detectAction(text) {
  const lower = text.toLowerCase();
  const found = ACTION_VERBS.find((verb) => {
    if (verb.includes(' ')) return lower.includes(verb);
    return new RegExp(`\\b${verb}\\b`, 'i').test(lower);
  });
  return found || '';
}

function detectProject(text) {
  const hit = PROJECT_KEYWORDS.find(item => item.pattern.test(text));
  return hit?.value || null;
}

function detectSource(text) {
  if (/\bwhats\s*app\b|\bwhatsapp\b/i.test(text)) return 'WhatsApp';
  if (/\be-?mail\b|\bmensagem de e-?mail\b/i.test(text)) return 'E-mail';
  return 'Texto colado';
}

function hasExplicitContextProjectReference(text) {
  return /(dessa campanha|desse cliente|neste projeto|nesse projeto|deste projeto|dessa conta)/i.test(text);
}

function inferProjectByRules(text, taskType, lastExplicitProject) {
  const directProject = detectProject(text);
  if (directProject) {
    return { project: directProject, explicit: true };
  }

  if (hasExplicitContextProjectReference(text) && lastExplicitProject) {
    return { project: lastExplicitProject, explicit: false };
  }

  if (taskType === 'cobrança' || /(cobran[çc]a|fatura|fluxo de caixa|boleto|nota fiscal)/i.test(text)) {
    return { project: 'Administrativo', explicit: false };
  }

  return { project: '', explicit: false };
}

function detectType(text, action = '') {
  const lower = text.toLowerCase();
  const hasBudgetContext = /(orc?amento|proposta|escopo|condi[cç][oõ]es de pagamento|valores)/i.test(lower);
  const hasApprovalSendContext = /(enviar|encaminhar|compartilhar).*(diretor|aprov)/i.test(lower) || /(diretor|aprov).*(enviar|encaminhar|compartilhar)/i.test(lower);
  const hasSensitiveAccessContext = /(gov\.br|senha|acesso|contador|dorval)/i.test(lower);
  const hasCrmContext = /(\bcrm\b|servidor|aplica[cç][aã]o|logs?)/i.test(lower);
  const hasTestingContext = /(testar|teste|homologa[cç][aã]o|validar)/i.test(lower);
  const hasEventsSiteContext = /(evento|eventos)/i.test(lower) && /(site|publica[cç][aã]o|lan[çc]ar)/i.test(lower);
  const hasBillingContext = /(cobran[çc]a|fatura|fluxo de caixa|boleto|nota fiscal)/i.test(lower);
  const hasInvoiceSendingContext = /(enviar|disparar).*(fatura|cobran[çc]a|boleto|nota fiscal)/i.test(lower);
  const hasFollowUpContext = /(acompanh|avaliar|m[ée]tric|desempenho|efeito|resultado|otimiza|monitor)/i.test(lower);
  const hasCampaignPerformanceContext = /(campanha|ads|an[uú]ncio)/i.test(lower) && /(m[ée]tric|desempenho|efeito|resultado|convers[aã]o|custo|clique)/i.test(lower);
  const hasSiteMonitoringContext = /(monitoramento|monitorar|observabilidade|healthcheck|health check|probe|uptime|disponibilidade|incidente|alerta|status page|statuspage|sla|slo|sli|lat[eê]ncia|latency)/i.test(lower) && /site|sites/.test(lower);
  const hasTechnicalReviewContext = /(analisar|analise|diagn[oó]stic|melhorias?|gargalo|lat[eê]ncia|falha|erro|instabilidade)/i.test(lower);

  if (hasBudgetContext && hasApprovalSendContext) return 'envio/aprovação';
  if (hasBudgetContext) return 'orçamento/proposta';
  if (hasSensitiveAccessContext) return 'acesso sensível';
  if (hasInvoiceSendingContext) return 'fatura/cobrança';
  if (hasBillingContext) return 'cobrança';
  if (hasEventsSiteContext) return 'evento/site';
  if (hasCrmContext && hasTestingContext) return 'teste/sistema';
  if (hasCrmContext) return 'CRM/sistema';
  if (/(falar com|conversar com|entrar em contato|contatar|ligar|enviar mensagem|mandar mensagem|perguntar se|ver se precisam)/i.test(lower)) return 'contato comercial';
  if (/(reuni[aã]o|diretor|apresenta[çc][aã]o|call|alinhamento)/i.test(lower)) return 'reunião';
  if (/\bevento\b/i.test(lower)) return 'evento/site';
  if (hasSiteMonitoringContext && hasTechnicalReviewContext) return 'sistema/CRM';
  if (/\bcrm\b/i.test(lower)) return 'sistema/CRM';
  if ((FOLLOW_UP_VERBS.includes(action) && hasFollowUpContext) || hasCampaignPerformanceContext) return 'acompanhamento';
  if (/(site|p[aá]gina|empreendimento|landing page)/i.test(lower)) return 'site';
  if (/(google ads|campanha|grupo de recursos|an[uú]ncio)/i.test(lower)) return 'Google Ads';
  if (/(sistema|registrar|registro|explicando o que foi feito|hist[oó]rico)/i.test(lower)) return 'registro';

  if (/(falar com|retornar|enviar)/i.test(lower)) return 'administrativo';
  return 'administrativo';
}

function estimateMinutes(type, text) {
  const lower = text.toLowerCase();
  const hasSiteMonitoringContext = /(monitoramento|monitorar|observabilidade|healthcheck|health check|probe|uptime|disponibilidade|incidente|alerta|status page|statuspage|sla|slo|sli|lat[eê]ncia|latency)/i.test(lower) && /site|sites/.test(lower);

  if (type === 'orçamento/proposta') return 55;
  if (type === 'envio/aprovação') return 20;
  if (type === 'fatura/cobrança') return 30;
  if (type === 'acesso sensível') return 25;
  if (type === 'CRM/sistema') return 70;
  if (type === 'teste/sistema') return 55;
  if (type === 'evento/site') return 50;

  if (type === 'contato comercial') {
    if (/(falar com|conversar com|entrar em contato|mandar mensagem|enviar mensagem)/i.test(lower)) {
      return 20;
    }
    return 30;
  }
  if (type === 'site') return 105;
  if (type === 'Google Ads') return 75;
  if (type === 'registro') return 25;
  if (type === 'acompanhamento') return 40;
  if (type === 'cobrança') return 30;
  if (type === 'reunião') return 45;
  if (type === 'sistema/CRM') {
    if (hasSiteMonitoringContext) return 80;
    return 90;
  }
  if (type === 'evento') return 60;

  if (/(criar|lan[çc]ar|preparar)/i.test(lower)) return 75;
  if (/(revisar|atualizar)/i.test(lower)) return 45;
  if (/(avaliar|verificar|olhar|retornar)/i.test(lower)) return 30;
  return 40;
}

function allocateMinutes(total, count) {
  const base = Math.max(5, Math.round(total / count));
  return Array.from({ length: count }, (_, idx) => {
    if (idx === count - 1) {
      return Math.max(5, total - base * (count - 1));
    }
    return base;
  });
}

function createSubtasks(titles, totalMinutes) {
  const distribution = allocateMinutes(totalMinutes, titles.length);
  return titles.map((title, index) => ({
    title,
    estimatedMinutes: distribution[index],
    completed: false
  }));
}

function generateTypedSubtasks(type, text) {
  const lower = text.toLowerCase();

  if (type === 'orçamento/proposta') {
    return [
      'Abrir o orçamento',
      'Conferir escopo',
      'Conferir valores',
      'Conferir prazos',
      'Conferir condições de pagamento',
      'Verificar se falta alguma informação',
      'Ajustar se houver erro',
      'Se estiver correto, preparar envio ao diretor'
    ];
  }

  if (type === 'envio/aprovação') {
    return [
      'Revisar arquivo final',
      'Escrever mensagem curta de envio',
      'Anexar ou compartilhar orçamento',
      'Enviar ao diretor',
      'Registrar envio',
      'Definir lembrete para retorno'
    ];
  }

  if (type === 'fatura/cobrança') {
    return [
      'Gerar faturas pendentes',
      'Conferir dados do cliente',
      'Enviar faturas',
      'Registrar envio',
      'Definir próximo lembrete'
    ];
  }

  if (type === 'acesso sensível') {
    return [
      'Confirmar com Dorval onde está o acesso',
      'Se necessário, orientar recuperação pelo canal oficial do gov.br',
      'Evitar salvar senha em texto puro no sistema',
      'Encaminhar informação ao contador de forma segura',
      'Registrar que o encaminhamento foi feito'
    ];
  }

  if (type === 'CRM/sistema') {
    return [
      'Acessar servidor',
      'Localizar projeto CRM',
      'Verificar se a aplicação está rodando',
      'Verificar logs, se necessário',
      'Testar acesso inicial',
      'Listar o que funciona',
      'Listar pendências técnicas'
    ];
  }

  if (type === 'teste/sistema') {
    return [
      'Testar login',
      'Testar navegação',
      'Testar cadastro/edição de registros',
      'Testar integrações, se houver',
      'Anotar erros encontrados',
      'Definir próximos ajustes'
    ];
  }

  if (type === 'evento/site') {
    return [
      'Verificar fonte/lista de eventos',
      'Conferir se há eventos novos',
      'Separar título, data, local e descrição',
      'Separar imagem, se houver',
      'Cadastrar evento no site',
      'Revisar publicação'
    ];
  }

  if (type === 'contato comercial') {
    const isTorionProspecting = /torion/.test(lower) && /site|crm|precisam de um site|ver se/.test(lower);
    const mentionsCRM = /\bcrm\b/i.test(lower);
    const mentionsSite = /\bsite\b/i.test(lower);

    if (isTorionProspecting) {
      return [
        'Definir o objetivo da conversa',
        'Escrever uma mensagem curta e clara',
        'Explicar que está retomando a estrutura digital da Leone',
        'Mencionar a possibilidade de site integrado ao CRM',
        'Perguntar se isso faz sentido para a Torion',
        'Enviar a mensagem',
        'Registrar o retorno ou próximo follow-up'
      ];
    }

    return [
      'Definir o objetivo da conversa',
      'Escrever uma mensagem curta e clara',
      'Mencionar o motivo do contato',
      mentionsCRM || mentionsSite
        ? 'Perguntar sobre interesse no site integrado ao CRM'
        : 'Perguntar se faz sentido avançar com a proposta',
      'Enviar a mensagem',
      'Registrar o retorno ou próximo follow-up'
    ];
  }

  if (type === 'site') {
    if (/whats\s*app|whatsapp/i.test(lower)) {
      const contactMatch = text.match(/\b(?:o|a)\s+([\p{L}-]+)\s+(?:pediu|solicitou)/iu);
      const contact = contactMatch?.[1] || 'responsável';
      return [
        `Abrir a conversa do ${contact} no WhatsApp e localizar o pedido`,
        'Separar as fotos e os textos mencionados',
        'Abrir a página que será alterada',
        'Aplicar as alterações solicitadas',
        'Revisar no desktop e no celular',
        'Publicar ou enviar para aprovação'
      ];
    }
    return [
      'Separar nome, localização e descrição do empreendimento',
      'Separar imagens e materiais disponíveis',
      'Criar ou editar a página/listagem no site',
      'Revisar layout no desktop',
      'Revisar layout no mobile',
      'Publicar ou deixar pronto para aprovação'
    ];
  }

  if (type === 'Google Ads') {
    if (/grupo de recursos/i.test(lower)) {
      return [
        'Abrir Google Ads',
        'Acessar campanha da Corcril',
        'Criar novo grupo de recursos',
        'Revisar títulos',
        'Revisar descrições',
        'Inserir imagens/recursos',
        'Revisar sinais de público, se necessário',
        'Publicar alterações',
        'Registrar o que foi feito'
      ];
    }

    return [
      'Abrir o Google Ads',
      'Acessar a campanha do cliente',
      'Criar ou revisar o grupo de recursos',
      'Inserir títulos, descrições, imagens e sinais',
      'Conferir se há alertas ou pendências',
      'Publicar alterações'
    ];
  }

  if (type === 'registro') {
    return [
      'Abrir o sistema de registro',
      'Informar a data da alteração',
      'Descrever o que foi alterado',
      'Registrar o objetivo da mudança',
      'Salvar histórico'
    ];
  }

  if (type === 'acompanhamento') {
    return [
      'Abrir métricas da campanha',
      'Comparar impressões, cliques, conversões e custo',
      'Verificar se houve melhora ou queda',
      'Anotar conclusão',
      'Definir se precisa de nova alteração'
    ];
  }

  if (type === 'cobrança') {
    if (/conferir|verificar|filtrar/i.test(lower)) {
      return [
        'Abrir o sistema Fluxo de Caixa',
        'Filtrar cobranças vencidas',
        'Filtrar cobranças próximas do vencimento',
        'Conferir valores',
        'Identificar quais faturas precisam ser enviadas'
      ];
    }

    return [
      'Abrir sistema financeiro ou planilha',
      'Conferir valor e vencimento',
      'Gerar cobrança/fatura',
      'Enviar mensagem ao responsável',
      'Registrar envio e próximo follow-up'
    ];
  }

  if (type === 'reunião') {
    return [
      'Definir objetivo principal da reunião',
      'Organizar pauta e materiais',
      'Confirmar participantes e horário',
      'Conduzir reunião com registro de decisões',
      'Formalizar próximos passos'
    ];
  }

  if (type === 'sistema/CRM' || /\bcrm\b/i.test(lower)) {
    const isSiteMonitoring = /(monitoramento|monitorar|observabilidade|healthcheck|health check|probe|uptime|disponibilidade|incidente|alerta|status page|statuspage|sla|slo|sli|lat[eê]ncia|latency)/i.test(lower) && /site|sites/.test(lower);

    if (isSiteMonitoring) {
      return [
        'Mapear ferramentas de monitoramento, healthchecks e métricas atuais',
        'Revisar regras de alerta, limiares, SLA/SLO e canais de notificação',
        'Analisar histórico de incidentes, indisponibilidade e falsos positivos',
        'Identificar lacunas de cobertura (rotas críticas, SSL, DNS e performance)',
        'Priorizar melhorias por impacto no negócio e esforço técnico',
        'Definir plano de implantação com responsáveis e critérios de sucesso'
      ];
    }

    return [
      'Abrir o CRM/sistema',
      'Localizar registros impactados',
      'Aplicar atualização necessária',
      'Validar dados e consistência',
      'Salvar e comunicar conclusão'
    ];
  }

  if (type === 'evento') {
    return [
      'Consolidar data, horário e local',
      'Organizar materiais necessários',
      'Confirmar envolvidos',
      'Executar checklist de preparação',
      'Registrar pendências finais'
    ];
  }

  return [
    'Definir o resultado esperado',
    'Separar informações e materiais necessários',
    'Executar a atividade principal',
    'Revisar o resultado',
    'Registrar o próximo passo'
  ];
}

function classifyPriority(text, type) {
  const lower = text.toLowerCase();
  const hasCriticalMonitoringSignals = /(incidente|fora do ar|indispon[ií]vel|queda|alerta cr[ií]tico|sla|slo)/i.test(lower);

  if (type === 'orçamento/proposta' || type === 'envio/aprovação' || type === 'cobrança' || type === 'fatura/cobrança') {
    return {
      priority: 'Prioridade alta',
      priorityGroup: 'alta',
      priorityReason: 'Tarefa com impacto direto em aprovação, caixa ou andamento comercial.'
    };
  }

  if (type === 'CRM/sistema') {
    return {
      priority: 'Prioridade alta',
      priorityGroup: 'alta',
      priorityReason: 'Retomada técnica com impacto operacional no projeto.'
    };
  }

  if (type === 'teste/sistema' || type === 'evento/site' || type === 'Google Ads') {
    return {
      priority: 'Prioridade média',
      priorityGroup: 'media',
      priorityReason: 'Execução importante, sem urgência crítica imediata.'
    };
  }

  if (type === 'sistema/CRM' && hasCriticalMonitoringSignals) {
    return {
      priority: 'Prioridade alta',
      priorityGroup: 'alta',
      priorityReason: 'Há sinais críticos de monitoramento e risco operacional em sites.'
    };
  }

  if (type === 'contato comercial') {
    if (/(urgente|hoje|sem falta|atrasad|prazo|venc)/i.test(lower)) {
      return {
        priority: 'Prioridade alta',
        priorityGroup: 'alta',
        priorityReason: 'Contato comercial com sinal de urgência explícita.'
      };
    }

    return {
      priority: 'Prioridade média',
      priorityGroup: 'media',
      priorityReason: 'Oportunidade comercial, mas sem prazo urgente.'
    };
  }

  if (type === 'acompanhamento') {
    return {
      priority: 'Acompanhar depois',
      priorityGroup: 'acompanharDepois',
      priorityReason: 'A tarefa depende de janela de observação antes da próxima decisão.'
    };
  }

  if (/(urgente|hoje|sem falta|atrasad|prazo estourado)/i.test(lower)) {
    return {
      priority: 'Prioridade máxima',
      priorityGroup: 'maxima',
      priorityReason: 'Há urgência explícita e risco de impacto imediato.'
    };
  }

  if (/(amanh[ãa]|esta semana|essa semana|logo|breve|retornar|cobrar|enviar)/i.test(lower)) {
    return {
      priority: 'Prioridade alta',
      priorityGroup: 'alta',
      priorityReason: 'Ajuda a destravar entregas importantes nos próximos dias.'
    };
  }

  if (/(algum dia|quando der|futuro|depois|ideia)/i.test(lower)) {
    return {
      priority: 'Pode esperar',
      priorityGroup: 'podeEsperar',
      priorityReason: 'Não há urgência operacional no momento.'
    };
  }

  return {
    priority: 'Prioridade média',
    priorityGroup: 'media',
    priorityReason: 'Importante para manter o fluxo de execução sem urgência crítica.'
  };
}

function inferEnergy(estimatedMinutes, priorityGroup) {
  if (priorityGroup === 'acompanharDepois') return 'Média';
  if (priorityGroup === 'media' && estimatedMinutes <= 30) return 'Média';
  if (estimatedMinutes >= 90) return 'Alta';
  if (estimatedMinutes <= 30) return 'Baixa';
  return 'Média';
}

function humanWhen(priorityGroup) {
  if (priorityGroup === 'maxima') return 'Hoje';
  if (priorityGroup === 'alta') return 'Próximos dias';
  if (priorityGroup === 'acompanharDepois') return 'Acompanhar em 3 a 7 dias';
  if (priorityGroup === 'podeEsperar') return 'Pode esperar';
  return 'Esta semana';
}

function toDisplayTitle(text) {
  const sanitized = text
    .replace(/descobrir\s+a\s+senha\s+do\s+gov\.br/ig, 'resolver acesso gov.br')
    .replace(/descobrir\s+senha\s+do\s+gov\.br/ig, 'resolver acesso gov.br');
  const cleaned = cleanIntro(sanitized).replace(/[.,;:]$/g, '');
  if (!cleaned) return 'Tarefa sem título';

  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function normalizeEntityNames(text) {
  return normalizeSpaces(
    text
      .replace(/\bgoogle\s*ads\b/gi, 'Google Ads')
      .replace(/\bgoogle\s*ADS\b/g, 'Google Ads')
      .replace(/\bgoogle ads\b/g, 'Google Ads')
      .replace(/\bgov\s*\.\s*br\b/gi, 'gov.br')
      .replace(/\bfluxo\s+de\s+caixa\b/gi, 'Fluxo de Caixa')
      .replace(/\bidtpr\b/gi, 'IDTPR')
      .replace(/\bcrm\b/gi, 'CRM')
      .replace(/\bsistema\s+acesso\b/gi, 'sistema de Acesso')
  );
}

function ensureSentence(text) {
  const cleaned = normalizeSpaces(text).replace(/\s+/g, ' ').trim().replace(/[;:,]+$/, '');
  if (!cleaned) return '';
  const withUpper = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  return /[.!?]$/.test(withUpper) ? withUpper : `${withUpper}.`;
}

function extractProjectAfterDa(text, target) {
  const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`${escaped}\\s+da\\s+([A-Za-zÀ-ÿ0-9_-]+)`, 'i');
  const match = text.match(regex);
  return match?.[1] || null;
}

function updateClarifyContext(line, context) {
  const normalized = normalizeForSignature(line);

  const campaignProject = extractProjectAfterDa(line, 'campanha') || extractProjectAfterDa(line, 'Google Ads');
  if (campaignProject) {
    context.campaignProject = campaignProject;
  }

  const crmProject = extractProjectAfterDa(line, 'CRM');
  if (crmProject) {
    context.crmProject = crmProject;
  }

  if (/fluxo de caixa/i.test(line) || /(fatura|cobranca|cobrança)/i.test(line)) {
    context.financeSystem = /Fluxo de Caixa/i.test(line) ? 'Fluxo de Caixa' : (context.financeSystem || null);
  }

  context.lastLineNormalized = normalized;
}

function enrichClarifiedLine(line, context) {
  const base = normalizeEntityNames(line).replace(/[.!?]+$/g, '').trim();
  if (!base) return '';

  const lower = base.toLowerCase();

  // Evita saídas genéricas sem complemento.
  if (/^(testar|acompanhar|verificar|conferir|enviar|resolver|criar|retomar)$/i.test(base)) {
    if (/^testar$/i.test(base) && context.crmProject) {
      return `Testar o funcionamento do CRM da ${context.crmProject} após retomar o acesso ao servidor`;
    }
    if (/^acompanhar$/i.test(base) && context.campaignProject) {
      return `Acompanhar a campanha da ${context.campaignProject} após a criação do novo grupo de recursos`;
    }
    if (/^enviar$/i.test(base) && context.financeSystem) {
      return `Enviar as faturas pendentes identificadas no ${context.financeSystem}`;
    }
  }

  if (/^acompanhar\s+a\s+campanha\b/i.test(base) && !/campanha\s+da\s+/i.test(base) && context.campaignProject) {
    return `Acompanhar a campanha da ${context.campaignProject} após a criação do novo grupo de recursos`;
  }

  if (/^testar\b/i.test(base)) {
    const hasClearObject = /crm|sistema|funcionamento|integra[cç][aã]o|login|tela/i.test(base);
    if (!hasClearObject && context.crmProject) {
      return `Testar o funcionamento do CRM da ${context.crmProject}`;
    }
    if (/^testar\s+o?\s*funcionamento\s+do\s+crm\b/i.test(base) && context.crmProject && !/crm\s+da\s+/i.test(base)) {
      return `Testar o funcionamento do CRM da ${context.crmProject}`;
    }
  }

  if (/^retomar\s+o?\s*crm\b/i.test(base) && /servidor/i.test(base) && /da\s+[A-Za-zÀ-ÿ0-9_-]+/i.test(base)) {
    return base;
  }

  if (/^enviar\s+as\s+faturas\b/i.test(base) && !/fluxo de caixa/i.test(base) && context.financeSystem) {
    return `Enviar as faturas pendentes identificadas no ${context.financeSystem}`;
  }

  if (/^conferir\b.*cobran[çc]a/i.test(base) && !/fluxo de caixa/i.test(base) && context.financeSystem) {
    return `Conferir se existem cobranças pendentes no sistema ${context.financeSystem}`;
  }

  // Completa verbos de continuidade com contexto anterior.
  if (/^(acompanhar|avaliar|verificar|conferir|enviar)\b/i.test(base)) {
    if (/campanha/i.test(base) && context.campaignProject && !/da\s+[A-Za-zÀ-ÿ0-9_-]+/i.test(base)) {
      return `${base.replace(/campanha/i, `campanha da ${context.campaignProject}`)} após a criação do novo grupo de recursos`;
    }
  }

  return base;
}

export function generateClarifiedText(rawText) {
  if (!rawText || !rawText.trim()) return '';

  const normalizedInput = normalizeEntityNames(rawText.replace(/\r/g, '\n'));
  const clauses = splitByPunctuation(normalizedInput);
  const actionChunks = clauses.flatMap(splitClauseByActions).filter(Boolean);
  const chunks = actionChunks.length > 0 ? actionChunks : clauses;

  const expanded = chunks
    .flatMap(expandConditionalTasks)
    .map((entry) => normalizeEntityNames(entry?.forcedTitle || entry?.text || ''))
    .filter(Boolean);

  const context = {
    campaignProject: null,
    crmProject: null,
    financeSystem: null,
    lastLineNormalized: null
  };

  const enriched = expanded
    .map((line) => enrichClarifiedLine(line, context))
    .map((line) => ensureSentence(line))
    .filter(Boolean)
    .filter((line) => !/^(Testar|Acompanhar|Verificar|Conferir|Enviar|Resolver|Criar|Retomar)\.$/.test(line))
    .map((line) => {
      updateClarifyContext(line, context);
      return line;
    });

  const deduped = [];
  const seen = new Set();

  enriched.forEach((line) => {
    const signature = normalizeForSignature(line);
    if (!signature || seen.has(signature)) return;
    seen.add(signature);
    deduped.push(line);
  });

  if (deduped.length === 0) {
    return ensureSentence(normalizeEntityNames(rawText));
  }

  const numbered = deduped.map((line, index) => `${index + 1}. ${line}`);
  return `Preciso organizar as seguintes pendências:\n\n${numbered.join('\n')}`;
}

function expandConditionalTasks(chunk) {
  const hasCrmRetakeAndTest = /(retomar|reanudar)/i.test(chunk)
    && /(crm|servidor)/i.test(chunk)
    && /(testad[oa]|testar|teste)/i.test(chunk);

  if (hasCrmRetakeAndTest) {
    const project = detectProject(chunk) || 'Leone';
    return [
      {
        text: `retomar CRM da ${project} no servidor`,
        forcedType: 'CRM/sistema',
        forcedTitle: `Retomar CRM da ${project} no servidor`
      },
      {
        text: `testar CRM da ${project}`,
        forcedType: 'teste/sistema',
        forcedTitle: `Testar CRM da ${project}`
      }
    ];
  }

  const hasConditionalSend = /(se estiver correto|caso esteja ok|se aprovado)/i.test(chunk)
    && /(enviar|encaminhar|compartilhar)/i.test(chunk)
    && /(orc?amento|proposta)/i.test(chunk);

  if (!hasConditionalSend) {
    return [{ text: chunk }];
  }

  const project = detectProject(chunk) || 'Expocentro';

  return [
    {
      text: `analisar orçamento do ${project}`,
      forcedType: 'orçamento/proposta',
      forcedTitle: `Analisar orçamento do ${project}`,
      dependencyLabel: null
    },
    {
      text: `enviar orçamento ao diretor do ${project}, se estiver correto`,
      forcedType: 'envio/aprovação',
      forcedTitle: `Enviar orçamento ao diretor do ${project}, se estiver correto`,
      dependencyLabel: 'Depende de orçamento aprovado/correto.'
    }
  ];
}

export function normalizeTaskTypeForTaskCollection(taskType) {
  const normalized = (taskType || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  if (normalized === 'cobranca') return 'Cobrança';
  if (normalized === 'reuniao') return 'Reunião';
  if (normalized === 'desenvolvimento') return 'Desenvolvimento';
  if (normalized === 'site') return 'Site';
  if (normalized === 'google ads') return 'Google Ads';
  if (normalized === 'fatura cobranca') return 'Cobrança';
  if (normalized === 'orcamento proposta') return 'Administrativo';
  if (normalized === 'envio aprovacao') return 'Administrativo';
  if (normalized === 'acesso sensivel') return 'Administrativo';
  if (normalized === 'evento site') return 'Site';
  if (normalized === 'crm sistema' || normalized === 'teste sistema') return 'Desenvolvimento';
  if (normalized === 'contato comercial' || normalized === 'contato') return 'Atendimento';
  if (normalized === 'atendimento') return 'Atendimento';
  if (normalized === 'administrativo') return 'Administrativo';
  if (normalized === 'pessoal') return 'Pessoal';

  if (normalized === 'registro') return 'Administrativo';
  if (normalized === 'acompanhamento') return 'Administrativo';
  if (normalized === 'sistema/crm' || normalized === 'sistema crm') return 'Desenvolvimento';
  if (normalized === 'evento') return 'Administrativo';

  return 'Administrativo';
}

export function parseBrainDumpToTasks(inputText) {
  if (!inputText || !inputText.trim()) return [];

  const clauses = splitByPunctuation(inputText);
  const actionChunks = clauses.flatMap(splitClauseByActions).filter(Boolean);

  if (actionChunks.length === 0) return [];

  const parsed = [];
  let lastExplicitProject = null;

  actionChunks.forEach((chunk) => {
    const expandedChunks = expandConditionalTasks(chunk);

    expandedChunks.forEach((entry) => {
      const rawChunk = entry.text;
      const action = detectAction(rawChunk);
      const taskType = entry.forcedType || detectType(rawChunk, action);
      const projectResult = inferProjectByRules(rawChunk, taskType, lastExplicitProject);
    const inferredProject = projectResult.project;
    if (projectResult.explicit) {
      lastExplicitProject = inferredProject;
    }

    const estimatedMinutes = estimateMinutes(taskType, rawChunk);
    const { priority, priorityGroup, priorityReason } = classifyPriority(rawChunk, taskType);
    const subtasks = createSubtasks(generateTypedSubtasks(taskType, rawChunk), estimatedMinutes);
    const schedule = suggestTaskSchedule({
      taskText: rawChunk,
      taskType,
      project: inferredProject,
      estimatedMinutes,
      energyRequired: inferEnergy(estimatedMinutes, priorityGroup),
      isFollowUp: priorityGroup === 'acompanharDepois',
      priority: priorityGroup === 'maxima' ? 'alta' : (priorityGroup === 'podeEsperar' ? 'baixa' : 'média')
    });

    let firstStep = subtasks[0]?.title || 'Definir o primeiro passo prático';
    if (taskType === 'contato comercial') {
      firstStep = /\bcrm\b|\bsite\b/i.test(rawChunk)
        ? 'Escrever uma mensagem objetiva para perguntar sobre interesse em um site integrado ao CRM.'
        : 'Escrever uma mensagem objetiva para iniciar a conversa';
    }

    if (taskType === 'acesso sensível') {
      firstStep = 'Confirmar com Dorval onde está o acesso ou se será necessário recuperar';
    }

    parsed.push({
      title: entry.forcedTitle || toDisplayTitle(rawChunk),
      originalText: rawChunk,
      sourceType: detectSource(rawChunk),
      project: inferredProject || '',
      type: taskType,
      objective: `Concluir "${entry.forcedTitle || toDisplayTitle(rawChunk)}" com clareza e registro dos próximos passos.`,
      priority,
      priorityGroup,
      priorityReason,
      estimatedMinutes,
      dueDate: schedule.dueDate,
      scheduledDate: schedule.scheduledDate,
      scheduledPeriod: schedule.scheduledPeriod,
      scheduledLabel: schedule.scheduledLabel,
      isBusinessTask: schedule.isBusinessTask,
      isClientTask: schedule.isClientTask,
      suggestedExecutionDate: schedule.scheduledDate,
      suggestedPeriod: schedule.scheduledPeriod,
      firstStep,
      subtasks,
      warning: taskType === 'acesso sensível' ? SENSITIVE_ACCESS_WARNING : null,
      dependencyLabel: entry.dependencyLabel || null
    });
    });
  });

  // Merge consecutive follow-up fragments (ex.: "acompanhar ... e avaliar ...")
  const merged = [];
  parsed.forEach((task) => {
    const currentAction = detectAction(task.title);
    const previous = merged[merged.length - 1];
    const previousAction = previous ? detectAction(previous.title) : '';

    const shouldMergeFollowUp =
      previous &&
      FOLLOW_UP_VERBS.includes(currentAction) &&
      FOLLOW_UP_VERBS.includes(previousAction) &&
      previous.project === task.project;

    if (shouldMergeFollowUp) {
      previous.title = `${previous.title} e ${task.title.charAt(0).toLowerCase()}${task.title.slice(1)}`;
      previous.subtasks = [...previous.subtasks, ...task.subtasks].slice(0, 8);
      previous.estimatedMinutes = Math.min(120, previous.estimatedMinutes + Math.round(task.estimatedMinutes * 0.6));
      previous.firstStep = previous.subtasks[0]?.title || previous.firstStep;
      previous.scheduledLabel = task.scheduledLabel || previous.scheduledLabel;
      return;
    }

    merged.push(task);
  });

  // Deduplicate similar tasks to avoid repeated cards
  const seen = new Set();
  const unique = [];

  merged.forEach((task) => {
    const signature = `${normalizeForSignature(task.title)}|${task.project}|${task.type}`;
    if (seen.has(signature)) return;
    seen.add(signature);
    unique.push(task);
  });

  return unique;
}

export function hasActionableCapture(inputText) {
  return splitByPunctuation(String(inputText || ''))
    .flatMap(splitClauseByActions)
    .some((chunk) => Boolean(detectAction(chunk)));
}

export function parseUnloadMindToPlan(rawText) {
  const parsedTasks = parseBrainDumpToTasks(rawText);
  if (!parsedTasks || parsedTasks.length === 0) return null;

  const plan = {
    maxima: [],
    alta: [],
    media: [],
    podeEsperar: [],
    acompanharDepois: [],
    baixa: []
  };

  parsedTasks.forEach((task) => {
    const priorityGroup = task.priorityGroup || 'media';
    const convertedTask = {
      id: uid('plan-task'),
      title: task.title,
      originalText: task.originalText || task.title,
      sourceType: task.sourceType || detectSource(rawText),
      taskType: task.type,
      project: task.project,
      timeEstimate: task.estimatedMinutes,
      motivo: task.priorityReason,
      objetivo: task.objective,
      microtarefas: task.subtasks.map((subtask) => ({
        id: uid('micro'),
        descricao: subtask.title,
        status: subtask.completed ? 'concluída' : 'não iniciada',
        estimatedMinutes: subtask.estimatedMinutes
      })),
      quandoFazer: task.scheduledLabel || humanWhen(priorityGroup),
      dataSugeridaExecucao: task.suggestedExecutionDate || '',
      periodoSugerido: task.suggestedPeriod || 'tarde',
      scheduledDate: task.scheduledDate || task.suggestedExecutionDate || '',
      scheduledPeriod: task.scheduledPeriod || task.suggestedPeriod || 'tarde',
      scheduledLabel: task.scheduledLabel || humanWhen(priorityGroup),
      energiaNecessaria: inferEnergy(task.estimatedMinutes, priorityGroup),
      observacoes: task.warning || task.dependencyLabel || 'Gerado automaticamente do seu descarregamento.',
      priorityGroup,
      priority: task.priority,
      dueDate: task.dueDate,
      firstStep: task.firstStep,
      isBusinessTask: Boolean(task.isBusinessTask),
      isClientTask: Boolean(task.isClientTask)
    };

    if (priorityGroup === 'maxima') plan.maxima.push(convertedTask);
    else if (priorityGroup === 'alta') plan.alta.push(convertedTask);
    else if (priorityGroup === 'podeEsperar') plan.podeEsperar.push(convertedTask);
    else if (priorityGroup === 'acompanharDepois') plan.acompanharDepois.push(convertedTask);
    else plan.media.push(convertedTask);
  });

  // Backward compatibility with existing screens that still expect "baixa"
  plan.baixa = [...plan.podeEsperar];

  return plan;
}

function availableMinutesFromPreference(value) {
  const normalized = String(value || '').toLocaleLowerCase('pt-BR');
  if (normalized === '30min' || normalized === '30 min') return 30;
  if (normalized === '1h') return 60;
  if (normalized === '2h') return 120;
  if (normalized === '4h') return 240;
  return 120;
}

export function applyPlanningPreferences(plan, preferences = {}) {
  if (!plan) return null;
  const detailLimit = preferences.microtaskDetail === 'poucos'
    ? 3
    : preferences.microtaskDetail === 'detalhado' ? 7 : 5;
  const comfortableDuration = Math.max(5, Number(preferences.comfortableDuration || 30));
  const maxDailyPriorities = Math.max(1, Number(preferences.maxDailyPriorities || 3));
  const availableMinutes = availableMinutesFromPreference(preferences.availableTime);
  const preferredPeriods = Array.isArray(preferences.preferredPeriods) && preferences.preferredPeriods.length
    ? preferences.preferredPeriods
    : ['Manhã', 'Tarde'];
  const groupKeys = ['maxima', 'alta', 'media', 'podeEsperar', 'acompanharDepois'];

  const next = { ...plan };
  groupKeys.forEach((key) => {
    next[key] = (plan[key] || []).map((task) => {
      const scheduledPeriod = preferredPeriods.some((period) => normalizeForSignature(period) === normalizeForSignature(task.scheduledPeriod))
        ? task.scheduledPeriod
        : preferredPeriods[0];
      return {
        ...task,
        scheduledPeriod,
        periodoSugerido: scheduledPeriod,
        focusBlockMinutes: Math.min(Number(task.timeEstimate || comfortableDuration), comfortableDuration),
        microtarefas: (task.microtarefas || []).slice(0, detailLimit),
      };
    });
  });
  next.baixa = [...next.podeEsperar];

  const allTasks = groupKeys.flatMap((key) => next[key]);
  const todayTasks = allTasks.filter((task) => task.scheduledDate && task.scheduledDate === toIsoDate(new Date()));
  const todayMinutes = todayTasks.reduce((sum, task) => sum + Number(task.timeEstimate || 0), 0);
  const warnings = [];
  if (todayTasks.length > maxDailyPriorities) warnings.push(`Há ${todayTasks.length} prioridades previstas para hoje; sua preferência é ${maxDailyPriorities}.`);
  if (todayMinutes > availableMinutes) warnings.push(`O plano prevê ${todayMinutes} minutos hoje para ${availableMinutes} minutos normalmente disponíveis.`);

  next.meta = {
    ...(plan.meta || {}),
    preferencesApplied: { comfortableDuration, maxDailyPriorities, microtaskDetail: preferences.microtaskDetail || 'equilibrado', availableMinutes, preferredPeriods },
    planningWarnings: warnings,
  };
  return next;
}
