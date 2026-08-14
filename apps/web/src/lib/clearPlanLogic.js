
import { getTaskSteps } from './breakTaskRules.js';
import { suggestTaskType, suggestProject, suggestTimeEstimate } from './autoSuggestions.js';

export function generateClearPlan(text) {
  if (!text || !text.trim()) return null;

  // 1. Parse text into potential tasks
  // Split by newlines, filter out empty lines or very short lines
  const lines = text.split('\n')
    .map(l => l.trim().replace(/^[-*•]\s*/, '')) // remove bullet points
    .filter(l => l.length > 5);

  const plan = {
    maxima: [],
    alta: [],
    media: [],
    baixa: []
  };

  // 2. Process each line
  lines.forEach(line => {
    const lowerLine = line.toLowerCase();
    
    // Determine priority
    let priority = 'media';
    if (lowerLine.includes('urgente') || lowerLine.includes('hoje') || lowerLine.includes('amanhã') || lowerLine.includes('atrasad')) {
      priority = 'maxima';
    } else if (lowerLine.includes('semana') || lowerLine.includes('logo') || lowerLine.includes('breve')) {
      priority = 'alta';
    } else if (lowerLine.includes('mês') || lowerLine.includes('depois') || lowerLine.includes('algum dia') || lowerLine.includes('ideia')) {
      priority = 'baixa';
    }

    // Determine type and project
    const taskType = suggestTaskType(line);
    const project = suggestProject(line);
    const timeEstimate = suggestTimeEstimate(line);
    const steps = getTaskSteps(taskType, line);

    // Generate explanations
    let importance = 'Importante para manter o fluxo de trabalho organizado.';
    if (priority === 'maxima') importance = 'Requer sua atenção imediata para evitar gargalos ou problemas maiores.';
    if (priority === 'alta') importance = 'Essencial para o progresso da semana. Bom adiantar logo.';
    if (priority === 'baixa') importance = 'Pode ser feito com calma, sem pressa.';

    const taskObj = {
      id: Date.now() + Math.random().toString(36).substr(2, 9),
      originalText: line,
      title: line.length > 60 ? line.substring(0, 60) + '...' : line,
      taskType,
      project,
      timeEstimate,
      importance,
      objective: `Resolver a pendência relacionada a ${taskType.toLowerCase()} de forma tranquila.`,
      steps,
      priorityLevel: priority
    };

    plan[priority].push(taskObj);
  });

  return plan;
}
