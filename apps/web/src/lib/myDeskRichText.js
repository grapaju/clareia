function normalizeLineBreaks(value) {
  return String(value || '').replace(/\r\n?/g, '\n');
}

export function isRichNote(note) {
  return String(note?.contentFormat || '').toLowerCase() === 'richtext';
}

export function getStoredNoteContent(note) {
  return normalizeLineBreaks(note?.content || '');
}

export function toEditableNoteContent(note) {
  return getStoredNoteContent(note);
}

export function serializeRichNoteContent(value) {
  return {
    contentFormat: 'richtext',
    content: normalizeLineBreaks(value).slice(0, 20000),
  };
}

function parseInline(text) {
  const source = String(text || '');
  const tokens = [];
  let index = 0;

  const pattern = /(\[[^\]]+\]\((https:\/\/[^\s)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*|_([^_]+)_|~~([^~]+)~~|`([^`]+)`)/g;
  let match = pattern.exec(source);

  while (match) {
    if (match.index > index) {
      tokens.push({ type: 'text', value: source.slice(index, match.index) });
    }

    if (match[2]) {
      tokens.push({ type: 'link', text: match[1].slice(1, match[1].indexOf(']')), href: match[2] });
    } else if (match[3]) {
      tokens.push({ type: 'bold', value: match[3] });
    } else if (match[4]) {
      tokens.push({ type: 'italic', value: match[4] });
    } else if (match[5]) {
      tokens.push({ type: 'italic', value: match[5] });
    } else if (match[6]) {
      tokens.push({ type: 'strike', value: match[6] });
    } else if (match[7]) {
      tokens.push({ type: 'code', value: match[7] });
    }

    index = pattern.lastIndex;
    match = pattern.exec(source);
  }

  if (index < source.length) tokens.push({ type: 'text', value: source.slice(index) });
  return tokens;
}

function pushParagraph(blocks, line) {
  blocks.push({ type: 'paragraph', tokens: parseInline(line) });
}

export function parseRichTextBlocks(rawValue, { forcePlain = false } = {}) {
  const content = normalizeLineBreaks(rawValue);
  if (!content) return [];
  const lines = content.split('\n');
  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!forcePlain) {
      const checklist = line.match(/^\s*[-*]\s+\[( |x|X)\]\s+(.+)$/);
      if (checklist) {
        const items = [];
        while (index < lines.length) {
          const current = lines[index].match(/^\s*[-*]\s+\[( |x|X)\]\s+(.+)$/);
          if (!current) break;
          items.push({ checked: current[1].toLowerCase() === 'x', tokens: parseInline(current[2]) });
          index += 1;
        }
        blocks.push({ type: 'checklist', items });
        continue;
      }

      const bullet = line.match(/^\s*[-*]\s+(.+)$/);
      if (bullet) {
        const items = [];
        while (index < lines.length) {
          const current = lines[index].match(/^\s*[-*]\s+(.+)$/);
          if (!current || /^\s*[-*]\s+\[( |x|X)\]/.test(lines[index])) break;
          items.push({ tokens: parseInline(current[1]) });
          index += 1;
        }
        blocks.push({ type: 'unordered', items });
        continue;
      }

      const numbered = line.match(/^\s*\d+\.\s+(.+)$/);
      if (numbered) {
        const items = [];
        while (index < lines.length) {
          const current = lines[index].match(/^\s*(\d+)\.\s+(.+)$/);
          if (!current) break;
          items.push({ number: Number(current[1]), tokens: parseInline(current[2]) });
          index += 1;
        }
        blocks.push({ type: 'ordered', items });
        continue;
      }
    }

    if (!line.trim()) {
      blocks.push({ type: 'space' });
      index += 1;
      continue;
    }

    pushParagraph(blocks, line);
    index += 1;
  }

  return blocks;
}

export function richTextToPlainText(rawValue) {
  const content = normalizeLineBreaks(rawValue);
  if (!content) return '';
  return content
    .replace(/^\s*[-*]\s+\[( |x|X)\]\s+/gm, '')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
}

export function toggleChecklistLine(rawValue, checklistIndex) {
  const lines = normalizeLineBreaks(rawValue).split('\n');
  let seen = -1;
  const next = lines.map((line) => {
    const match = line.match(/^(\s*[-*]\s+\[)( |x|X)(\]\s+.+)$/);
    if (!match) return line;
    seen += 1;
    if (seen !== checklistIndex) return line;
    const toggled = match[2].toLowerCase() === 'x' ? ' ' : 'x';
    return `${match[1]}${toggled}${match[3]}`;
  });
  return next.join('\n');
}

export function applyWrapFormat(text, selectionStart, selectionEnd, marker, placeholder = 'texto') {
  const raw = normalizeLineBreaks(text);
  const start = Math.max(0, Number(selectionStart || 0));
  const end = Math.max(start, Number(selectionEnd || start));
  const chosen = raw.slice(start, end) || placeholder;
  const wrapped = `${marker}${chosen}${marker}`;
  return {
    value: `${raw.slice(0, start)}${wrapped}${raw.slice(end)}`,
    selectionStart: start + marker.length,
    selectionEnd: start + marker.length + chosen.length,
  };
}

export function applyPrefixList(text, selectionStart, selectionEnd, mode = 'bullet') {
  const raw = normalizeLineBreaks(text);
  const start = Math.max(0, Number(selectionStart || 0));
  const end = Math.max(start, Number(selectionEnd || start));

  const blockStart = raw.lastIndexOf('\n', start - 1) + 1;
  const blockEndRaw = raw.indexOf('\n', end);
  const blockEnd = blockEndRaw === -1 ? raw.length : blockEndRaw;

  const block = raw.slice(blockStart, blockEnd);
  const lines = block.split('\n');

  const transformed = lines.map((line, index) => {
    const clean = line.replace(/^\s*([-*]\s+\[( |x|X)\]\s+|[-*]\s+|\d+\.\s+)/, '');
    if (mode === 'check') return `- [ ] ${clean || 'item'}`;
    if (mode === 'ordered') return `${index + 1}. ${clean || 'item'}`;
    return `- ${clean || 'item'}`;
  }).join('\n');

  return {
    value: `${raw.slice(0, blockStart)}${transformed}${raw.slice(blockEnd)}`,
    selectionStart: blockStart,
    selectionEnd: blockStart + transformed.length,
  };
}

export function applyLinkFormat(text, selectionStart, selectionEnd) {
  const raw = normalizeLineBreaks(text);
  const start = Math.max(0, Number(selectionStart || 0));
  const end = Math.max(start, Number(selectionEnd || start));
  const chosen = raw.slice(start, end) || 'link';
  const wrapped = `[${chosen}](https://)`;
  return {
    value: `${raw.slice(0, start)}${wrapped}${raw.slice(end)}`,
    selectionStart: start + chosen.length + 3,
    selectionEnd: start + chosen.length + 11,
  };
}

export function applyEmoji(text, selectionStart, selectionEnd, emoji = '🙂') {
  const raw = normalizeLineBreaks(text);
  const start = Math.max(0, Number(selectionStart || 0));
  const end = Math.max(start, Number(selectionEnd || start));
  const insert = ` ${emoji}`;
  return {
    value: `${raw.slice(0, start)}${insert}${raw.slice(end)}`,
    selectionStart: start + insert.length,
    selectionEnd: start + insert.length,
  };
}
