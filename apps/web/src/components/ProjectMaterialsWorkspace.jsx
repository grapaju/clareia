import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronRight,
  Cloud,
  FileText,
  Folder,
  LayoutGrid,
  Link2,
  List,
  Lock,
  MoreHorizontal,
  NotebookText,
  Plus,
  Search,
  Star,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  filterProjectItems,
  formatMaterialFileSize,
  getFavoriteProjectItems,
  getMaterialFilterOptions,
  getMaterialMimeLabel,
  getMaterialsEmptyState,
  getRecentProjectItems,
  searchProjectItems,
} from '@/lib/projectMaterialsLogic.js';
import { readUserScopedJson, writeUserScopedJson } from '@/lib/userScopedStorage.js';

const VIEW_MODE_KEY = 'clareia_material_view_mode_v1';

const ITEM_ICONS = {
  file: FileText,
  link: Link2,
  note: NotebookText,
  access: Lock,
  drive: Cloud,
};

function ItemCard({ item, viewMode, onOpen, onEdit, onDelete, onToggleFavorite }) {
  const ItemIcon = ITEM_ICONS[item.kind] || FileText;
  const canFavorite = item.entity !== 'access';

  return (
    <div className={`border border-border bg-card ${viewMode === 'grid' ? 'p-4' : 'p-3'} rounded-lg min-w-0`}>
      <div className="flex items-start justify-between gap-3">
        <button type="button" className="flex min-w-0 flex-1 items-start gap-3 text-left" onClick={() => onOpen(item)}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
            <ItemIcon className="h-4 w-4 text-muted-foreground" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-foreground">{item.title}</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {getMaterialMimeLabel(item.mimeType) || item.typeLabel}
              {item.size ? ` · ${formatMaterialFileSize(item.size)}` : ''}
              {item.folder ? ` · ${item.folder}` : ''}
            </span>
            {item.description && <span className="mt-1 block line-clamp-2 text-xs text-muted-foreground">{item.description}</span>}
            <span className="mt-2 block text-xs font-medium text-primary">Abrir</span>
          </span>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`Ações de ${item.title}`}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onOpen(item)}>Abrir</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(item)}>Editar</DropdownMenuItem>
            {canFavorite && (
              <DropdownMenuItem onClick={() => onToggleFavorite(item)}>
                {item.favorite ? 'Desfavoritar' : 'Favoritar'}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={() => onDelete(item)}>Excluir</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function ItemCollection({ items, viewMode, onOpen, onEdit, onDelete, onToggleFavorite }) {
  return (
    <div className={viewMode === 'grid' ? 'grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3' : 'space-y-2'}>
      {items.map((item) => (
        <ItemCard
          key={`${item.entity}-${item.id}`}
          item={item}
          viewMode={viewMode}
          onOpen={onOpen}
          onEdit={onEdit}
          onDelete={onDelete}
          onToggleFavorite={onToggleFavorite}
        />
      ))}
    </div>
  );
}

export default function ProjectMaterialsWorkspace({
  items,
  folders,
  folderPathMap,
  folderItemCounters,
  currentFolder,
  currentFolderPath,
  currentFolderBreadcrumb = [],
  foldersInCurrentLevel,
  driveState,
  driveFolder,
  onAdd,
  onOpenFolder,
  onBackFolder,
  onEditFolder,
  onDeleteFolder,
  onOpenDrive,
  onOpenDriveFolder,
  onDisconnectDriveFolder,
  onRetryDrive,
  onOpenItem,
  onEditItem,
  onDeleteItem,
  onToggleFavorite,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [viewMode, setViewMode] = useState(() => readUserScopedJson(VIEW_MODE_KEY, 'grid'));

  useEffect(() => {
    writeUserScopedJson(VIEW_MODE_KEY, viewMode);
  }, [viewMode]);

  const allItemsInFolder = useMemo(() => filterProjectItems(items, 'all', currentFolderPath), [items, currentFolderPath]);
  const itemsInFolder = useMemo(() => filterProjectItems(allItemsInFolder, typeFilter), [allItemsInFolder, typeFilter]);
  const searchResults = useMemo(() => searchProjectItems(items, folders, searchTerm, typeFilter), [items, folders, searchTerm, typeFilter]);
  const recentItems = useMemo(() => getRecentProjectItems(items, 6), [items]);
  const favoriteItems = useMemo(() => getFavoriteProjectItems(items, 6), [items]);
  const filterOptions = useMemo(() => getMaterialFilterOptions(allItemsInFolder), [allItemsInFolder]);

  const renderDriveStatus = () => {
    if (driveState.state === 'error') {
      return (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>{driveState.label}</span>
          <Button size="sm" variant="outline" onClick={onRetryDrive}>Tentar novamente</Button>
        </div>
      );
    }

    if (driveState.state === 'disconnected') {
      return (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Cloud className="h-4 w-4" />
          <span>{driveState.label}</span>
          <Button size="sm" variant="outline" onClick={onOpenDrive}>Conectar Google Drive</Button>
        </div>
      );
    }

    if (driveState.state === 'attention') {
      return (
        <div className="flex flex-wrap items-center gap-2 text-sm text-amber-700">
          <Cloud className="h-4 w-4" />
          <span>{driveState.label}</span>
          <Button size="sm" variant="outline" onClick={onOpenDrive}>Reconectar</Button>
        </div>
      );
    }

    return (
      <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <CheckCircle2 className="h-4 w-4 text-primary" />
        <span className="text-foreground">{driveState.label}</span>
        {driveFolder ? (
          <button type="button" className="truncate text-primary underline-offset-4 hover:underline" onClick={onOpenDriveFolder}>
            Pasta: {driveFolder.folderName}
          </button>
        ) : (
          <Button size="sm" variant="outline" onClick={onOpenDrive}>Escolher pasta</Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Configurações do Google Drive">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onOpenDrive}>{driveFolder ? 'Alterar pasta' : 'Escolher pasta'}</DropdownMenuItem>
            {driveFolder && <DropdownMenuItem onClick={onOpenDriveFolder}>Abrir no Drive</DropdownMenuItem>}
            {driveFolder && <DropdownMenuItem onClick={onDisconnectDriveFolder}>Desvincular pasta</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  const hasAnyContent = items.length > 0;
  const hasFolders = folders.length > 0;
  const emptyState = getMaterialsEmptyState({ folderCount: folders.length, currentFolder, hasAnyContent });

  return (
    <div className="min-w-0 space-y-5">
      <Card className="border-border bg-card shadow-sm">
        <CardContent className="space-y-4 p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-xl font-medium text-foreground">Materiais</h2>
              <p className="mt-1 text-sm text-muted-foreground">Arquivos, links, notas e referências deste projeto.</p>
            </div>
            <Button onClick={() => onAdd(hasFolders ? 'choose' : 'folder')}>
              <Plus className="mr-2 h-4 w-4" /> {hasFolders ? 'Adicionar' : 'Criar primeira pasta'}
            </Button>
          </div>
          <div className="relative max-w-2xl">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="pl-9"
              placeholder="Buscar materiais, notas, links e acessos..."
            />
          </div>
          {renderDriveStatus()}
        </CardContent>
      </Card>

      {searchResults ? (
        <Card className="border-border bg-card shadow-sm">
          <CardContent className="space-y-4 p-5 sm:p-6">
            <div>
              <h3 className="font-medium">Resultados</h3>
              <p className="text-sm text-muted-foreground">{searchResults.folders.length + searchResults.items.length} encontrado(s)</p>
            </div>
            {searchResults.folders.length > 0 && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {searchResults.folders.map((folder) => (
                  <button key={folder.id} type="button" onClick={() => onOpenFolder(folder.id)} className="rounded-lg border border-border bg-background p-4 text-left hover:bg-muted/50">
                    <Folder className="mb-3 h-5 w-5 text-primary" />
                    <span className="block text-sm font-medium">{folder.name}</span>
                    <span className="text-xs text-muted-foreground">Pasta</span>
                  </button>
                ))}
              </div>
            )}
            {searchResults.items.length > 0 && (
              <ItemCollection items={searchResults.items} viewMode="list" onOpen={onOpenItem} onEdit={onEditItem} onDelete={onDeleteItem} onToggleFavorite={onToggleFavorite} />
            )}
            {searchResults.folders.length === 0 && searchResults.items.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">Nenhum item corresponde à busca.</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="border-border bg-card shadow-sm">
            <CardContent className="space-y-4 p-5 sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <nav className="flex min-w-0 flex-wrap items-center gap-1 text-sm" aria-label="Caminho das pastas">
                  <button type="button" className={currentFolder ? 'text-muted-foreground hover:text-foreground' : 'font-medium text-foreground'} onClick={() => onOpenFolder(null)}>Materiais</button>
                  {currentFolderBreadcrumb.map((folder) => (
                    <React.Fragment key={folder.id}>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <button type="button" className="max-w-48 truncate font-medium text-foreground hover:text-primary" onClick={() => onOpenFolder(folder.id)}>{folder.name}</button>
                    </React.Fragment>
                  ))}
                </nav>
                <div className="flex gap-2">
                  {currentFolder && <Button size="sm" variant="outline" onClick={onBackFolder}>Voltar</Button>}
                  {hasFolders && (
                    <Button size="sm" variant="outline" onClick={() => onAdd('folder')}>
                      <Plus className="mr-2 h-4 w-4" /> Nova pasta
                    </Button>
                  )}
                </div>
              </div>
              {!hasFolders ? (
                <div className="rounded-lg border border-dashed border-border bg-muted/20 px-5 py-10 text-center">
                  <Folder className="mx-auto h-7 w-7 text-primary" />
                  <h3 className="mt-3 font-medium">{emptyState.title}</h3>
                  <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{emptyState.description}</p>
                  <Button className="mt-4" size="sm" onClick={() => onAdd(emptyState.actionType)}><Plus className="mr-2 h-4 w-4" /> {emptyState.action}</Button>
                </div>
              ) : foldersInCurrentLevel.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {foldersInCurrentLevel.map((folder) => (
                    <div key={folder.id} className="rounded-lg border border-border bg-background p-4 transition-colors hover:bg-muted/40">
                      <div className="flex items-start justify-between gap-2">
                        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onOpenFolder(folder.id)}>
                          <Folder className="mb-3 h-5 w-5 text-primary" />
                          <span className="block truncate text-sm font-medium">{folder.name}</span>
                          <span className="text-xs text-muted-foreground">{folderItemCounters[folder.id] || 0} item(ns)</span>
                        </button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Ações da pasta ${folder.name}`}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onOpenFolder(folder.id)}>Abrir</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onEditFolder(folder)}>Renomear</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={() => onDeleteFolder(folder.id)}>Excluir</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma subpasta neste nível.</p>
              )}
            </CardContent>
          </Card>

          {!currentFolder && recentItems.length > 0 && (
            <Card className="border-border bg-card shadow-sm">
              <CardContent className="space-y-3 p-5 sm:p-6">
                <div>
                  <h3 className="font-medium">Recentes</h3>
                  <p className="text-xs text-muted-foreground">Adicionados ou atualizados recentemente</p>
                </div>
                <ItemCollection items={recentItems} viewMode="list" onOpen={onOpenItem} onEdit={onEditItem} onDelete={onDeleteItem} onToggleFavorite={onToggleFavorite} />
              </CardContent>
            </Card>
          )}

          {!currentFolder && favoriteItems.length > 0 && (
            <Card className="border-border bg-card shadow-sm">
              <CardContent className="space-y-3 p-5 sm:p-6">
                <h3 className="flex items-center gap-2 font-medium"><Star className="h-4 w-4 text-primary" /> Favoritos</h3>
                <ItemCollection items={favoriteItems} viewMode="list" onOpen={onOpenItem} onEdit={onEditItem} onDelete={onDeleteItem} onToggleFavorite={onToggleFavorite} />
              </CardContent>
            </Card>
          )}

          {hasFolders && (
            <Card className="border-border bg-card shadow-sm">
              <CardContent className="space-y-4 p-5 sm:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="font-medium">{currentFolder ? 'Conteúdo da pasta' : 'Todos os materiais'}</h3>
                  <div className="flex gap-1">
                    <Button variant={viewMode === 'grid' ? 'secondary' : 'ghost'} size="icon" onClick={() => setViewMode('grid')} aria-label="Exibir em grade"><LayoutGrid className="h-4 w-4" /></Button>
                    <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="icon" onClick={() => setViewMode('list')} aria-label="Exibir em lista"><List className="h-4 w-4" /></Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {filterOptions.map((option) => (
                    <Button key={option.value} size="sm" variant={typeFilter === option.value ? 'default' : 'outline'} onClick={() => setTypeFilter(option.value)}>
                      {option.label} <span className="ml-1 opacity-70">{option.count}</span>
                    </Button>
                  ))}
                </div>
                {itemsInFolder.length > 0 ? (
                  <ItemCollection items={itemsInFolder} viewMode={viewMode} onOpen={onOpenItem} onEdit={onEditItem} onDelete={onDeleteItem} onToggleFavorite={onToggleFavorite} />
                ) : (
                  <div className="rounded-lg border border-dashed border-border bg-muted/20 px-5 py-9 text-center">
                    <h4 className="text-sm font-medium">{emptyState.title}</h4>
                    <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{emptyState.description}</p>
                    <Button className="mt-4" size="sm" onClick={() => onAdd(emptyState.actionType)}><Plus className="mr-2 h-4 w-4" /> {emptyState.action}</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
