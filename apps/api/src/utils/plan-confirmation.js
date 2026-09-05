export function getInvalidPlanTaskIndexes(tasks) {
  if (!Array.isArray(tasks)) return [];
  return tasks.reduce((invalidIndexes, task, index) => {
    if (!String(task?.title || '').trim()) invalidIndexes.push(index);
    return invalidIndexes;
  }, []);
}