function durationMinutes(session) {
  return Math.max(0, Number(session?.durationMinutes || 0));
}

export function buildTaskTimeReport(sessions = []) {
  const byProject = new Map();
  const byTask = new Map();

  sessions.forEach((session) => {
    const minutes = durationMinutes(session);
    const project = String(session?.projectId || 'Pessoal').trim() || 'Pessoal';
    const projectEntry = byProject.get(project) || { project, minutes: 0, sessions: 0 };
    projectEntry.minutes += minutes;
    projectEntry.sessions += 1;
    byProject.set(project, projectEntry);

    if (!session?.taskId) return;
    const taskEntry = byTask.get(session.taskId) || {
      taskId: session.taskId,
      taskTitle: session.taskTitle || session.title || 'Tarefa',
      project,
      minutes: 0,
      sessions: 0,
    };
    taskEntry.minutes += minutes;
    taskEntry.sessions += 1;
    byTask.set(session.taskId, taskEntry);
  });

  return {
    taskTrackedTime: sessions.reduce((total, session) => total + durationMinutes(session), 0),
    sessionCount: sessions.length,
    byProject: [...byProject.values()].sort((left, right) => right.minutes - left.minutes),
    byTask: [...byTask.values()].sort((left, right) => right.minutes - left.minutes),
  };
}