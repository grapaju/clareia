import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyEmoji,
  applyLinkFormat,
  applyPrefixList,
  applyWrapFormat,
  parseRichTextBlocks,
  richTextToPlainText,
  serializeRichNoteContent,
  toggleChecklistLine,
} from './myDeskRichText.js';

test('serializa conteudo rico com formato seguro', () => {
  const output = serializeRichNoteContent('**Oi**');
  assert.equal(output.contentFormat, 'richtext');
  assert.equal(output.content, '**Oi**');
});

test('parse renderiza checklist, listas e links sem html', () => {
  const blocks = parseRichTextBlocks('- [ ] item 1\n- [x] item 2\n\n- bullet\n1. passo\n[site](https://clareia.com)');
  assert.equal(blocks[0].type, 'checklist');
  assert.equal(blocks[0].items.length, 2);
  assert.equal(blocks[1].type, 'space');
  assert.equal(blocks[2].type, 'unordered');
  assert.equal(blocks[3].type, 'ordered');
  assert.equal(blocks[4].type, 'paragraph');
  assert.equal(blocks[4].tokens[0].type, 'link');
});

test('toggle de checklist alterna estado do item correto', () => {
  const text = '- [ ] item 1\n- [x] item 2';
  const toggled = toggleChecklistLine(text, 1);
  assert.equal(toggled, '- [ ] item 1\n- [ ] item 2');
});

test('compatibilidade com nota antiga em texto puro', () => {
  const plain = 'Texto sem formato';
  const blocks = parseRichTextBlocks(plain, { forcePlain: true });
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, 'paragraph');
  assert.equal(richTextToPlainText(plain), 'Texto sem formato');
});

test('atalhos de toolbar formatam selecao', () => {
  const bold = applyWrapFormat('abc', 0, 3, '**');
  assert.equal(bold.value, '**abc**');

  const ordered = applyPrefixList('linha 1\nlinha 2', 0, 13, 'ordered');
  assert.equal(ordered.value, '1. linha 1\n2. linha 2');

  const link = applyLinkFormat('clareia', 0, 7);
  assert.equal(link.value, '[clareia](https://)');

  const emoji = applyEmoji('hello', 5, 5, '🙂');
  assert.equal(emoji.value, 'hello 🙂');
});
