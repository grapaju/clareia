import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Archive,
  ArrowLeft,
  Bold,
  Clock3,
  Check,
  CheckSquare,
  File,
  FileImage,
  FileSpreadsheet,
  FileText,
  Folder,
  Globe,
  Italic,
  Link2,
  List,
  ListOrdered,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Smile,
  StickyNote,
  Strikethrough,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import TaskSessionBar from '@/components/TaskSessionBar.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useTaskContext } from '@/hooks/useTaskContext.js';
import { getCurrentAccountId } from '@/lib/apiClient.js';
import {
  addMenuEntries,
  computeContextMenuPosition,
  findNextAvailableSlot,
  resolveProjectContext,
} from '@/lib/myDeskDesktopLogic.js';
import {
  applyEmoji,
  applyLinkFormat,
  applyPrefixList,
  applyWrapFormat,
  parseRichTextBlocks,
  richTextToPlainText,
  serializeRichNoteContent,
  toggleChecklistLine,
} from '@/lib/myDeskRichText.js';
import {
  hasMeaningfulNoteContent,
  makeDraftNote,
  shouldStartDrag,
  toDraftPersistPayload,
} from '@/lib/myDeskNoteDraftLogic.js';
import { createUnsortedNote } from '@/lib/unsortedNotesStorage.js';
import {
  archiveDeskItem,
  createDeskItem,
  deleteDeskItem,
  flushDeskItemUpdates,
  listArchivedDeskItems,
  listDeskItems,
  queueDeskItemUpdate,
  restoreDeskItem,
  unarchiveDeskItem,
} from '@/services/deskItemsService.js';
import { getGoogleDriveProjectFolderConfig } from '@/services/googleDriveIntegrationService.js';
import { getPlanProjectContext } from '@/services/plansApiService.js';
import { deleteProjectFile, listProjectFiles } from '@/services/projectFileService.js';
import { deleteProjectLink, listProjectLinks } from '@/services/projectLinkService.js';
import { subscribeToProjectMaterials } from '@/services/projectMaterialOrganizationService.js';
import { createProjectNote, deleteProjectNote, listProjectNotes, updateProjectNote } from '@/services/projectNoteService.js';
import { createOrReusePlanDraft } from '@/services/planDraftService.js';
import { listProjectProfilesApi } from '@/services/projectProfilesApiService.js';
import { createProjectFile } from '@/services/projectFileService.js';
import { createProjectLink } from '@/services/projectLinkService.js';
import { readUserPreferences } from '@/services/userPreferencesService.js';
import { createWaitingReturn, listProjectWaitingReturns, subscribeToWaitingReturns } from '@/services/waitingReturnService.js';
import { readUserScopedJson, writeUserScopedJson } from '@/lib/userScopedStorage.js';
import { buildProjectMaterialReferences, collectProjectMaterials, toReferencePreferenceKey } from '@/lib/myDeskProjectReferencesLogic.js';
import folderIconSrc from '@/assets/pasta02.svg';

const MyDeskContext = createContext(null);

const NOTE_COLORS = {
  yellow: { label: 'amarelo', body: '#FFF9DE', band: '#F4E49C' },
  lilac: { label: 'lilas', body: '#F5EFFF', band: '#DCCCF3' },
  pink: { label: 'rosa', body: '#FFF0F3', band: '#F3CDD7' },
  green: { label: 'verde', body: '#EDF8EF', band: '#C8E5CE' },
  blue: { label: 'azul', body: '#EDF7FC', band: '#C5E4F1' },
  neutral: { label: 'neutro', body: '#F7F5F0', band: '#DED9CF' },
  peach: { label: 'pessego', body: '#FFF1E8', band: '#F2CDB8' },
};

const TRANSFORM_OPTIONS = [
  { id: 'task', label: 'Tarefa' },
  { id: 'microtask', label: 'Microtarefa' },
  { id: 'mind', label: 'Descarregar a mente' },
  { id: 'waiting', label: 'Aguardando retorno' },
  { id: 'saved', label: 'Guardar para organizar' },
  { id: 'material', label: 'Material de projeto' },
];

const ORGANIZE_OPTIONS = [
  { id: 'auto', label: 'Organizar automaticamente' },
  { id: 'left', label: 'Alinhar a esquerda' },
  { id: 'name', label: 'Organizar por nome' },
  { id: 'project', label: 'Organizar por projeto' },
  { id: 'type', label: 'Organizar por tipo' },
];

const MATERIAL_PICKER_TYPES = [
  { id: 'all', label: 'Todos' },
  { id: 'project-file', label: 'Arquivos' },
  { id: 'project-link', label: 'Links' },
  { id: 'project-note', label: 'Notas' },
];

const PROJECT_REF_PREFS_KEY = 'clareia_desk_project_reference_prefs_v1';

function readProjectReferencePrefs() {
  const value = readUserScopedJson(PROJECT_REF_PREFS_KEY, {});
  return value && typeof value === 'object' ? value : {};
}

function writeProjectReferencePrefs(nextValue) {
  writeUserScopedJson(PROJECT_REF_PREFS_KEY, nextValue);
}

function normalize(value) {
  return String(value || '').trim().toLocaleLowerCase('pt-BR');
}

function isRichNote(item) {
  return String(item?.contentFormat || '').toLowerCase() === 'richtext';
}

function noteDisplayTitle(item) {
  const title = String(item.title || '').trim();
  if (title) return title;
  return String(item.content || '').split('\n').find((line) => line.trim())?.trim().slice(0, 80) || 'Nova nota';
}

function getProjectName(item) {
  return String(item.projectName || '').trim();
}

function itemName(item) {
  if (item.type === 'project') return String(item.label || item.projectName || '').trim() || 'Pasta';
  if (item.type === 'shortcut') return String(item.label || '').trim() || 'Atalho';
  return noteDisplayTitle(item);
}

function searchBlob(item) {
  return normalize([itemName(item), item.content, item.url, item.projectName, item.label].filter(Boolean).join(' '));
}

function isFileShortcut(item) {
  return item.type === 'shortcut' && item.shortcutKind === 'file';
}

function extensionOf(item) {
  const source = String(item.label || item.url || '').toLowerCase();
  const dot = source.lastIndexOf('.');
  if (dot < 0) return '';
  return source.slice(dot + 1).replace(/[^a-z0-9]/g, '');
}

function fileIcon(item) {
  if (item.sourceType === 'project-link') return Link2;
  if (item.sourceType === 'project-note') return StickyNote;
  if (item.sourceType === 'project-tasks') return CheckSquare;
  if (item.sourceType === 'project-waiting') return Clock3;
  if (item.sourceType === 'project-drive-root') return Folder;
  if (item.sourceType === 'project-material-group') return Folder;
  const extension = extensionOf(item);
  if (['doc', 'docx', 'pdf', 'txt', 'rtf', 'odt'].includes(extension)) return FileText;
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(extension)) return FileImage;
  if (['xlsx', 'xls', 'csv'].includes(extension)) return FileSpreadsheet;
  return File;
}

function shortcutSubtitle(item) {
  if (item.sourceType === 'project-tasks') return 'Tarefas';
  if (item.sourceType === 'project-waiting') return 'Aguardando retorno';
  if (item.sourceType === 'project-drive-root') return 'Google Drive';
  if (item.sourceType === 'project-link') return 'Link';
  if (item.sourceType === 'project-file') {
    const extension = extensionOf(item);
    if (['doc', 'docx', 'pdf', 'txt', 'rtf', 'odt'].includes(extension)) return 'Documento';
    return 'Arquivo';
  }
  if (item.shortcutKind === 'file') return 'Arquivo';
  if (item.shortcutKind === 'link') {
    if (String(item.url || '').trim()) return 'Link';
    return 'Entrada';
  }
  return 'Atalho';
}

function shouldShowAtRoot(item) {
  if (item.type === 'project') return true;
  return !getProjectName(item);
}

function snapValue(value, grid) {
  return Math.max(12, Math.round(Number(value || 0) / grid) * grid);
}

function hydratePositions(items, workspaceWidth = 1280) {
  const output = [];
  items.forEach((item) => {
    let x = Number(item.x);
    let y = Number(item.y);
    if (!Number.isFinite(x) || !Number.isFinite(y) || (x === 0 && y === 0)) {
      const slot = findNextAvailableSlot(output, {
        itemType: item.type,
        maxWidth: workspaceWidth,
        grid: 16,
        startX: 20,
        startY: 24,
      });
      output.push({
        ...item,
        x: slot.x,
        y: slot.y,
        order: Number.isFinite(Number(item.order)) ? Number(item.order) : output.length,
        __needsPersist: true,
      });
      return;
    }

    output.push({
      ...item,
      x: snapValue(x, 12),
      y: snapValue(y, 12),
      order: Number.isFinite(Number(item.order)) ? Number(item.order) : output.length,
    });
  });
  return output;
}

function useCompactLayout() {
  const [compact, setCompact] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  useEffect(() => {
    const onResize = () => setCompact(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return compact;
}

function renderInlineToken(token, key) {
  if (token.type === 'bold') return <strong key={key}>{token.value}</strong>;
  if (token.type === 'italic') return <em key={key}>{token.value}</em>;
  if (token.type === 'strike') return <s key={key}>{token.value}</s>;
  if (token.type === 'code') return <code key={key} className="rounded bg-black/10 px-1 py-0.5 text-[12px]">{token.value}</code>;
  if (token.type === 'link') return <a key={key} href={token.href} target="_blank" rel="noopener noreferrer" className="underline text-sky-700">{token.text}</a>;
  return <span key={key}>{token.value}</span>;
}

function RichContent({ item, onToggleChecklist, preview = false }) {
  const blocks = parseRichTextBlocks(item.content || '', { forcePlain: !isRichNote(item) });
  let checklistIndex = -1;

  return (
    <div className={preview ? 'desk-rich-preview' : 'desk-rich-full'}>
      {blocks.map((block, blockIndex) => {
        if (block.type === 'space') return <div key={`space-${blockIndex}`} className="h-2" />;
        if (block.type === 'paragraph') {
          return <p key={`p-${blockIndex}`}>{block.tokens.map((token, tokenIndex) => renderInlineToken(token, `p-${blockIndex}-${tokenIndex}`))}</p>;
        }
        if (block.type === 'unordered') {
          return (
            <ul key={`ul-${blockIndex}`} className="list-disc pl-4">
              {block.items.map((entry, entryIndex) => (
                <li key={`ul-${blockIndex}-${entryIndex}`}>{entry.tokens.map((token, tokenIndex) => renderInlineToken(token, `ul-${blockIndex}-${entryIndex}-${tokenIndex}`))}</li>
              ))}
            </ul>
          );
        }
        if (block.type === 'ordered') {
          return (
            <ol key={`ol-${blockIndex}`} className="list-decimal pl-4">
              {block.items.map((entry, entryIndex) => (
                <li key={`ol-${blockIndex}-${entryIndex}`}>{entry.tokens.map((token, tokenIndex) => renderInlineToken(token, `ol-${blockIndex}-${entryIndex}-${tokenIndex}`))}</li>
              ))}
            </ol>
          );
        }
        if (block.type === 'checklist') {
          return (
            <ul key={`check-${blockIndex}`} className="space-y-1">
              {block.items.map((entry, entryIndex) => {
                checklistIndex += 1;
                const currentChecklistIndex = checklistIndex;
                return (
                  <li key={`check-${blockIndex}-${entryIndex}`} className="flex items-start gap-2">
                    <button
                      type="button"
                      data-no-drag="true"
                      aria-label={entry.checked ? 'Desmarcar item' : 'Marcar item'}
                      className={`mt-0.5 h-4 w-4 rounded border border-black/25 text-[11px] ${entry.checked ? 'bg-emerald-600 text-white' : 'bg-white/70'}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onToggleChecklist(currentChecklistIndex);
                      }}
                    >
                      {entry.checked ? 'x' : ''}
                    </button>
                    <span className={entry.checked ? 'line-through opacity-70' : ''}>{entry.tokens.map((token, tokenIndex) => renderInlineToken(token, `check-${blockIndex}-${entryIndex}-${tokenIndex}`))}</span>
                  </li>
                );
              })}
            </ul>
          );
        }
        return null;
      })}
    </div>
  );
}

function RichTextEditor({ value, onChange }) {
  const editorRef = useRef(null);

  const applyChange = (nextState) => {
    onChange(nextState.value);
    requestAnimationFrame(() => {
      if (!editorRef.current) return;
      editorRef.current.focus();
      editorRef.current.setSelectionRange(nextState.selectionStart, nextState.selectionEnd);
    });
  };

  const withSelection = (handler) => {
    const editor = editorRef.current;
    if (!editor) return;
    applyChange(handler(value, editor.selectionStart, editor.selectionEnd));
  };

  return (
    <div className="rounded-md border border-black/12 bg-white/95" onPointerDown={(event) => event.stopPropagation()}>
      <div className="flex flex-wrap items-center gap-1 border-b border-black/10 p-1.5">
        <button type="button" aria-label="Negrito" className="desk-editor-tool" onClick={() => withSelection((text, start, end) => applyWrapFormat(text, start, end, '**'))}><Bold className="h-4 w-4" /></button>
        <button type="button" aria-label="Italico" className="desk-editor-tool" onClick={() => withSelection((text, start, end) => applyWrapFormat(text, start, end, '_'))}><Italic className="h-4 w-4" /></button>
        <button type="button" aria-label="Tachado" className="desk-editor-tool" onClick={() => withSelection((text, start, end) => applyWrapFormat(text, start, end, '~~'))}><Strikethrough className="h-4 w-4" /></button>
        <button type="button" aria-label="Lista com marcadores" className="desk-editor-tool" onClick={() => withSelection((text, start, end) => applyPrefixList(text, start, end, 'bullet'))}><List className="h-4 w-4" /></button>
        <button type="button" aria-label="Lista numerada" className="desk-editor-tool" onClick={() => withSelection((text, start, end) => applyPrefixList(text, start, end, 'ordered'))}><ListOrdered className="h-4 w-4" /></button>
        <button type="button" aria-label="Checklist" className="desk-editor-tool" onClick={() => withSelection((text, start, end) => applyPrefixList(text, start, end, 'check'))}>☑</button>
        <button type="button" aria-label="Inserir link" className="desk-editor-tool" onClick={() => withSelection((text, start, end) => applyLinkFormat(text, start, end))}><Link2 className="h-4 w-4" /></button>
        <button type="button" aria-label="Inserir emoji" className="desk-editor-tool" onClick={() => withSelection((text, start, end) => applyEmoji(text, start, end, '🙂'))}><Smile className="h-4 w-4" /></button>
      </div>
      <textarea
        ref={editorRef}
        value={value}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'b') {
            event.preventDefault();
            withSelection((text, start, end) => applyWrapFormat(text, start, end, '**'));
            return;
          }
          if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'i') {
            event.preventDefault();
            withSelection((text, start, end) => applyWrapFormat(text, start, end, '_'));
          }
        }}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-[180px] w-full resize-y border-0 bg-transparent px-3 py-2 text-[13px] leading-relaxed outline-none"
      />
    </div>
  );
}

function DeskItemIcon({ item }) {
  if (item.type === 'project') return <img src={folderIconSrc} alt="" className={`desk-folder-svg desk-folder-skin-${item.iconTone || 'none'}`} draggable={false} />;
  if (item.type === 'shortcut') {
    let Icon = Link2;
    if (item.sourceType === 'project-tasks') Icon = CheckSquare;
    else if (item.sourceType === 'project-waiting') Icon = Clock3;
    else if (item.sourceType === 'project-drive-root') Icon = Folder;
    else if (item.sourceType === 'project-link') Icon = Globe;
    else if (item.sourceType === 'project-file' || item.sourceType === 'project-material-group' || isFileShortcut(item)) Icon = fileIcon(item);
    return <Icon className="h-6 w-6" aria-hidden="true" />;
  }
  if (item.type === 'note' && item.isReference && item.sourceType === 'project-note') {
    return <StickyNote className="h-6 w-6" aria-hidden="true" />;
  }
  return null;
}

function CompactItemCard({ item, selected, onClick, onDoubleClick, onMenu, onToggleChecklist }) {
  const subtitle = item.type === 'shortcut'
    ? shortcutSubtitle(item)
    : (item.type === 'project' ? 'Pasta' : (getProjectName(item) || 'Sem projeto'));

  return (
    <article className={`rounded-lg border bg-white/85 p-3 shadow-sm ${selected ? 'border-primary/45 ring-1 ring-primary/30' : 'border-black/10'}`} onClick={onClick}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-2">
          <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-md bg-black/5 text-black/70"><DeskItemIcon item={item} /></span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{itemName(item)}</p>
            <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <button type="button" className="desk-mini-action" onClick={(event) => {
          event.stopPropagation();
          onMenu(event.currentTarget);
        }}>
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>
      {item.type === 'note' && <div className="mt-2 text-sm text-black/80"><RichContent item={item} onToggleChecklist={onToggleChecklist} preview /></div>}
      <button type="button" className="mt-2 text-xs text-primary underline-offset-2 hover:underline" onClick={(event) => {
        event.stopPropagation();
        onDoubleClick();
      }}>
        Abrir
      </button>
    </article>
  );
}

function NoteSticky({ item, selected, isEditing, editValue, onEditChange, onOpenMenu, onPointerDown, onToggleChecklist, onEnterEdit, onSaveEdit, onCancelEdit }) {
  const palette = NOTE_COLORS[item.color] || NOTE_COLORS.yellow;

  return (
    <article
      role="button"
      tabIndex={0}
      className={`desk-sticky ${selected ? 'desk-selected' : ''} ${isEditing ? 'desk-sticky-editing' : ''}`}
      onPointerDown={onPointerDown}
      onDoubleClick={() => {
        if (!isEditing) onEnterEdit();
      }}
      onKeyDown={(event) => {
        if (!isEditing && event.key === 'Enter') onEnterEdit();
        if (isEditing && event.key === 'Escape') {
          event.preventDefault();
          onCancelEdit();
        }
        if (isEditing && (event.metaKey || event.ctrlKey) && event.key === 'Enter') {
          event.preventDefault();
          onSaveEdit();
        }
      }}
      style={{ '--desk-note-body': palette.body, '--desk-note-band': palette.band }}
    >
      <div className="desk-sticky-band" />
      <div className="desk-sticky-content">
        {isEditing ? (
          <>
            <Input
              data-no-drag="true"
              value={editValue.title}
              onPointerDown={(event) => event.stopPropagation()}
              onChange={(event) => onEditChange((current) => ({ ...current, title: event.target.value }))}
              className="mb-2 h-9 border-black/15 bg-white/85 text-[14px] font-semibold"
              placeholder="Titulo"
            />
            <RichTextEditor
              value={editValue.content}
              onChange={(nextContent) => onEditChange((current) => ({ ...current, content: nextContent, contentFormat: 'richtext' }))}
            />
          </>
        ) : (
          <>
            <h3 className="desk-sticky-title">{noteDisplayTitle(item)}</h3>
            <RichContent item={item} onToggleChecklist={onToggleChecklist} preview />
          </>
        )}
      </div>
      <div className="desk-sticky-footer">
        <span className="desk-sticky-project">{getProjectName(item) || 'Sem projeto'}</span>
        <button
          type="button"
          data-no-drag="true"
          data-desk-menu-trigger="true"
          aria-label="Abrir acoes"
          className="desk-mini-action"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onOpenMenu(event.currentTarget);
          }}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}

export default function MyDesk({ open, onClose }) {
  const navigate = useNavigate();
  const compactLayout = useCompactLayout();
  const { currentUser } = useAuth();
  const { tasks, addTask, setSelectedTask } = useTaskContext();
  const userId = currentUser?.id || '';
  const accountId = currentUser?.currentAccountId || getCurrentAccountId();

  const [items, setItems] = useState([]);
  const [archivedItems, setArchivedItems] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loadState, setLoadState] = useState('idle');
  const [dialog, setDialog] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [contextMenu, setContextMenu] = useState(null);
  const [contextMenuPlacement, setContextMenuPlacement] = useState(null);
  const [isTransforming, setIsTransforming] = useState(false);
  const [currentFolder, setCurrentFolder] = useState('');
  const [form, setForm] = useState({ mode: 'link', label: '', url: '', projectId: '', folderLabel: '' });
  const [editingNoteId, setEditingNoteId] = useState('');
  const [editingNoteValue, setEditingNoteValue] = useState({ title: '', content: '', contentFormat: 'richtext' });
  const [projectReferenceItems, setProjectReferenceItems] = useState([]);
  const [projectMaterialsMeta, setProjectMaterialsMeta] = useState({ grouped: false, totalMaterials: 0 });
  const [referencePrefs, setReferencePrefs] = useState(() => readProjectReferencePrefs());
  const [materialPicker, setMaterialPicker] = useState({ options: [], selected: '', type: 'all', query: '' });

  const itemsRef = useRef(items);
  const timersRef = useRef(new Map());
  const pendingRef = useRef(new Map());
  const closeRef = useRef(null);
  const workspaceRef = useRef(null);
  const dragRef = useRef(null);
  const recentDragRef = useRef(0);
  const contextMenuRef = useRef(null);
  const editingNoteWrapperRef = useRef(null);
  const visibleItemsRef = useRef([]);

  itemsRef.current = items;

  const persistNow = (id) => {
    const patch = pendingRef.current.get(id);
    if (!patch) return Promise.resolve();
    pendingRef.current.delete(id);
    clearTimeout(timersRef.current.get(id));
    timersRef.current.delete(id);

    return queueDeskItemUpdate(id, patch)
      .then((saved) => {
        setItems((current) => current.map((item) => (item.id === id ? { ...item, revision: saved?.revision || item.revision, saveState: '' } : item)));
      })
      .catch((error) => {
        setItems((current) => current.map((item) => (item.id === id ? { ...item, saveState: 'error' } : item)));
        throw error;
      });
  };

  const flush = async () => {
    const ids = [...pendingRef.current.keys()];
    await Promise.all(ids.map((id) => persistNow(id)));
    await flushDeskItemUpdates();
  };

  const scheduleChange = (id, patch, delay = 650) => {
    pendingRef.current.set(id, { ...(pendingRef.current.get(id) || {}), ...patch });
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch, saveState: 'saving' } : item)));
    clearTimeout(timersRef.current.get(id));
    timersRef.current.set(id, setTimeout(() => {
      persistNow(id).catch((error) => toast.error(error.message || 'Nao foi possivel salvar uma alteracao da mesa.'));
    }, delay));
  };

  useEffect(() => {
    if (!open) return undefined;
    setLoadState('loading');
    Promise.all([listDeskItems(), listProjectProfilesApi()])
      .then(([deskItems, projectItems]) => {
        const width = window.innerWidth || 1280;
        const hydrated = hydratePositions(deskItems, width);
        setItems(hydrated);
        setProjects(projectItems);
        hydrated.filter((item) => item.__needsPersist).forEach((item) => {
          scheduleChange(item.id, { x: item.x, y: item.y }, 250);
        });
        setLoadState('ready');
        requestAnimationFrame(() => closeRef.current?.focus());
      })
      .catch(() => setLoadState('error'));
    return undefined;
  }, [open]);

  useEffect(() => () => {
    for (const id of pendingRef.current.keys()) persistNow(id).catch(() => {});
  }, []);

  useEffect(() => {
    if (!contextMenu) return undefined;

    const close = (event) => {
      const target = event.target;
      if (contextMenuRef.current?.contains(target)) return;
      if (target?.closest?.('[data-desk-menu-trigger="true"]')) return;
      setContextMenu(null);
      setContextMenuPlacement(null);
    };

    const onEscape = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setContextMenu(null);
        setContextMenuPlacement(null);
      }
    };

    window.addEventListener('pointerdown', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('keydown', onEscape);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('keydown', onEscape);
    };
  }, [contextMenu]);

  useEffect(() => {
    if (!contextMenu) return;
    const menuHeight = contextMenu.itemType === 'note' ? 318 : 188;
    setContextMenuPlacement(computeContextMenuPosition({
      anchorX: contextMenu.anchorX,
      anchorY: contextMenu.anchorY,
      menuWidth: 230,
      menuHeight,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      padding: 10,
    }));
  }, [contextMenu]);

  const commitInlineEdit = async (mode = 'save') => {
    const noteId = editingNoteId;
    if (!noteId) return;
    const current = visibleItemsRef.current.find((entry) => entry.id === noteId);
    if (!current || current.type !== 'note') {
      setEditingNoteId('');
      return;
    }

    if (mode === 'cancel') {
      if (current.isDraft) {
        setItems((list) => list.filter((entry) => entry.id !== noteId));
      }
      setEditingNoteId('');
      return;
    }

    const payload = {
      ...editingNoteValue,
      title: String(editingNoteValue.title || ''),
      content: String(editingNoteValue.content || ''),
      contentFormat: 'richtext',
    };

    if (current.isReference && current.sourceType === 'project-note') {
      if (!hasMeaningfulNoteContent(payload)) {
        setEditingNoteId('');
        return;
      }

      const updated = updateProjectNote(current.sourceId, {
        title: payload.title,
        content: payload.content,
      });
      if (!updated) {
        toast.error('Nao foi possivel atualizar a nota do projeto.');
      }
      setEditingNoteId('');
      reloadProjectReferences(currentFolder);
      return;
    }

    if (current.isDraft) {
      if (!hasMeaningfulNoteContent(payload)) {
        setItems((list) => list.filter((entry) => entry.id !== noteId));
        setEditingNoteId('');
        return;
      }

      try {
        const created = await createDeskItem({
          ...toDraftPersistPayload({ ...current, ...payload }),
        });
        setItems((list) => list.map((entry) => (entry.id === noteId ? created : entry)));
        setEditingNoteId('');
      } catch (error) {
        toast.error(error.message || 'Nao foi possivel salvar a nova nota.');
      }
      return;
    }

    if (!hasMeaningfulNoteContent(payload)) {
      setEditingNoteId('');
      return;
    }

    const patch = {
      ...serializeRichNoteContent(payload.content),
      title: payload.title,
    };

    scheduleChange(current.id, patch, 150);
    setEditingNoteId('');
  };

  useEffect(() => {
    if (!editingNoteId) return undefined;
    const onPointerDown = (event) => {
      const target = event.target;
      if (editingNoteWrapperRef.current?.contains(target)) return;
      if (target?.closest?.('.desk-context-menu')) return;
      if (target?.closest?.('[role="dialog"]')) return;
      commitInlineEdit('save');
    };

    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [editingNoteId, editingNoteValue]);

  const visibleItems = useMemo(() => {
    const query = normalize(search);
    const deskItems = items
      .filter((item) => {
        if (currentFolder) {
          if (item.type === 'project') return false;
          if (getProjectName(item) !== currentFolder) return false;
        } else if (!shouldShowAtRoot(item)) {
          return false;
        }

        if (query && !searchBlob(item).includes(query)) return false;
        return true;
      })
      .sort((left, right) => Number(left.order || 0) - Number(right.order || 0));

    if (!currentFolder) return deskItems;

    const scopedPrefs = referencePrefs?.[currentFolder] || {};
    const savedPositions = scopedPrefs.positions || {};
    const occupied = deskItems.map((item) => ({ ...item }));

    const referenceItems = projectReferenceItems
      .filter((item) => !query || searchBlob(item).includes(query))
      .map((item, index) => {
        const prefKey = toReferencePreferenceKey(item);
        const preset = savedPositions[prefKey];
        let x = Number(preset?.x);
        let y = Number(preset?.y);
        let order = Number(preset?.order);

        if (!Number.isFinite(x) || !Number.isFinite(y)) {
          const slot = findNextAvailableSlot(occupied, {
            itemType: item.type,
            maxWidth: workspaceRef.current?.clientWidth || window.innerWidth,
            grid: window.innerWidth < 1024 ? 24 : 16,
            startX: 20,
            startY: 24,
          });
          x = slot.x;
          y = slot.y;
        }
        if (!Number.isFinite(order)) {
          order = 5000 + index;
        }

        const composed = {
          ...item,
          x,
          y,
          order,
          isReference: true,
        };
        occupied.push(composed);
        return composed;
      });

    return [...deskItems, ...referenceItems].sort((left, right) => Number(left.order || 0) - Number(right.order || 0));
  }, [currentFolder, items, projectReferenceItems, referencePrefs, search]);

  useEffect(() => {
    visibleItemsRef.current = visibleItems;
  }, [visibleItems]);

  const currentFolderProject = useMemo(
    () => resolveProjectContext(currentFolder, projects),
    [currentFolder, projects]
  );

  const updateReferencePrefs = useCallback((updater) => {
    setReferencePrefs((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater;
      writeProjectReferencePrefs(next);
      return next;
    });
  }, []);

  const reloadProjectReferences = useCallback(async (projectName) => {
    const normalizedProject = String(projectName || '').trim();
    if (!normalizedProject) {
      setProjectReferenceItems([]);
      setProjectMaterialsMeta({ grouped: false, totalMaterials: 0 });
      return;
    }

    const collected = collectProjectMaterials({
      projectName: normalizedProject,
      files: listProjectFiles(normalizedProject),
      links: listProjectLinks(normalizedProject),
      notes: listProjectNotes(normalizedProject),
    });

    const taskCount = tasks.filter((task) => String(task.project || '').trim() === normalizedProject).length;
    const waitingCount = listProjectWaitingReturns(normalizedProject).filter((item) => item.status !== 'Concluido').length;
    const showAll = referencePrefs?.[normalizedProject]?.showAll === true;

    let driveConfig = null;
    if (currentFolderProject.projectId) {
      driveConfig = await getGoogleDriveProjectFolderConfig(currentFolderProject.projectId).catch(() => null);
    }

    const result = buildProjectMaterialReferences({
      projectName: normalizedProject,
      files: collected.files,
      links: collected.links,
      notes: collected.notes,
      driveConfig,
      taskCount,
      waitingCount,
      showAll,
      threshold: 10,
    });

    const hiddenMap = referencePrefs?.[normalizedProject]?.hidden || {};
    setProjectReferenceItems(result.items.filter((item) => !hiddenMap[toReferencePreferenceKey(item)]));
    setProjectMaterialsMeta({ grouped: result.grouped, totalMaterials: result.totalMaterials });
  }, [currentFolderProject.projectId, referencePrefs, tasks]);

  useEffect(() => {
    if (!open || !currentFolder) {
      setProjectReferenceItems([]);
      setProjectMaterialsMeta({ grouped: false, totalMaterials: 0 });
      return;
    }
    reloadProjectReferences(currentFolder);
  }, [open, currentFolder, reloadProjectReferences]);

  useEffect(() => {
    if (!open) return undefined;
    const refresh = () => {
      if (currentFolder) reloadProjectReferences(currentFolder);
    };
    const unsubscribeMaterials = subscribeToProjectMaterials(refresh);
    const unsubscribeWaiting = subscribeToWaitingReturns(refresh);
    return () => {
      unsubscribeMaterials();
      unsubscribeWaiting();
    };
  }, [open, currentFolder, reloadProjectReferences]);

  const openArchived = async () => {
    try {
      setArchivedItems(await listArchivedDeskItems());
      setDialog({ type: 'archived' });
    } catch (error) {
      toast.error(error.message || 'Nao foi possivel carregar notas arquivadas.');
    }
  };

  const selectItem = (itemId, event) => {
    setContextMenu(null);
    setContextMenuPlacement(null);
    setSelectedIds((current) => {
      const next = new Set(current);
      const multi = event?.metaKey || event?.ctrlKey;
      if (multi) {
        if (next.has(itemId)) next.delete(itemId);
        else next.add(itemId);
        return next;
      }
      next.clear();
      next.add(itemId);
      return next;
    });
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
    setContextMenu(null);
    setContextMenuPlacement(null);
  };

  const openContextMenu = ({ item, anchorX, anchorY }) => {
    setSelectedIds(new Set([item.id]));
    setContextMenu({ itemId: item.id, itemType: item.type, anchorX, anchorY });
  };

  const openItemMenu = (item, anchor) => {
    const rect = anchor.getBoundingClientRect();
    openContextMenu({ item, anchorX: rect.left + rect.width / 2, anchorY: rect.bottom + 8 });
  };

  const onItemContextMenu = (event, item) => {
    event.preventDefault();
    selectItem(item.id, event);
    openContextMenu({ item, anchorX: event.clientX, anchorY: event.clientY });
  };

  const openProjectFolder = (projectName) => {
    setCurrentFolder(projectName);
    setSelectedIds(new Set());
    setContextMenu(null);
    setContextMenuPlacement(null);
  };

  const openShortcut = (item) => {
    if (!item?.url) return;
    window.open(item.url, '_blank', 'noopener,noreferrer');
  };

  const openProjectReference = (item) => {
    if (!item?.isReference) return false;
    if (item.sourceType === 'project-tasks') {
      navigate(`/projects?project=${encodeURIComponent(item.projectName || '')}&tab=tarefas`);
      onClose();
      return true;
    }
    if (item.sourceType === 'project-waiting') {
      navigate(`/aguardando-retorno?project=${encodeURIComponent(item.projectName || '')}`);
      onClose();
      return true;
    }
    if (item.sourceType === 'project-material-group') {
      updateReferencePrefs((current) => ({
        ...current,
        [item.projectName]: {
          ...(current?.[item.projectName] || {}),
          showAll: true,
        },
      }));
      reloadProjectReferences(item.projectName);
      return true;
    }
    if (item.url) {
      openShortcut(item);
      return true;
    }
    return false;
  };

  const openProjectMaterialPicker = useCallback(() => {
    const available = projectReferenceItems
      .filter((item) => ['project-file', 'project-link', 'project-note'].includes(item.sourceType))
      .map((item) => ({
        value: item.id,
        label: itemName(item),
        sourceType: item.sourceType,
        subtitle: item.sourceType === 'project-note'
          ? (String(item.content || '').trim().slice(0, 72) || 'Nota do projeto')
          : (String(item.url || '').trim() || 'Material do projeto'),
      }));

    setMaterialPicker({
      options: available,
      selected: available[0]?.value || '',
      type: 'all',
      query: '',
    });
    setDialog({ type: 'pick-project-material' });
  }, [projectReferenceItems]);

  const openLinkedTask = async (item) => {
    const task = tasks.find((entry) => entry.id === item.taskId);
    if (!task) return toast.error('A tarefa vinculada nao esta mais disponivel.');
    try {
      await flush();
    } catch {
      return toast.error('Algumas alteracoes da mesa nao foram salvas.');
    }
    setSelectedTask(task);
    onClose();
    navigate('/');
  };

  const startInlineEdit = (item) => {
    if (!item || item.type !== 'note') return;
    setEditingNoteId(item.id);
    setEditingNoteValue({
      title: String(item.title || ''),
      content: String(item.content || ''),
      contentFormat: 'richtext',
    });
    requestAnimationFrame(() => {
      const input = editingNoteWrapperRef.current?.querySelector('input, textarea');
      input?.focus();
    });
  };

  const itemDoubleClick = (item) => {
    if (Date.now() - recentDragRef.current < 220) return;
    if (item.type === 'project') {
      openProjectFolder(getProjectName(item));
      return;
    }
    if (item.type === 'shortcut') {
      if (openProjectReference(item)) return;
      openShortcut(item);
      return;
    }
    startInlineEdit(item);
  };

  const startDrag = (event, item) => {
    if (compactLayout || event.button !== 0) return;
    if (event.target.closest('[data-no-drag="true"]')) return;
    const workspace = workspaceRef.current;
    if (!workspace) return;

    selectItem(item.id, event);
    const workspaceRect = workspace.getBoundingClientRect();
    const snap = window.innerWidth < 1024 ? 24 : 16;

    dragRef.current = {
      id: item.id,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      originX: Number(item.x || 0),
      originY: Number(item.y || 0),
      moved: false,
      snap,
      width: workspaceRect.width,
      height: workspaceRect.height,
    };

    const handleMove = (moveEvent) => {
      if (!dragRef.current) return;
      dragRef.current.lastX = moveEvent.clientX;
      dragRef.current.lastY = moveEvent.clientY;
      if (!dragRef.current.moved && shouldStartDrag({
        startX: dragRef.current.startX,
        startY: dragRef.current.startY,
        currentX: moveEvent.clientX,
        currentY: moveEvent.clientY,
        threshold: 6,
      })) {
        dragRef.current.moved = true;
      }
      const deltaX = moveEvent.clientX - dragRef.current.startX;
      const deltaY = moveEvent.clientY - dragRef.current.startY;
      const rawX = dragRef.current.originX + deltaX;
      const rawY = dragRef.current.originY + deltaY;
      const x = Math.max(12, Math.min(dragRef.current.width - (item.type === 'note' ? 316 : 108), rawX));
      const y = Math.max(12, Math.min(dragRef.current.height - (item.type === 'note' ? 64 : 118), rawY));
      if (item.isReference) {
        setProjectReferenceItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, x, y } : entry)));
        return;
      }
      setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, x, y } : entry)));
    };

    const handleUp = () => {
      const drag = dragRef.current;
      dragRef.current = null;
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      if (!drag || !drag.moved) return;
      recentDragRef.current = Date.now();

      const snappedX = snapValue(drag.originX + (drag.lastX - drag.startX), drag.snap);
      const snappedY = snapValue(drag.originY + (drag.lastY - drag.startY), drag.snap);

      if (item.isReference) {
        const prefKey = toReferencePreferenceKey(item);
        updateReferencePrefs((current) => ({
          ...current,
          [currentFolder]: {
            ...(current?.[currentFolder] || {}),
            positions: {
              ...(current?.[currentFolder]?.positions || {}),
              [prefKey]: { x: snappedX, y: snappedY, order: Date.now() % 100000 },
            },
          },
        }));
        reloadProjectReferences(currentFolder);
        return;
      }

      if (item.isDraft) {
        setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, x: snappedX, y: snappedY, order: Date.now() % 100000 } : entry)));
      } else {
        scheduleChange(item.id, { x: snappedX, y: snappedY, order: Date.now() % 100000 }, 0);
      }
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp, { once: true });
  };

  const removeItem = async (item) => {
    if (item.isReference) {
      const prefKey = toReferencePreferenceKey(item);
      updateReferencePrefs((current) => ({
        ...current,
        [item.projectName]: {
          ...(current?.[item.projectName] || {}),
          hidden: {
            ...(current?.[item.projectName]?.hidden || {}),
            [prefKey]: true,
          },
        },
      }));
      setProjectReferenceItems((current) => current.filter((entry) => entry.id !== item.id));
      toast.success('Referencia oculta na Mesa. O material real nao foi apagado.');
      return;
    }

    if (item.isDraft) {
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      return;
    }

    setItems((current) => current.filter((entry) => entry.id !== item.id));
    try {
      await deleteDeskItem(item.id);
      toast(item.type === 'project' ? 'Atalho de pasta removido da Mesa. O projeto real nao foi excluido.' : 'Item removido da mesa.', {
        action: {
          label: 'Desfazer',
          onClick: async () => {
            const restored = await restoreDeskItem(item.id);
            setItems((current) => [...current, restored]);
          },
        },
      });
    } catch (error) {
      setItems((current) => (current.some((entry) => entry.id === item.id) ? current : [...current, item]));
      toast.error(error.message || 'Nao foi possivel remover o item.');
    }
  };

  const deleteReferencedSource = (item) => {
    if (!item?.isReference || !item?.canDeleteSource) return false;
    if (item.sourceType === 'project-file') return deleteProjectFile(item.sourceId);
    if (item.sourceType === 'project-link') return deleteProjectLink(item.sourceId);
    if (item.sourceType === 'project-note') return deleteProjectNote(item.sourceId);
    return false;
  };

  const archiveNote = async (item) => {
    if (item.isDraft) {
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      return;
    }

    try {
      await persistNow(item.id);
      const archived = await archiveDeskItem(item.id);
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      setArchivedItems((current) => [archived, ...current.filter((entry) => entry.id !== item.id)]);
      toast('Nota arquivada.', {
        action: {
          label: 'Desfazer',
          onClick: async () => {
            const restored = await unarchiveDeskItem(item.id);
            setArchivedItems((current) => current.filter((entry) => entry.id !== item.id));
            setItems((current) => [...current, restored]);
          },
        },
      });
    } catch (error) {
      toast.error(error.message || 'Nao foi possivel arquivar a nota.');
    }
  };

  const restoreArchived = async (item) => {
    try {
      const restored = await unarchiveDeskItem(item.id);
      setArchivedItems((current) => current.filter((entry) => entry.id !== item.id));
      setItems((current) => [...current, restored]);
    } catch (error) {
      toast.error(error.message || 'Nao foi possivel restaurar a nota.');
    }
  };

  const createNoteDraft = () => {
    const scopeItems = itemsRef.current.filter((item) => (currentFolder ? getProjectName(item) === currentFolder : shouldShowAtRoot(item)));
    const slot = findNextAvailableSlot(scopeItems, {
      itemType: 'note',
      maxWidth: workspaceRef.current?.clientWidth || window.innerWidth,
      grid: window.innerWidth < 1024 ? 24 : 16,
      startX: 20,
      startY: 24,
    });

    const draft = makeDraftNote({
      position: { ...slot, order: Date.now() % 100000 },
      projectId: currentFolderProject.projectId || '',
      projectName: currentFolderProject.projectName || '',
    });

    setItems((current) => [...current, draft]);
    setSelectedIds(new Set([draft.id]));
    setEditingNoteId(draft.id);
    setEditingNoteValue({ title: '', content: '', contentFormat: 'richtext' });
  };

  const duplicateItem = async (item) => {
    if (item.isDraft) {
      const slot = findNextAvailableSlot(itemsRef.current, {
        itemType: item.type,
        maxWidth: workspaceRef.current?.clientWidth || window.innerWidth,
        grid: window.innerWidth < 1024 ? 24 : 16,
      });
      const draft = {
        ...item,
        ...slot,
        id: makeDraftNote({ position: slot }).id,
      };
      setItems((current) => [...current, draft]);
      return;
    }

    try {
      const slot = findNextAvailableSlot(itemsRef.current, {
        itemType: item.type,
        maxWidth: workspaceRef.current?.clientWidth || window.innerWidth,
        grid: window.innerWidth < 1024 ? 24 : 16,
      });

      if (item.type === 'note') {
        const created = await createDeskItem({
          type: 'note',
          title: item.title || '',
          content: item.content || '',
          contentFormat: item.contentFormat || (isRichNote(item) ? 'richtext' : 'plain'),
          color: item.color || 'yellow',
          projectId: item.projectId || '',
          projectName: item.projectName || '',
          ...slot,
        });
        setItems((current) => [...current, created]);
        return;
      }

      if (item.type === 'shortcut') {
        const created = await createDeskItem({
          type: 'shortcut',
          label: item.label || '',
          url: item.url || '',
          shortcutKind: item.shortcutKind || 'link',
          projectId: item.projectId || '',
          projectName: item.projectName || '',
          ...slot,
        });
        setItems((current) => [...current, created]);
      }
    } catch (error) {
      toast.error(error.message || 'Nao foi possivel duplicar o item.');
    }
  };

  const transformNote = async (mode, note) => {
    const content = isRichNote(note) ? richTextToPlainText(note.content || '') : String(note?.content || '').trim();
    if (!content) {
      toast.error('A nota precisa de conteudo para transformar.');
      return;
    }

    if (mode === 'task') {
      if (!userId) {
        toast.error('Sua sessao nao foi carregada.');
        return;
      }
      try {
        setIsTransforming(true);
        const semanticContext = await getPlanProjectContext().catch(() => ({ projects: [] }));
        const record = await createOrReusePlanDraft({
          text: content,
          userId,
          accountId,
          origin: 'desk-transform',
          preferences: readUserPreferences(userId),
          projectContext: semanticContext,
        });
        setDialog(null);
        onClose();
        navigate('/plano-clareado', { state: { planRecord: record } });
      } catch (error) {
        toast.error(error.message || 'Nao foi possivel transformar em tarefa agora.');
      } finally {
        setIsTransforming(false);
      }
      return;
    }

    if (mode === 'microtask') {
      await addTask({
        title: noteDisplayTitle(note),
        description: content,
        project: note.projectName || 'Pessoal',
        taskType: 'Administrativo',
        nextAction: content.slice(0, 140),
        timeEstimate: 15,
        energiaNecessaria: 'Baixa',
        status: 'pendente',
      });
      toast.success('Microtarefa criada para revisao posterior.');
      setDialog(null);
      return;
    }

    if (mode === 'mind') {
      setDialog(null);
      onClose();
      navigate('/descarregar-mente', { state: { prefillText: content } });
      return;
    }

    if (mode === 'waiting') {
      const created = createWaitingReturn({
        project: note.projectName || '',
        contactName: '',
        waitingFor: content,
        status: 'Aguardando retorno',
      });
      if (!created) {
        toast.error('Nao foi possivel criar acompanhamento agora.');
        return;
      }
      toast.success('Acompanhamento guardado.');
      setDialog(null);
      return;
    }

    if (mode === 'saved') {
      if (!userId) {
        toast.error('Sua sessao nao foi carregada.');
        return;
      }
      createUnsortedNote({ content, userId, source: 'captura-rapida', project: note.projectName || '' });
      toast.success('Guardado para organizar depois.');
      setDialog(null);
      return;
    }

    if (mode === 'material') {
      const projectName = String(note.projectName || '').trim();
      if (!projectName) {
        toast.error('Escolha um projeto para salvar como material.');
        return;
      }
      const created = createProjectNote({
        projectName,
        title: noteDisplayTitle(note),
        content,
        tags: ['mesa'],
      });
      if (!created) {
        toast.error('Nao foi possivel criar material de projeto.');
        return;
      }
      toast.success(`Material salvo em ${projectName}.`);
      setDialog(null);
    }
  };

  const submitAdd = async () => {
    try {
      if (form.mode === 'project') {
        const slot = findNextAvailableSlot(itemsRef.current.filter((item) => shouldShowAtRoot(item)), {
          itemType: 'project',
          maxWidth: workspaceRef.current?.clientWidth || window.innerWidth,
          grid: window.innerWidth < 1024 ? 24 : 16,
          startX: 20,
          startY: 24,
        });

        const created = await createDeskItem({ type: 'project', projectId: Number(form.projectId), label: form.folderLabel, ...slot });
        setItems((current) => [...current, created]);
        setDialog(null);
        return;
      }

      if (form.mode === 'note') {
        createNoteDraft();
        setDialog(null);
        return;
      }

      if (form.mode === 'project-material') {
        openProjectMaterialPicker();
        return;
      }

      if (currentFolder && form.mode === 'link') {
        const created = createProjectLink({
          projectName: currentFolder,
          title: form.label,
          url: form.url,
          type: 'outro',
        });
        if (!created) throw new Error('Nao foi possivel criar o link do projeto.');
        setDialog(null);
        setForm({ mode: 'link', label: '', url: '', projectId: '', folderLabel: '' });
        reloadProjectReferences(currentFolder);
        return;
      }

      if (currentFolder && form.mode === 'file') {
        const created = createProjectFile({
          projectName: currentFolder,
          projectId: currentFolderProject.projectId || currentFolder,
          name: form.label,
          type: 'arquivo',
          url: form.url,
          externalLink: form.url,
        });
        if (!created) throw new Error('Nao foi possivel criar o arquivo do projeto.');
        setDialog(null);
        setForm({ mode: 'link', label: '', url: '', projectId: '', folderLabel: '' });
        reloadProjectReferences(currentFolder);
        return;
      }

      const context = currentFolderProject.projectName ? currentFolderProject : { projectId: '', projectName: '' };
      const slot = findNextAvailableSlot(itemsRef.current.filter((item) => (currentFolder ? getProjectName(item) === currentFolder : shouldShowAtRoot(item))), {
        itemType: 'shortcut',
        maxWidth: workspaceRef.current?.clientWidth || window.innerWidth,
        grid: window.innerWidth < 1024 ? 24 : 16,
        startX: 20,
        startY: 24,
      });

      const created = await createDeskItem({
        type: 'shortcut',
        label: form.label,
        url: form.url,
        shortcutKind: form.mode === 'file' ? 'file' : 'link',
        ...context,
        ...slot,
      });
      setItems((current) => [...current, created]);
      setDialog(null);
      setForm({ mode: 'link', label: '', url: '', projectId: '', folderLabel: '' });
    } catch (error) {
      toast.error(error.message || 'Nao foi possivel adicionar item.');
    }
  };

  const organizeDesk = (mode) => {
    const workspaceWidth = workspaceRef.current?.clientWidth || window.innerWidth;
    const desktopItems = visibleItems
      .filter((item) => (currentFolder ? item.type !== 'project' && getProjectName(item) === currentFolder : shouldShowAtRoot(item)))
      .slice();

    const getName = (item) => itemName(item).toLocaleLowerCase('pt-BR');

    if (mode === 'name') desktopItems.sort((a, b) => getName(a).localeCompare(getName(b), 'pt-BR'));
    if (mode === 'project') desktopItems.sort((a, b) => normalize(getProjectName(a)).localeCompare(normalize(getProjectName(b)), 'pt-BR'));
    if (mode === 'type') desktopItems.sort((a, b) => normalize(a.type).localeCompare(normalize(b.type), 'pt-BR') || getName(a).localeCompare(getName(b), 'pt-BR'));
    if (mode === 'left') desktopItems.sort((a, b) => Number(a.y || 0) - Number(b.y || 0) || Number(a.x || 0) - Number(b.x || 0));
    if (mode === 'auto') desktopItems.sort((a, b) => normalize(a.type).localeCompare(normalize(b.type), 'pt-BR') || getName(a).localeCompare(getName(b), 'pt-BR'));

    const spacingX = currentFolder ? 304 : 120;
    const spacingY = currentFolder ? 236 : 128;
    const columns = Math.max(1, Math.floor(Math.max(420, workspaceWidth - 40) / spacingX));

    const updates = new Map();
    desktopItems.forEach((item, index) => {
      updates.set(item.id, {
        x: 20 + (index % columns) * spacingX,
        y: 24 + Math.floor(index / columns) * spacingY,
        order: index + 1,
      });
    });

    setItems((current) => current.map((item) => {
      if (!updates.has(item.id)) return item;
      if (item.isReference) return item;
      const patch = updates.get(item.id);
      return { ...item, ...patch };
    }));

    setProjectReferenceItems((current) => current.map((item) => {
      if (!updates.has(item.id)) return item;
      const patch = updates.get(item.id);
      return { ...item, ...patch };
    }));

    updates.forEach((patch, id) => {
      const item = visibleItemsRef.current.find((entry) => entry.id === id);
      if (item?.isReference) {
        const prefKey = toReferencePreferenceKey(item);
        updateReferencePrefs((current) => ({
          ...current,
          [currentFolder]: {
            ...(current?.[currentFolder] || {}),
            positions: {
              ...(current?.[currentFolder]?.positions || {}),
              [prefKey]: patch,
            },
          },
        }));
        return;
      }
      if (item?.isDraft) return;
      scheduleChange(id, patch, 0);
    });
  };

  const closeDesk = async () => {
    if (editingNoteId) {
      await commitInlineEdit('save');
    }
    try {
      await flush();
    } catch {
      toast.error('Algumas alteracoes da mesa nao foram salvas.');
    }
    onClose();
  };

  const contextItem = useMemo(() => visibleItems.find((item) => item.id === contextMenu?.itemId) || null, [contextMenu?.itemId, visibleItems]);

  const runContextAction = (action) => {
    if (!contextItem) return;
    setContextMenu(null);
    setContextMenuPlacement(null);

    if (contextItem.type === 'project') {
      if (action === 'open') return openProjectFolder(getProjectName(contextItem));
      if (action === 'rename') {
        setForm((current) => ({ ...current, folderLabel: contextItem.label || getProjectName(contextItem) }));
        setDialog({ type: 'rename-project', item: contextItem });
        return;
      }
      if (action === 'archive') return removeItem(contextItem);
      return;
    }

    if (contextItem.type === 'note') {
      if (action === 'edit') return startInlineEdit(contextItem);
      if (contextItem.isReference) {
        if (action === 'open') return startInlineEdit(contextItem);
        if (action === 'hide') return removeItem(contextItem);
        if (action === 'delete-source') return setDialog({ type: 'confirm-delete-source', item: contextItem });
        return;
      }
      if (action === 'task' && contextItem.taskId && contextItem.taskAvailable) return openLinkedTask(contextItem);
      if (action === 'transform') return setDialog({ type: 'transform', note: contextItem });
      if (action === 'move') return setDialog({ type: 'move-note', note: contextItem });
      if (action === 'color') return setDialog({ type: 'color-note', note: contextItem });
      if (action === 'duplicate') return duplicateItem(contextItem);
      if (action === 'archive') return archiveNote(contextItem);
      if (action === 'delete') return setDialog({ type: 'confirm-delete', item: contextItem });
      return;
    }

    if (contextItem.isReference) {
      if (action === 'open') return openProjectReference(contextItem);
      if (action === 'hide') return removeItem(contextItem);
      if (action === 'delete-source') return setDialog({ type: 'confirm-delete-source', item: contextItem });
      return;
    }

    if (action === 'open') return openShortcut(contextItem);
    if (action === 'edit') {
      setForm({
        mode: contextItem.shortcutKind || 'link',
        label: contextItem.label || '',
        url: contextItem.url || '',
        projectId: String(contextItem.projectId || ''),
        folderLabel: '',
      });
      return setDialog({ type: 'edit-shortcut', item: contextItem });
    }
    if (action === 'duplicate') return duplicateItem(contextItem);
    if (action === 'delete') return setDialog({ type: 'confirm-delete', item: contextItem });
  };

  const toggleChecklistFromCard = (note, checklistIndex) => {
    const nextContent = toggleChecklistLine(note.content || '', checklistIndex);
    if (note.isReference && note.sourceType === 'project-note') {
      const updated = updateProjectNote(note.sourceId, { content: nextContent });
      if (!updated) {
        toast.error('Nao foi possivel atualizar a nota do projeto.');
        return;
      }
      reloadProjectReferences(note.projectName || currentFolder);
      return;
    }
    if (note.isDraft) {
      setItems((current) => current.map((entry) => (entry.id === note.id ? { ...entry, content: nextContent, contentFormat: 'richtext' } : entry)));
      if (editingNoteId === note.id) setEditingNoteValue((current) => ({ ...current, content: nextContent, contentFormat: 'richtext' }));
      return;
    }
    scheduleChange(note.id, { ...serializeRichNoteContent(nextContent) }, 0);
  };

  if (!open) return null;

  const addEntries = addMenuEntries(currentFolder);
  const folderVisibleItems = currentFolder
    ? items.filter((item) => item.type !== 'project' && getProjectName(item) === currentFolder).length + projectReferenceItems.length
    : visibleItems.length;

  return (
    <TooltipProvider delayDuration={250}>
      <section className="desk-overlay" role="dialog" aria-modal="true" aria-labelledby="desk-title" onKeyDown={(event) => {
        if (event.altKey && event.key === 'ArrowLeft' && currentFolder) {
          const internalMenuOpen = document.querySelector('[role="menu"][data-state="open"], [role="listbox"][data-state="open"]');
          if (dialog || contextMenu || editingNoteId || internalMenuOpen) return;
          event.preventDefault();
          setCurrentFolder('');
          setSelectedIds(new Set());
          setContextMenu(null);
          setContextMenuPlacement(null);
          return;
        }
        if (event.key === 'Escape' && contextMenu) {
          event.preventDefault();
          setContextMenu(null);
          setContextMenuPlacement(null);
          return;
        }
        if (event.key === 'Escape' && !dialog) {
          const internalMenuOpen = document.querySelector('[role="menu"][data-state="open"], [role="listbox"][data-state="open"]');
          if (!internalMenuOpen && !editingNoteId && currentFolder) {
            event.preventDefault();
            setCurrentFolder('');
            setSelectedIds(new Set());
            return;
          }
          if (!internalMenuOpen) closeDesk();
        }
      }}>
        <header className="desk-header desk-header-compact">
          <div className="min-w-0">
            <h1 id="desk-title" className="truncate text-base font-semibold">Minha Mesa</h1>
            {currentFolder && (
              <div className="desk-folder-context mt-0.5">
                <button
                  type="button"
                  className="desk-folder-back"
                  onClick={() => {
                    setCurrentFolder('');
                    setSelectedIds(new Set());
                    setContextMenu(null);
                    setContextMenuPlacement(null);
                  }}
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Minha Mesa
                </button>
                <div className="desk-folder-title-wrap">
                  <p className="desk-folder-title"><Folder className="h-4 w-4" />{currentFolder}</p>
                  <p className="desk-folder-meta">{folderVisibleItems} {folderVisibleItems === 1 ? 'item' : 'itens'}</p>
                </div>
              </div>
            )}
            {currentFolder && projectMaterialsMeta.grouped && (
              <button
                type="button"
                className="mt-1 text-[12px] text-primary underline-offset-2 hover:underline"
                onClick={() => {
                  updateReferencePrefs((current) => ({
                    ...current,
                    [currentFolder]: {
                      ...(current?.[currentFolder] || {}),
                      showAll: true,
                    },
                  }));
                  reloadProjectReferences(currentFolder);
                }}
              >
                Mostrar todos os materiais ({projectMaterialsMeta.totalMaterials})
              </button>
            )}
          </div>

          <div className="desk-header-actions">
            <TaskSessionBar embedded onReturnToFocus={onClose} />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm"><Plus className="mr-2 h-4 w-4" />Adicionar</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="z-[130]">
                {addEntries.map((entry) => (
                  <DropdownMenuItem key={entry.id} onSelect={() => {
                    if (entry.id === 'note') {
                      createNoteDraft();
                      return;
                    }
                    if (entry.id === 'project-material') {
                      openProjectMaterialPicker();
                      return;
                    }
                    setForm({ mode: entry.id, label: '', url: '', projectId: currentFolderProject.projectId ? String(currentFolderProject.projectId) : '', folderLabel: '' });
                    setDialog({ type: 'add-item' });
                  }}>{entry.label}</DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button size="sm" variant="ghost" onClick={openArchived}><Archive className="h-4 w-4" /><span className="hidden sm:inline">Arquivadas</span></Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost">Organizar mesa</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="z-[130]">
                {ORGANIZE_OPTIONS.map((option) => (
                  <DropdownMenuItem key={option.id} onSelect={() => organizeDesk(option.id)}>{option.label}</DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button size="icon" variant="ghost" onClick={() => setSearchOpen((current) => !current)} aria-label="Buscar na mesa">
              <Search className="h-4 w-4" />
            </Button>

            <Button ref={closeRef} size="sm" variant="outline" onClick={closeDesk}><ArrowLeft className="mr-1 h-4 w-4" />Voltar ao Clareia</Button>
          </div>
        </header>

        {searchOpen && (
          <div className="desk-search-popover">
            <Input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar na mesa" />
          </div>
        )}

        <main className="desk-scroll-area desk-workspace-wrap" onMouseDown={(event) => {
          if (event.target === event.currentTarget) deselectAll();
        }}>
          {loadState === 'loading' && <div className="desk-status">Carregando sua mesa...</div>}
          {loadState === 'error' && <div className="desk-status"><p>Nao foi possivel carregar sua mesa.</p><Button variant="outline" onClick={() => window.location.reload()}>Tentar novamente</Button></div>}

          {loadState === 'ready' && !compactLayout && (
            <div className="desk-workspace" ref={workspaceRef} onMouseDown={(event) => {
              if (event.target === event.currentTarget) deselectAll();
            }}>
              {visibleItems.map((item) => {
                const selected = selectedIds.has(item.id);
                const isEditing = editingNoteId === item.id;
                const visualItem = isEditing ? { ...item, ...editingNoteValue } : item;
                const style = { left: `${Number(item.x || 12)}px`, top: `${Number(item.y || 12)}px`, zIndex: isEditing ? 70 : selected ? 50 : 10 };

                if (item.type === 'note') {
                  return (
                    <div
                      key={item.id}
                      style={style}
                      className="desk-node"
                      ref={isEditing ? editingNoteWrapperRef : null}
                      onClick={(event) => selectItem(item.id, event)}
                      onContextMenu={(event) => onItemContextMenu(event, item)}
                    >
                      <NoteSticky
                        item={visualItem}
                        selected={selected}
                        isEditing={isEditing}
                        editValue={editingNoteValue}
                        onEditChange={setEditingNoteValue}
                        onEnterEdit={() => startInlineEdit(item)}
                        onSaveEdit={() => commitInlineEdit('save')}
                        onCancelEdit={() => commitInlineEdit('cancel')}
                        onPointerDown={(event) => startDrag(event, item)}
                        onOpenMenu={(anchor) => openItemMenu(item, anchor)}
                        onToggleChecklist={(checklistIndex) => toggleChecklistFromCard(item, checklistIndex)}
                      />
                    </div>
                  );
                }

                const itemClass = item.type === 'project' ? 'desk-icon-folder' : 'desk-icon-shortcut';
                return (
                  <div
                    key={item.id}
                    style={style}
                    className={`desk-node ${itemClass} ${selected ? 'desk-selected' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={(event) => selectItem(item.id, event)}
                    onDoubleClick={() => itemDoubleClick(item)}
                    onPointerDown={(event) => startDrag(event, item)}
                    onContextMenu={(event) => onItemContextMenu(event, item)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') itemDoubleClick(item);
                    }}
                  >
                    <div className="desk-icon-inner">
                      <DeskItemIcon item={item} />
                    </div>
                    <p className="desk-icon-label">{itemName(item)}</p>
                    {item.type === 'shortcut' && <p className="desk-icon-subtitle">{shortcutSubtitle(item)}</p>}
                    {selected && (
                      <button
                        type="button"
                        data-no-drag="true"
                        data-desk-menu-trigger="true"
                        aria-label="Mais acoes"
                        className="desk-mini-action desk-icon-menu"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation();
                          openItemMenu(item, event.currentTarget);
                        }}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                );
              })}

              {visibleItems.length === 0 && (
                <div className="desk-empty-state">
                  {currentFolder ? (
                    <>
                      <p className="font-medium">Nenhum material neste projeto ainda.</p>
                      <div className="mt-2 flex flex-wrap justify-center gap-2">
                        <Button size="sm" onClick={createNoteDraft}><Plus className="mr-1 h-4 w-4" />Nota</Button>
                        <Button size="sm" variant="outline" onClick={() => {
                          setForm({ mode: 'link', label: '', url: '', projectId: '', folderLabel: '' });
                          setDialog({ type: 'add-item' });
                        }}>+ Link</Button>
                        <Button size="sm" variant="outline" onClick={() => {
                          setForm({ mode: 'file', label: '', url: '', projectId: '', folderLabel: '' });
                          setDialog({ type: 'add-item' });
                        }}>+ Arquivo</Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="font-medium">Sua mesa esta vazia.</p>
                      <p className="text-sm text-muted-foreground">Use Adicionar para colocar itens na area de trabalho.</p>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {loadState === 'ready' && compactLayout && (
            <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
              {visibleItems.length === 0 && (
                <div className="col-span-full rounded-lg border border-dashed border-border bg-white/70 p-6 text-center">
                  <p className="font-medium">Nenhum item neste contexto.</p>
                  <p className="mt-1 text-sm text-muted-foreground">No mobile, a Mesa usa visual simplificado para facilitar o uso.</p>
                </div>
              )}
              {visibleItems.map((item) => (
                <CompactItemCard
                  key={item.id}
                  item={item}
                  selected={selectedIds.has(item.id)}
                  onClick={(event) => selectItem(item.id, event)}
                  onDoubleClick={() => itemDoubleClick(item)}
                  onMenu={(anchor) => openItemMenu(item, anchor)}
                  onToggleChecklist={(index) => toggleChecklistFromCard(item, index)}
                />
              ))}
            </div>
          )}
        </main>

        {contextMenu && contextItem && contextMenuPlacement && createPortal(
          <div
            ref={contextMenuRef}
            className="desk-context-menu"
            role="menu"
            tabIndex={-1}
            style={{ left: contextMenuPlacement.x, top: contextMenuPlacement.y }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            {contextItem.type === 'project' && (
              <>
                <button type="button" role="menuitem" onClick={() => runContextAction('open')}>Abrir</button>
                <button type="button" role="menuitem" onClick={() => runContextAction('rename')}>Renomear</button>
                <button type="button" role="menuitem" onClick={() => runContextAction('archive')}>Arquivar da Mesa</button>
              </>
            )}
            {contextItem.type === 'note' && (
              <>
                {contextItem.isReference ? (
                  <>
                    <button type="button" role="menuitem" onClick={() => runContextAction('open')}><Pencil className="h-4 w-4" />Editar nota</button>
                    <button type="button" role="menuitem" onClick={() => runContextAction('hide')}>Ocultar na Mesa</button>
                    {contextItem.canDeleteSource && <button type="button" role="menuitem" className="danger" onClick={() => runContextAction('delete-source')}><Trash2 className="h-4 w-4" />Excluir material</button>}
                  </>
                ) : (
                  <>
                    <button type="button" role="menuitem" onClick={() => runContextAction('edit')}><Pencil className="h-4 w-4" />Editar</button>
                    {contextItem.taskId && contextItem.taskAvailable && <button type="button" role="menuitem" onClick={() => runContextAction('task')}><Check className="h-4 w-4" />Abrir tarefa vinculada</button>}
                    <button type="button" role="menuitem" onClick={() => runContextAction('transform')}>Transformar em...</button>
                    <button type="button" role="menuitem" onClick={() => runContextAction('move')}>Mover para projeto</button>
                    <button type="button" role="menuitem" onClick={() => runContextAction('color')}>Mudar cor</button>
                    <button type="button" role="menuitem" onClick={() => runContextAction('duplicate')}>Duplicar</button>
                    <button type="button" role="menuitem" onClick={() => runContextAction('archive')}>Arquivar</button>
                    <button type="button" role="menuitem" className="danger" onClick={() => runContextAction('delete')}><Trash2 className="h-4 w-4" />Excluir</button>
                  </>
                )}
              </>
            )}
            {contextItem.type === 'shortcut' && (
              <>
                <button type="button" role="menuitem" onClick={() => runContextAction('open')}>Abrir</button>
                {contextItem.isReference ? (
                  <>
                    <button type="button" role="menuitem" onClick={() => runContextAction('hide')}>Ocultar na Mesa</button>
                    {contextItem.canDeleteSource && <button type="button" role="menuitem" className="danger" onClick={() => runContextAction('delete-source')}><Trash2 className="h-4 w-4" />Excluir material</button>}
                  </>
                ) : (
                  <>
                    <button type="button" role="menuitem" onClick={() => runContextAction('edit')}>Editar</button>
                    <button type="button" role="menuitem" onClick={() => runContextAction('duplicate')}>Duplicar</button>
                    <button type="button" role="menuitem" className="danger" onClick={() => runContextAction('delete')}><Trash2 className="h-4 w-4" />Excluir</button>
                  </>
                )}
              </>
            )}
          </div>,
          document.body
        )}

        <Dialog open={dialog?.type === 'add-item' || dialog?.type === 'edit-shortcut'} onOpenChange={(value) => !value && setDialog(null)}>
          <DialogContent className="z-[130]">
            <DialogHeader>
              <DialogTitle>{dialog?.type === 'edit-shortcut' ? 'Editar atalho' : form.mode === 'file' ? 'Adicionar arquivo' : form.mode === 'project' ? 'Adicionar pasta de projeto' : form.mode === 'project-material' ? 'Selecionar material do projeto' : 'Adicionar link'}</DialogTitle>
              <DialogDescription>{form.mode === 'project' ? 'Escolha um projeto para aparecer como pasta na mesa.' : form.mode === 'project-material' ? 'Escolha um material existente para abrir pela Mesa sem duplicar dados.' : 'Informe nome e endereco HTTPS.'}</DialogDescription>
            </DialogHeader>

            {form.mode === 'project' ? (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="desk-project">Projeto</Label>
                  <select
                    id="desk-project"
                    className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={form.projectId}
                    onChange={(event) => setForm((current) => ({
                      ...current,
                      projectId: event.target.value,
                      folderLabel: projects.find((project) => String(project.id) === event.target.value)?.name || '',
                    }))}
                  >
                    <option value="">Selecione</option>
                    {projects.filter((project) => !items.some((item) => item.type === 'project' && item.projectId === project.id)).map((project) => (
                      <option key={project.id} value={project.id}>{project.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="desk-folder-label">Nome na Mesa (opcional)</Label>
                  <Input id="desk-folder-label" value={form.folderLabel} onChange={(event) => setForm((current) => ({ ...current, folderLabel: event.target.value }))} />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="desk-label">Nome</Label>
                  <Input id="desk-label" value={form.label} onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="desk-url">Endereco</Label>
                  <Input id="desk-url" type="url" placeholder="https://" value={form.url} onChange={(event) => setForm((current) => ({ ...current, url: event.target.value }))} />
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialog(null)}>Cancelar</Button>
              <Button onClick={() => {
                if (dialog?.type === 'edit-shortcut' && dialog.item) {
                  scheduleChange(dialog.item.id, {
                    label: form.label || dialog.item.label,
                    url: form.url || dialog.item.url,
                    shortcutKind: form.mode || dialog.item.shortcutKind || 'link',
                    projectId: currentFolderProject.projectId || dialog.item.projectId || '',
                    projectName: currentFolderProject.projectName || dialog.item.projectName || '',
                  }, 0);
                  setDialog(null);
                  return;
                }
                submitAdd();
              }}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={dialog?.type === 'rename-project'} onOpenChange={(value) => !value && setDialog(null)}>
          <DialogContent className="z-[130]">
            <DialogHeader>
              <DialogTitle>Renomear pasta da Mesa</DialogTitle>
              <DialogDescription>O nome do projeto real nao sera alterado.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="rename-folder">Nome exibido</Label>
              <Input id="rename-folder" value={form.folderLabel} onChange={(event) => setForm((current) => ({ ...current, folderLabel: event.target.value }))} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialog(null)}>Cancelar</Button>
              <Button onClick={() => {
                if (!dialog?.item) return;
                scheduleChange(dialog.item.id, { label: form.folderLabel || dialog.item.projectName }, 0);
                setDialog(null);
              }}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={dialog?.type === 'move-note'} onOpenChange={(value) => !value && setDialog(null)}>
          <DialogContent className="z-[130]">
            <DialogHeader>
              <DialogTitle>Mover para projeto</DialogTitle>
              <DialogDescription>Escolha onde esta nota deve aparecer ao abrir a pasta.</DialogDescription>
            </DialogHeader>
            {dialog?.type === 'move-note' && (
              <div className="space-y-2">
                <Label>Projeto</Label>
                <select
                  className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                  defaultValue={String(dialog.note.projectId || '')}
                  onChange={(event) => {
                    const value = event.target.value;
                    const project = projects.find((entry) => String(entry.id) === value);
                    if (dialog.note.isDraft) {
                      setItems((current) => current.map((entry) => (entry.id === dialog.note.id ? { ...entry, projectId: value ? Number(value) : '', projectName: project?.name || '' } : entry)));
                    } else {
                      scheduleChange(dialog.note.id, {
                        projectId: value ? Number(value) : '',
                        projectName: project?.name || '',
                      }, 0);
                    }
                  }}
                >
                  <option value="">Sem projeto</option>
                  {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                </select>
              </div>
            )}
            <DialogFooter><Button onClick={() => setDialog(null)}>Salvar</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={dialog?.type === 'color-note'} onOpenChange={(value) => !value && setDialog(null)}>
          <DialogContent className="z-[130]">
            <DialogHeader>
              <DialogTitle>Mudar cor da nota</DialogTitle>
              <DialogDescription>Cores suaves para manter a mesa tranquila.</DialogDescription>
            </DialogHeader>
            {dialog?.type === 'color-note' && (
              <div className="grid grid-cols-7 gap-2">
                {Object.entries(NOTE_COLORS).map(([name, color]) => (
                  <button
                    key={name}
                    type="button"
                    aria-label={`Cor ${color.label}`}
                    className="h-10 rounded-full border border-black/15"
                    style={{ backgroundColor: color.body, boxShadow: `inset 0 10px 0 ${color.band}` }}
                    onClick={() => {
                      if (dialog.note.isDraft) {
                        setItems((current) => current.map((entry) => (entry.id === dialog.note.id ? { ...entry, color: name } : entry)));
                      } else {
                        scheduleChange(dialog.note.id, { color: name }, 0);
                      }
                      setDialog(null);
                    }}
                  />
                ))}
              </div>
            )}
            <DialogFooter><Button variant="outline" onClick={() => setDialog(null)}>Cancelar</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={dialog?.type === 'transform'} onOpenChange={(value) => !value && setDialog(null)}>
          <DialogContent className="z-[130]">
            <DialogHeader>
              <DialogTitle>Transformar em...</DialogTitle>
              <DialogDescription>Escolha o destino desta nota sem perder o contexto.</DialogDescription>
            </DialogHeader>
            {dialog?.type === 'transform' && (
              <div className="grid gap-2">
                {TRANSFORM_OPTIONS.map((option) => (
                  <Button key={option.id} variant="outline" className="justify-start" disabled={isTransforming} onClick={() => transformNote(option.id, dialog.note)}>
                    {option.label}
                  </Button>
                ))}
              </div>
            )}
            <DialogFooter><Button variant="outline" onClick={() => setDialog(null)}>Cancelar</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={dialog?.type === 'confirm-delete'} onOpenChange={(value) => !value && setDialog(null)}>
          <DialogContent className="z-[130]">
            <DialogHeader>
              <DialogTitle>Excluir item</DialogTitle>
              <DialogDescription>Esta acao remove o item da sua Mesa. Deseja continuar?</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialog(null)}>Cancelar</Button>
              <Button variant="destructive" onClick={() => {
                if (dialog?.item) removeItem(dialog.item);
                setDialog(null);
              }}>Excluir</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={dialog?.type === 'pick-project-material'} onOpenChange={(value) => !value && setDialog(null)}>
          <DialogContent className="z-[130]">
            <DialogHeader>
              <DialogTitle>Material do projeto</DialogTitle>
              <DialogDescription>Escolha um material existente para abrir diretamente pela Mesa.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                value={materialPicker.query}
                onChange={(event) => setMaterialPicker((current) => ({ ...current, query: event.target.value }))}
                placeholder="Buscar material por nome"
              />
              <div className="flex flex-wrap gap-2">
                {MATERIAL_PICKER_TYPES.map((type) => {
                  const count = materialPicker.options.filter((option) => type.id === 'all' || option.sourceType === type.id).length;
                  const active = materialPicker.type === type.id;
                  return (
                    <button
                      key={type.id}
                      type="button"
                      className={`rounded-md border px-2.5 py-1 text-xs ${active ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground'}`}
                      onClick={() => setMaterialPicker((current) => ({ ...current, type: type.id }))}
                    >
                      {type.label} ({count})
                    </button>
                  );
                })}
              </div>
              <div className="max-h-[320px] space-y-2 overflow-y-auto rounded-md border border-border p-2">
                {materialPicker.options
                  .filter((option) => materialPicker.type === 'all' || option.sourceType === materialPicker.type)
                  .filter((option) => normalize(option.label).includes(normalize(materialPicker.query)))
                  .map((option) => {
                    const selected = option.value === materialPicker.selected;
                    const iconSource = { sourceType: option.sourceType, label: option.label };
                    const Icon = fileIcon(iconSource);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={`flex w-full items-start gap-2 rounded-md border px-2 py-2 text-left ${selected ? 'border-primary/50 bg-primary/10' : 'border-transparent hover:border-border hover:bg-muted/40'}`}
                        onClick={() => setMaterialPicker((current) => ({ ...current, selected: option.value }))}
                      >
                        <Icon className="mt-0.5 h-4 w-4 text-muted-foreground" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{option.label}</span>
                          <span className="block truncate text-xs text-muted-foreground">{option.subtitle}</span>
                        </span>
                      </button>
                    );
                  })}
                {materialPicker.options
                  .filter((option) => materialPicker.type === 'all' || option.sourceType === materialPicker.type)
                  .filter((option) => normalize(option.label).includes(normalize(materialPicker.query)))
                  .length === 0 && (
                    <p className="py-4 text-center text-sm text-muted-foreground">Nenhum material encontrado neste filtro.</p>
                  )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialog(null)}>Cancelar</Button>
              <Button onClick={() => {
                const filtered = materialPicker.options
                  .filter((option) => materialPicker.type === 'all' || option.sourceType === materialPicker.type)
                  .filter((option) => normalize(option.label).includes(normalize(materialPicker.query)));
                const selectedId = materialPicker.selected || filtered[0]?.value || '';
                if (!selectedId) {
                  setDialog(null);
                  return;
                }
                const selected = projectReferenceItems.find((item) => item.id === selectedId);
                if (!selected) {
                  setDialog(null);
                  return;
                }
                openProjectReference(selected);
                setDialog(null);
              }}>Abrir</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={dialog?.type === 'confirm-delete-source'} onOpenChange={(value) => !value && setDialog(null)}>
          <DialogContent className="z-[130]">
            <DialogHeader>
              <DialogTitle>Excluir material real do projeto</DialogTitle>
              <DialogDescription>Esta acao apaga o registro original em Projetos. Use "Ocultar na Mesa" se quiser apenas remover a referencia visual.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialog(null)}>Cancelar</Button>
              <Button variant="destructive" onClick={() => {
                if (dialog?.item) {
                  const removed = deleteReferencedSource(dialog.item);
                  if (!removed) {
                    toast.error('Nao foi possivel excluir o material do projeto.');
                  } else {
                    toast.success('Material excluido do projeto.');
                    reloadProjectReferences(dialog.item.projectName || currentFolder);
                  }
                }
                setDialog(null);
              }}>Excluir material</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={dialog?.type === 'archived'} onOpenChange={(value) => !value && setDialog(null)}>
          <DialogContent className="z-[130] max-w-xl">
            <DialogHeader><DialogTitle>Arquivadas</DialogTitle><DialogDescription>Restaure uma nota para voltar para a Mesa.</DialogDescription></DialogHeader>
            <div className="max-h-[55vh] space-y-2 overflow-y-auto">
              {archivedItems.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma nota arquivada.</p>}
              {archivedItems.map((item) => (
                <div key={item.id} className="flex items-center gap-3 rounded-md border border-border p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{noteDisplayTitle(item)}</p>
                    <p className="truncate text-sm text-muted-foreground">{item.content || 'Sem conteudo'}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => restoreArchived(item)}>Restaurar</Button>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </section>
    </TooltipProvider>
  );
}

export function MyDeskHost({ children }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const scrollRef = useRef(0);

  useEffect(() => {
    if (!open) return undefined;
    scrollRef.current = window.scrollY;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
      requestAnimationFrame(() => {
        window.scrollTo(0, scrollRef.current);
        triggerRef.current?.focus();
      });
    };
  }, [open]);

  return (
    <MyDeskContext.Provider value={{ open, setOpen, triggerRef }}>
      <div inert={open ? '' : undefined} aria-hidden={open ? 'true' : undefined}>{children}</div>
      <MyDesk open={open} onClose={() => setOpen(false)} />
    </MyDeskContext.Provider>
  );
}

export function MyDeskLauncher() {
  const desk = useContext(MyDeskContext);
  if (!desk || desk.open) return null;

  return (
    <TooltipProvider delayDuration={250}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button ref={desk.triggerRef} type="button" className="desk-launcher" aria-label="Abrir Minha mesa" onClick={() => desk.setOpen(true)}>
            <span className="desk-launcher-label">Minha mesa</span>
            <span className="desk-launcher-icon"><Folder className="h-6 w-6" /></span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="left">Minha mesa</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
