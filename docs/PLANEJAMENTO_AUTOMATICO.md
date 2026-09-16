# Planejamento automático

## Datas de tarefa

- `created`/`createdAt`: instante de criação, fornecido pela tabela `tasks`.
- `dueDate`: prazo real. Permanece vazio quando não existe vencimento explícito.
- `scheduledDate`: dia sugerido para execução. Pode ser alterado sem modificar `dueDate`.
- `dataLimite` e `dataSugeridaExecucao`: aliases legados aceitos apenas para compatibilidade.

As tarefas são armazenadas em `tasks.data` (JSONB), portanto não há coluna nova nem migration destrutiva. A API normaliza os aliases ao ler e gravar: um valor legado só preenche o campo canônico correspondente. Nunca converte prazo em agendamento nem usa `created_at` como data de execução.

## Capacidade e distribuição

O motor em `apps/web/src/lib/planningEngine.js` usa 85% dos minutos disponíveis. Compromissos fixos consomem essa capacidade e não são movidos. Tarefas profissionais respeitam os dias úteis configurados; tarefas manuais, concluídas, fixas ou aguardando retorno não são replanejadas.

O encaixe prioriza prazo, prioridade explícita, tarefa iniciada e dependências. Duração, energia, projeto, criação e tarefas pessoais sem prazo atuam como critérios secundários. Se não houver espaço antes de `dueDate`, a tarefa recebe `deadlineRisk` e permanece sem agendamento silenciosamente inválido.

Tarefas abertas cuja data planejada passou são movidas para o próximo espaço válido uma vez por dia. O processo atualiza a mesma tarefa e as mesmas microtarefas; não cria cópias.