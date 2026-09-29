function snap(value, grid) {
  return Math.round(value / grid) * grid;
}

export function computeContextMenuPosition({
  anchorX,
  anchorY,
  menuWidth = 220,
  menuHeight = 280,
  viewportWidth = 1280,
  viewportHeight = 720,
  padding = 8,
}) {
  const maxX = Math.max(padding, viewportWidth - menuWidth - padding);
  const maxY = Math.max(padding, viewportHeight - menuHeight - padding);
  return {
    x: Math.min(Math.max(anchorX, padding), maxX),
    y: Math.min(Math.max(anchorY, padding), maxY),
  };
}

function itemFootprint(itemType = 'shortcut') {
  if (itemType === 'note') return { w: 304, h: 224 };
  return { w: 108, h: 118 };
}

export function findNextAvailableSlot(items = [], {
  itemType = 'shortcut',
  startX = 20,
  startY = 24,
  maxWidth = 1280,
  grid = 16,
} = {}) {
  const spacing = itemType === 'note'
    ? { x: 316, y: 236 }
    : { x: 120, y: 130 };
  const footprint = itemFootprint(itemType);
  const columns = Math.max(1, Math.floor((Math.max(420, maxWidth) - startX) / spacing.x));

  const occupied = items.map((item) => ({
    x: Number(item.x || 0),
    y: Number(item.y || 0),
    ...itemFootprint(item.type),
  }));

  const collides = (x, y) => occupied.some((slot) => {
    return !(x + footprint.w < slot.x || slot.x + slot.w < x || y + footprint.h < slot.y || slot.y + slot.h < y);
  });

  for (let row = 0; row < 200; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x = snap(startX + column * spacing.x, grid);
      const y = snap(startY + row * spacing.y, grid);
      if (!collides(x, y)) return { x, y };
    }
  }

  return { x: snap(startX, grid), y: snap(startY + 240, grid) };
}

export function resolveProjectContext(currentFolder, projects = []) {
  const folder = String(currentFolder || '').trim();
  if (!folder) return { projectId: '', projectName: '' };
  const match = projects.find((project) => String(project?.name || '').trim() === folder);
  if (!match) return { projectId: '', projectName: folder };
  return { projectId: Number(match.id), projectName: match.name };
}

export function addMenuEntries(currentFolder) {
  const inProject = Boolean(String(currentFolder || '').trim());
  if (!inProject) {
    return [
      { id: 'note', label: 'Nota' },
      { id: 'link', label: 'Link' },
      { id: 'file', label: 'Arquivo' },
      { id: 'project', label: 'Pasta' },
    ];
  }

  return [
    { id: 'note', label: 'Nota neste projeto' },
    { id: 'link', label: 'Link neste projeto' },
    { id: 'file', label: 'Arquivo neste projeto' },
    { id: 'project-material', label: 'Material do projeto' },
  ];
}
