import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import {
  ArrowLeft,
  Cloud,
  CheckCircle2,
  ChevronRight,
  FileText,
  Folder,
  FolderKanban,
  GitMerge,
  History,
  Image,
  Link2,
  List,
  Lock,
  MoreHorizontal,
  NotebookText,
  Plus,
  Search,
  Star,
  Trash2
} from 'lucide-react';
import Header from '@/components/Header.jsx';
import Sidebar from '@/components/Sidebar.jsx';
import MobileNav from '@/components/MobileNav.jsx';
import TaskCard from '@/components/TaskCard.jsx';
import TaskModal from '@/components/TaskModal.jsx';
import ManualTimeDialog from '@/components/ManualTimeDialog.jsx';
import ProjectMaterialsWorkspace from '@/components/ProjectMaterialsWorkspace.jsx';
import { useTaskContext } from '@/hooks/useTaskContext.js';
import { useProfessionalJourney } from '@/contexts/ProfessionalJourneyContext.jsx';
import { getTaskWorkedMinutes, isTaskArchivedStatus, isTaskCompletedStatus, isTaskOpenStatus, normalizeTaskStatus, TASK_STATUS } from '@/lib/taskExecution.js';
import { getTaskNextActionPresentation } from '@/lib/todayViewLogic.js';
import { readUserScopedJson, writeUserScopedJson } from '@/lib/userScopedStorage.js';
import { buildProjectItems, getDrivePresentationState } from '@/lib/projectMaterialsLogic.js';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import {
  PROJECT_TYPE_OPTIONS,
  createProjectFolder,
  deleteProjectFolder,
  listProjectFolders,
  updateProjectFolder
} from '@/services/projectFolderService.js';
import { createProjectFile, deleteProjectFile, listProjectFiles, updateProjectFile } from '@/services/projectFileService.js';
import {
  deleteProjectDriveConfig,
  extractDriveFolderId,
  getProjectDriveConfig,
  getDriveDefaultSubfoldersByType,
  renameProjectDriveConfig
} from '@/services/projectDriveConfigService.js';
import {
  bootstrapGoogleDriveProjectFolders,
  getGoogleDriveAuthUrl,
  getGoogleDriveProjectFolderConfig,
  getGoogleDriveStatus,
  removeGoogleDriveProjectFolderConfig,
  saveGoogleDriveDefaultParentFolder,
  saveGoogleDriveProjectFolderConfig,
  syncGoogleDriveDocument
} from '@/services/googleDriveIntegrationService.js';
import { createProjectLink, deleteProjectLink, getProjectLinkTypes, listFavoriteProjectLinks, listProjectLinks, updateProjectLink } from '@/services/projectLinkService.js';
import { createProjectAccess, deleteProjectAccess, listProjectAccesses, updateProjectAccess } from '@/services/projectAccessService.js';
import { createProjectNote, deleteProjectNote, listProjectNotes, listRecentProjectNotes, updateProjectNote } from '@/services/projectNoteService.js';
import { listProjectWaitingReturns } from '@/services/waitingReturnService.js';
import { deleteWorkSession, getWorkTimeSummary, listProjectWorkSessions, reassignProjectWorkSessions, toHours, updateWorkSession } from '@/services/workSessionService.js';
import { getTaskLastCompletionDate, reassignTaskHistoryProject } from '@/services/taskHistoryService.js';
import {
  createProjectProfileApi,
  deleteProjectProfileApi,
  listProjectProfilesApi,
  mergeProjectProfilesApi,
  updateProjectProfileApi
} from '@/services/projectProfilesApiService.js';

const LEGACY_PROJECT_PROFILES_KEY = 'clareia_project_profiles_v1';
const PROJECT_HISTORY_KEY = 'clareia_project_history_v1';

function readProjectProfiles() {
  return readUserScopedJson(LEGACY_PROJECT_PROFILES_KEY, []);
}

function writeProjectProfiles(items) {
  writeUserScopedJson(LEGACY_PROJECT_PROFILES_KEY, items);
}

function readProjectHistory() {
  return readUserScopedJson(PROJECT_HISTORY_KEY, {});
}

function writeProjectHistory(items) {
  writeUserScopedJson(PROJECT_HISTORY_KEY, items);
}

function nowIso() {
  return new Date().toISOString();
}

function formatDateTime(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function normalizeText(value) {
  return String(value || '').trim();
}

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function containsText(value, term) {
  return String(value || '').toLocaleLowerCase('pt-BR').includes(term);
}

function getQuickLinkLabel(link) {
  const type = String(link?.type || '').toLocaleLowerCase('pt-BR');
  const title = String(link?.title || '').toLocaleLowerCase('pt-BR');
  const url = String(link?.url || '').toLocaleLowerCase('pt-BR');

  if (type.includes('google ads') || title.includes('google ads') || url.includes('ads.google')) return 'Abrir Google Ads';
  if (type.includes('drive') || title.includes('drive') || url.includes('drive.google')) return 'Abrir Drive';
  if (type.includes('site') || title.includes('site')) return 'Abrir site';
  if (type.includes('painel') || title.includes('painel') || title.includes('admin')) return 'Abrir painel';
  if (type.includes('canva') || title.includes('canva') || url.includes('canva.com')) return 'Abrir Canva';
  if (type.includes('github') || title.includes('github') || url.includes('github.com')) return 'Abrir GitHub';
  return null;
}

function buildFolderPathMap(folderItems) {
  const byId = new Map(folderItems.map((item) => [item.id, item]));
  const cache = {};

  const buildPath = (id) => {
    if (!id || !byId.has(id)) return '';
    if (cache[id]) return cache[id];

    const folder = byId.get(id);
    const parentPath = folder.parentId ? buildPath(folder.parentId) : '';
    const path = parentPath ? `${parentPath}/${folder.name}` : folder.name;
    cache[id] = path;
    return path;
  };

  folderItems.forEach((folder) => {
    cache[folder.id] = buildPath(folder.id);
  });

  return cache;
}

function getMaterialIcon(materialType) {
  const type = String(materialType || '').toLocaleLowerCase('pt-BR');
  if (type.includes('imagem') || type.includes('print') || type.includes('jpg') || type.includes('png')) return Image;
  if (type.includes('link')) return Link2;
  if (type.includes('nota')) return NotebookText;
  if (type.includes('acesso')) return Lock;
  if (type.includes('drive') || type.includes('google')) return Cloud;
  if (type.includes('modelo') || type.includes('refer')) return Star;
  return FileText;
}

function getMaterialTypeGroup(material) {
  const type = String(material?.materialType || material?.type || '').toLocaleLowerCase('pt-BR');
  const provider = String(material?.provider || material?.storageProvider || '').toLocaleLowerCase('pt-BR');
  if (type.includes('drive') || type.includes('google') || provider.includes('google_drive')) return 'drive';
  if (type.includes('imagem') || type.includes('print') || type.includes('jpg') || type.includes('png') || type.includes('jpeg') || type.includes('webp')) return 'imagem';
  if (type.includes('link') || String(material?.storageProvider || '').toLocaleLowerCase('pt-BR') === 'external_link') return 'link';
  if (type.includes('nota')) return 'nota';
  if (type.includes('acesso')) return 'acesso';
  if (type.includes('modelo') || type.includes('refer')) return 'modelo';
  return 'documento';
}

const MATERIAL_TYPE_FILTER_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'documento', label: 'Documentos' },
  { value: 'imagem', label: 'Imagens' },
  { value: 'link', label: 'Links' },
  { value: 'nota', label: 'Notas' },
  { value: 'acesso', label: 'Acessos' },
  { value: 'drive', label: 'Drive' },
  { value: 'modelo', label: 'Modelos' }
];

export default function ProjectsPage() {
  const { tasks, addTask, completeTask, reopenTask, updateTask, refreshTasks, resumeTask, setSelectedTask, startTask } = useTaskContext();
  const { refresh: refreshProfessionalJourney } = useProfessionalJourney();
  const navigate = useNavigate();
  const lastMaterialDialogTriggerRef = useRef(null);

  const [selectedProject, setSelectedProject] = useState(null);
  const [activeTab, setActiveTab] = useState('resumo');
  const [searchTerm, setSearchTerm] = useState('');
  const [profiles, setProfiles] = useState([]);
  const [historyItems, setHistoryItems] = useState([]);

  const [newProjectForm, setNewProjectForm] = useState({ name: '', projectType: 'Administrativo', summary: '' });
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: '', projectType: 'Administrativo', summary: '',
    professionalTrackingEnabled: false, weeklyTargetMinutes: 2400,
    workDays: [1, 2, 3, 4, 5], timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  });

  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [links, setLinks] = useState([]);
  const [accesses, setAccesses] = useState([]);
  const [notes, setNotes] = useState([]);
  const [workSessions, setWorkSessions] = useState([]);
  const [taskFilter, setTaskFilter] = useState('abertas');
  const [isManualTimeOpen, setIsManualTimeOpen] = useState(false);
  const [isDeleteSessionDialogOpen, setIsDeleteSessionDialogOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState(null);
  const [isCreateTaskDialogOpen, setIsCreateTaskDialogOpen] = useState(false);
  const [isReopenTaskDialogOpen, setIsReopenTaskDialogOpen] = useState(false);
  const [reopenTaskTarget, setReopenTaskTarget] = useState(null);
  const [isGenericDeleteDialogOpen, setIsGenericDeleteDialogOpen] = useState(false);
  const [genericDeleteTarget, setGenericDeleteTarget] = useState(null);
  const [isEditSessionDialogOpen, setIsEditSessionDialogOpen] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editSessionForm, setEditSessionForm] = useState({
    title: '',
    durationMinutes: '',
    notes: ''
  });

  const [folderName, setFolderName] = useState('');
  const [newFolderParentId, setNewFolderParentId] = useState(null);
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [isNewFolderDialogOpen, setIsNewFolderDialogOpen] = useState(false);
  const [folderEditingId, setFolderEditingId] = useState(null);
  const [folderEditingName, setFolderEditingName] = useState('');
  const [isRenameFolderDialogOpen, setIsRenameFolderDialogOpen] = useState(false);
  const [fileSearchTerm, setFileSearchTerm] = useState('');
  const [materialTypeFilter, setMaterialTypeFilter] = useState('all');
  const [fileViewMode, setFileViewMode] = useState('grid');
  const [isMaterialDialogOpen, setIsMaterialDialogOpen] = useState(false);
  const [isAddMaterialDialogOpen, setIsAddMaterialDialogOpen] = useState(false);
  const [itemDialogType, setItemDialogType] = useState(null);
  const [isDriveDialogOpen, setIsDriveDialogOpen] = useState(false);
  const [isAdvancedDetailsOpen, setIsAdvancedDetailsOpen] = useState(false);
  const [editingMaterialId, setEditingMaterialId] = useState(null);
  const [projectDriveConfig, setProjectDriveConfig] = useState(null);
  const [driveConnectionStatus, setDriveConnectionStatus] = useState({ connected: false });
  const [driveLoadError, setDriveLoadError] = useState(false);
  const [driveReloadKey, setDriveReloadKey] = useState(0);
  const [isConnectingDrive, setIsConnectingDrive] = useState(false);
  const [isBootstrappingDriveFolders, setIsBootstrappingDriveFolders] = useState(false);
  const [isDisconnectingProjectDrive, setIsDisconnectingProjectDrive] = useState(false);
  const [isManualDriveSectionOpen, setIsManualDriveSectionOpen] = useState(false);
  const [isParentFolderSectionOpen, setIsParentFolderSectionOpen] = useState(false);
  const [isSyncingDriveMaterial, setIsSyncingDriveMaterial] = useState(false);
  const [driveConfigForm, setDriveConfigForm] = useState({
    folderName: '',
    parentFolderUrl: '',
    parentFolderId: '',
    driveFolderUrl: '',
    driveFolderId: '',
    status: 'conectado manualmente'
  });

  const [fileForm, setFileForm] = useState({
    materialType: 'arquivo',
    name: '',
    type: '',
    folder: '',
    description: '',
    tags: '',
    origin: '',
    externalLink: '',
    provider: 'external_link',
    driveFileId: '',
    driveFolderId: '',
    autoSyncDrive: false,
    storageProvider: 'local',
    relatedTaskId: 'none',
    favorite: false
  });

  const [linkForm, setLinkForm] = useState({
    title: '',
    url: '',
    type: 'outro',
    description: '',
    favorite: false,
    storageProvider: 'external_link',
    relatedTaskId: 'none',
    folder: ''
  });

  const [accessForm, setAccessForm] = useState({
    title: '',
    platform: '',
    url: '',
    username: '',
    notes: '',
    folder: ''
  });
  const [editingAccessId, setEditingAccessId] = useState(null);
  const [editingLinkId, setEditingLinkId] = useState(null);

  const [noteForm, setNoteForm] = useState({
    title: '',
    content: '',
    tags: '',
    relatedTaskId: 'none',
    folder: '',
    favorite: false
  });
  const [editingNoteId, setEditingNoteId] = useState(null);

  const [isDeletingProject, setIsDeletingProject] = useState(false);
  const [isRenamingProject, setIsRenamingProject] = useState(false);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [renameTargetName, setRenameTargetName] = useState('');
  const [isMergeDialogOpen, setIsMergeDialogOpen] = useState(false);
  const [mergeTargetName, setMergeTargetName] = useState('');
  const [isMergingProject, setIsMergingProject] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');

  useEffect(() => {
    let isMounted = true;

    const migrateLegacyProfilesIfNeeded = async () => {
      try {
        const remote = await listProjectProfilesApi();
        if (!isMounted) return;

        if (remote.length > 0) {
          setProfiles(remote);
          return;
        }

        const legacy = readProjectProfiles();
        if (legacy.length === 0) {
          setProfiles([]);
          return;
        }

        for (const profile of legacy) {
          const name = normalizeText(profile?.name);
          if (!name) continue;

          try {
            await createProjectProfileApi({
              name,
              summary: normalizeText(profile?.summary),
              projectType: normalizeText(profile?.projectType) || 'Administrativo',
            });
          } catch {
            // Ignora conflitos para seguir migracao dos demais registros.
          }
        }

        writeProjectProfiles([]);
        const reloaded = await listProjectProfilesApi();
        if (!isMounted) return;
        setProfiles(reloaded);
      } catch {
        if (!isMounted) return;
        setProfiles([]);
        toast.error('Nao foi possivel carregar projetos da API. Verifique se o backend foi atualizado.');
      }
    };

    migrateLegacyProfilesIfNeeded();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const url = new URL(window.location.href);
    if (url.searchParams.get('driveConnected') !== '1') return;

    toast.success('Google Drive conectado com sucesso.');
    url.searchParams.delete('driveConnected');
    url.searchParams.delete('driveProject');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }, []);

  const projectsSet = useMemo(() => {
    const set = new Set([
      ...tasks.map((item) => normalizeText(item.project)).filter(Boolean),
      ...profiles.map((item) => normalizeText(item.name)).filter(Boolean)
    ]);
    return set;
  }, [tasks, profiles]);

  const allProjects = useMemo(() => Array.from(projectsSet).sort((a, b) => a.localeCompare(b, 'pt-BR')), [projectsSet]);

  const selectedProfile = useMemo(() => profiles.find((item) => item.name === selectedProject) || null, [profiles, selectedProject]);

  useEffect(() => {
    let isMounted = true;

    const loadDriveConfig = async () => {
      if (!selectedProject) {
        if (!isMounted) return;
        setProjectDriveConfig(null);
        setDriveConnectionStatus({ connected: false });
        setDriveConfigForm({
          folderName: '',
          parentFolderUrl: '',
          parentFolderId: '',
          driveFolderUrl: '',
          driveFolderId: '',
          status: 'conectado manualmente'
        });
        return;
      }

      if (!isMounted) return;

      setProjectDriveConfig(null);
      setDriveConfigForm({
        folderName: selectedProject,
        parentFolderUrl: '',
        parentFolderId: '',
        driveFolderUrl: '',
        driveFolderId: '',
        status: 'conectado manualmente'
      });

      let status = { connected: false };
      try {
        status = await getGoogleDriveStatus();

        if (!isMounted) return;

        setDriveConnectionStatus(status || { connected: false });
        setDriveLoadError(false);
        setDriveConfigForm((current) => ({
          ...current,
          parentFolderUrl: normalizeText(status?.defaultParentFolderUrl),
          parentFolderId: normalizeText(status?.defaultParentFolderId),
        }));
      } catch {
        if (!isMounted) return;
        setDriveConnectionStatus({ connected: false });
        setDriveLoadError(true);
      }

      try {
        const apiConfig = await getGoogleDriveProjectFolderConfig(selectedProject);

        if (!isMounted) return;

        if (apiConfig?.rootFolderUrl) {
          const syncedConfig = {
            projectId: selectedProject,
            folderName: apiConfig.projectName || selectedProject,
            driveFolderId: apiConfig.rootFolderId,
            driveFolderUrl: apiConfig.rootFolderUrl,
            status: status?.connected ? 'conectado automaticamente' : 'conectado manualmente',
            connectionType: status?.connected ? 'oauth' : 'manual'
          };

          if (!isMounted) return;

          setProjectDriveConfig(syncedConfig);
          setDriveConfigForm({
            folderName: syncedConfig?.folderName || selectedProject,
            parentFolderUrl: normalizeText(status?.defaultParentFolderUrl),
            parentFolderId: normalizeText(status?.defaultParentFolderId),
            driveFolderUrl: syncedConfig?.driveFolderUrl || '',
            driveFolderId: syncedConfig?.driveFolderId || '',
            status: syncedConfig?.status || 'conectado automaticamente'
          });
        }
      } catch {
        if (!isMounted) return;
      }
    };

    loadDriveConfig();

    return () => {
      isMounted = false;
    };
  }, [selectedProject, driveReloadKey]);

  const projectTasks = useMemo(
    () => tasks.filter((item) => item.project === selectedProject && !isTaskCompletedStatus(item.status)),
    [tasks, selectedProject]
  );
  const projectTasksOpen = useMemo(() => tasks.filter((item) => item.project === selectedProject && isTaskOpenStatus(item.status)), [tasks, selectedProject]);
  const projectTasksDone = useMemo(() => tasks.filter((item) => item.project === selectedProject && isTaskCompletedStatus(item.status)), [tasks, selectedProject]);
  const projectTasksArchived = useMemo(() => tasks.filter((item) => item.project === selectedProject && isTaskArchivedStatus(item.status)), [tasks, selectedProject]);
  const projectTasksForFilter = useMemo(() => {
    if (taskFilter === 'todas') return tasks.filter((item) => item.project === selectedProject);
    if (taskFilter === 'concluidas') return projectTasksDone;
    if (taskFilter === 'arquivadas') return projectTasksArchived;
    return projectTasksOpen;
  }, [taskFilter, tasks, selectedProject, projectTasksOpen, projectTasksDone, projectTasksArchived]);

  const projectTimeSummary = useMemo(() => getWorkTimeSummary(selectedProject || 'Pessoal'), [workSessions, selectedProject]);

  const folderPathMap = useMemo(() => buildFolderPathMap(folders), [folders]);
  const folderById = useMemo(() => new Map(folders.map((folder) => [folder.id, folder])), [folders]);
  const rootFolders = useMemo(() => folders.filter((folder) => !folder.parentId), [folders]);
  const currentFolder = useMemo(() => (currentFolderId ? folderById.get(currentFolderId) || null : null), [currentFolderId, folderById]);
  const currentFolderPath = useMemo(() => {
    if (!currentFolderId || !folderPathMap[currentFolderId]) return '';
    return folderPathMap[currentFolderId];
  }, [currentFolderId, folderPathMap]);
  const currentFolderBreadcrumb = useMemo(() => {
    if (!currentFolderId) return [];
    const path = [];
    let cursor = folderById.get(currentFolderId) || null;
    while (cursor) {
      path.unshift(cursor);
      cursor = cursor.parentId ? folderById.get(cursor.parentId) || null : null;
    }
    return path;
  }, [currentFolderId, folderById]);
  const foldersInCurrentLevel = useMemo(() => {
    if (!currentFolderId) return rootFolders;
    return folders.filter((folder) => folder.parentId === currentFolderId);
  }, [currentFolderId, rootFolders, folders]);
  const materialsInCurrentFolder = useMemo(() => {
    if (!currentFolderId) return files;
    return files.filter((item) => normalizeText(item.folder) === currentFolderPath);
  }, [files, currentFolderId, currentFolderPath]);
  const filteredMaterialsInCurrentFolder = useMemo(() => {
    if (materialTypeFilter === 'all') return materialsInCurrentFolder;
    return materialsInCurrentFolder.filter((item) => getMaterialTypeGroup(item) === materialTypeFilter);
  }, [materialsInCurrentFolder, materialTypeFilter]);
  const materialTypeCounts = useMemo(() => {
    const counts = {
      all: materialsInCurrentFolder.length,
      documento: 0,
      imagem: 0,
      link: 0,
      nota: 0,
      acesso: 0,
      drive: 0,
      modelo: 0
    };

    materialsInCurrentFolder.forEach((item) => {
      const key = getMaterialTypeGroup(item);
      if (counts[key] !== undefined) {
        counts[key] += 1;
      }
    });

    return counts;
  }, [materialsInCurrentFolder]);
  const projectFilesRecent = useMemo(() => {
    const base = materialTypeFilter === 'all' ? files : files.filter((item) => getMaterialTypeGroup(item) === materialTypeFilter);
    return base.slice(0, 6);
  }, [files, materialTypeFilter]);
  const projectFilesFavorites = useMemo(() => {
    const base = files.filter((item) => Boolean(item.favorite));
    const filtered = materialTypeFilter === 'all' ? base : base.filter((item) => getMaterialTypeGroup(item) === materialTypeFilter);
    return filtered.slice(0, 6);
  }, [files, materialTypeFilter]);
  const fileSearchResults = useMemo(() => {
    const normalized = fileSearchTerm.trim().toLocaleLowerCase('pt-BR');
    if (!normalized) return null;

    const folderMatches = folders.filter((folder) => containsText(folder.name, normalized));
    const materialMatches = files.filter((item) => {
      const matchesType = materialTypeFilter === 'all' || getMaterialTypeGroup(item) === materialTypeFilter;
      if (!matchesType) return false;
      return (
        containsText(item.name, normalized) ||
        containsText(item.description, normalized) ||
        containsText(item.tags?.join(' '), normalized) ||
        containsText(item.origin, normalized) ||
        containsText(item.type, normalized) ||
        containsText(item.materialType, normalized) ||
        containsText(item.externalLink, normalized) ||
        containsText(item.url, normalized) ||
        containsText(item.provider, normalized) ||
        containsText(item.driveFileId, normalized) ||
        containsText(item.driveFolderId, normalized)
      );
    });

    return { folderMatches, materialMatches };
  }, [fileSearchTerm, folders, files, materialTypeFilter]);
  const folderSuggestions = useMemo(() => {
    if (!selectedProject) return [];

    const projectName = String(selectedProject || '').toLocaleLowerCase('pt-BR');
    const projectType = String(selectedProfile?.projectType || '').toLocaleLowerCase('pt-BR');
    const composite = [fileForm.name, fileForm.type, fileForm.description, fileForm.tags]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase('pt-BR');

    if (!composite.trim()) return [];

    const resolveFolderPath = (folderName) => {
      const normalizedTarget = String(folderName || '').toLocaleLowerCase('pt-BR');
      const folderEntry = folders.find((folder) => {
        const path = String(folderPathMap[folder.id] || '').toLocaleLowerCase('pt-BR');
        return path === normalizedTarget || path.endsWith(`/${normalizedTarget}`);
      });

      return folderEntry && folderPathMap[folderEntry.id] ? folderPathMap[folderEntry.id] : folderName;
    };

    const confidenceByScore = (score) => {
      if (score >= 9) return 'alta';
      if (score >= 6) return 'media';
      return 'baixa';
    };

    const reasonsByConfidence = {
      alta: 'Alta confianca por correspondencia forte de contexto e tipo de projeto.',
      media: 'Confianca media com base em termos principais identificados.',
      baixa: 'Confianca baixa. Revise antes de aplicar.'
    };

    // Regra especial de negocio para Expocentro com foco comercial.
    if (projectName.includes('expocentro') && /(orcamento|proposta|valor|escopo comercial)/i.test(composite)) {
      return [
        {
          folder: resolveFolderPath('Orcamentos'),
          reason: 'Arquivo com contexto comercial para Expocentro.',
          relatedTaskSuggestion: 'Enviar orcamento do sistema de Acesso para o Expocentro',
          confidence: 'alta',
          score: 10
        }
      ];
    }

    const commonRules = [
      {
        folder: 'Orcamentos',
        terms: /\b(orcamento|orçamento|proposta comercial|valor|escopo comercial)\b/i,
        reason: 'Arquivo com contexto comercial/financeiro.',
        weight: 10
      },
      {
        folder: 'Contratos',
        terms: /\b(contrato|assinatura|assinado|juridico|aditivo)\b/i,
        reason: 'Documento contratual identificado.',
        weight: 9
      },
      {
        folder: 'Reunioes',
        terms: /\b(reuniao|reunião|ata|pauta|alinhamento|kickoff|follow-up)\b/i,
        reason: 'Material de reuniao/alinhamento.',
        weight: 8
      },
      {
        folder: 'Prints',
        terms: /\b(print|captura|imagem|screenshot|evidencia visual)\b/i,
        reason: 'Arquivo de evidencia visual.',
        weight: 8
      },
      {
        folder: 'Documentos enviados',
        terms: /(enviado|envio|encaminhado)/i,
        reason: 'Documento enviado para cliente/parceiro.',
        weight: 6
      },
      {
        folder: 'Documentos recebidos',
        terms: /(recebido|recebidos|anexo recebido|material recebido)/i,
        reason: 'Documento recebido de cliente/parceiro.',
        weight: 6
      },
      {
        folder: 'Propostas',
        terms: /(proposta|apresentacao comercial|comercial)/i,
        reason: 'Conteudo de proposta comercial.',
        weight: 6
      }
    ];

    const adsRules = [
      { folder: 'Briefing', terms: /(briefing|escopo inicial|objetivo da campanha)/i, reason: 'Definicao inicial da campanha.', weight: 8 },
      { folder: 'Criativos', terms: /(criativo|arte|banner|copy|headline|anuncio)/i, reason: 'Material criativo de campanha.', weight: 8 },
      { folder: 'Prints', terms: /(print|screenshot|captura)/i, reason: 'Registro visual da campanha.', weight: 6 },
      { folder: 'Relatorios', terms: /(relatorio|kpi|resultado|desempenho|metricas)/i, reason: 'Analise de desempenho.', weight: 8 },
      { folder: 'Alteracoes realizadas', terms: /(otimizacao|alteracao|ajuste|mudanca)/i, reason: 'Historico de alteracoes da campanha.', weight: 7 }
    ];

    const systemRules = [
      { folder: 'Escopo', terms: /(escopo|requisito|backlog|levantamento)/i, reason: 'Definicao funcional/tcnica do projeto.', weight: 8 },
      { folder: 'Prints', terms: /(print|screenshot|captura)/i, reason: 'Registro visual de tela/fluxo.', weight: 6 },
      { folder: 'Documentacao', terms: /(documentacao|manual|guia|readme|especificacao)/i, reason: 'Documento tecnico/funcional.', weight: 8 },
      { folder: 'Deploy', terms: /(deploy|publicacao|release|producao)/i, reason: 'Material de deploy/publicacao.', weight: 7 },
      { folder: 'Bugs', terms: /(bug|erro|falha|incidente|correcao)/i, reason: 'Registro de erro/correcao.', weight: 8 },
      { folder: 'Acessos', terms: /(acesso|login|senha|credencial|permissao)/i, reason: 'Informacao de acesso/permissao.', weight: 7 }
    ];

    const rules = [...commonRules];
    if (projectType.includes('google ads')) {
      rules.unshift(...adsRules);
    }
    if (projectType.includes('sistema') || projectType.includes('crm')) {
      rules.unshift(...systemRules);
    }

    const ranked = rules
      .filter((rule) => rule.terms.test(composite))
      .map((rule) => {
        const score = Number(rule.weight || 6);
        const confidence = confidenceByScore(score);
        return {
          folder: resolveFolderPath(rule.folder),
          reason: `${rule.reason} ${reasonsByConfidence[confidence]}`,
          relatedTaskSuggestion: '',
          confidence,
          score
        };
      })
      .filter((item, index, array) => index === array.findIndex((entry) => entry.folder === item.folder))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    return ranked;
  }, [selectedProject, selectedProfile?.projectType, fileForm.name, fileForm.type, fileForm.description, fileForm.tags, folders, folderPathMap]);
  const folderFileCounters = useMemo(() => {
    const counters = {};
    const folderIds = folders.map((folder) => folder.id);
    folderIds.forEach((id) => {
      const folderPath = folderPathMap[id];
      counters[id] = files.filter((item) => normalizeText(item.folder) === folderPath).length;
    });
    return counters;
  }, [folders, folderPathMap, files]);
  const projectMaterialItems = useMemo(
    () => buildProjectItems({ files, links, notes, accesses }),
    [files, links, notes, accesses]
  );
  const folderItemCounters = useMemo(() => {
    const counters = {};
    folders.forEach((folder) => {
      const path = folderPathMap[folder.id];
      counters[folder.id] = projectMaterialItems.filter((item) => item.folder === path).length;
    });
    return counters;
  }, [folders, folderPathMap, projectMaterialItems]);
  const drivePresentationState = useMemo(() => getDrivePresentationState({
    connected: Boolean(driveConnectionStatus?.connected),
    projectFolder: projectDriveConfig,
    loadError: driveLoadError,
  }), [driveConnectionStatus?.connected, projectDriveConfig, driveLoadError]);
  const projectFavoriteLinks = useMemo(() => listFavoriteProjectLinks(selectedProject || '', 5), [links, selectedProject]);
  const projectRecentNotes = useMemo(() => listRecentProjectNotes(selectedProject || '', 5), [notes, selectedProject]);
  const projectMainAccesses = useMemo(() => accesses.slice(0, 5), [accesses]);
  const projectWaitingReturns = useMemo(() => listProjectWaitingReturns(selectedProject || ''), [selectedProject, historyItems.length]);
  const projectAllTasks = useMemo(() => tasks.filter((item) => item.project === selectedProject), [tasks, selectedProject]);
  const projectResumeTask = useMemo(() => {
    const openTasks = projectAllTasks.filter((item) => isTaskOpenStatus(item.status));
    return openTasks.find((item) => normalizeTaskStatus(item.status) === TASK_STATUS.PAUSADA)
      || openTasks.find((item) => normalizeTaskStatus(item.status) === TASK_STATUS.EM_ANDAMENTO)
      || openTasks.find((item) => normalizeTaskStatus(item.status) === TASK_STATUS.PENDENTE)
      || null;
  }, [projectAllTasks]);
  const projectResumeAction = useMemo(() => projectResumeTask ? getTaskNextActionPresentation(projectResumeTask) : null, [projectResumeTask]);
  const projectResumeMinutes = useMemo(() => projectResumeTask ? getTaskWorkedMinutes(projectResumeTask.id, workSessions) : 0, [projectResumeTask, workSessions]);

  const whereIStopped = useMemo(() => {
    if (!projectResumeTask) return 'Nenhuma próxima ação definida.';
    if (normalizeTaskStatus(projectResumeTask.status) === TASK_STATUS.PAUSADA) return projectResumeTask.pauseNote || projectResumeAction?.action;
    return projectResumeAction?.action || 'Nenhuma próxima ação definida.';
  }, [projectResumeAction, projectResumeTask]);

  const reminderText = useMemo(() => {
    const waiting = projectWaitingReturns.find((item) => item.status !== 'Concluido');
    if (waiting) return `Aguardando ${waiting.contactName}: ${waiting.waitingFor}`;
    if (selectedProfile?.summary) return selectedProfile.summary;
    return 'Sem lembretes cadastrados.';
  }, [projectWaitingReturns, selectedProfile]);

  const nextActionRecommended = useMemo(() => {
    if (projectResumeAction?.action) return projectResumeAction.action;
    if (selectedProfile?.summary) return 'Revisar objetivo do projeto e definir a proxima tarefa executavel.';
    return 'Cadastrar objetivo e materiais principais para organizar o inicio da execucao.';
  }, [projectResumeAction, selectedProfile]);

  const handleProjectResume = async () => {
    if (!projectResumeTask?.id) return;
    const updated = normalizeTaskStatus(projectResumeTask.status) === TASK_STATUS.PAUSADA
      ? await resumeTask(projectResumeTask.id)
      : await startTask(projectResumeTask.id);
    setSelectedTask(updated || projectResumeTask);
    navigate('/foco');
  };

  const searchResults = useMemo(() => {
    const normalized = searchTerm.trim().toLocaleLowerCase('pt-BR');
    if (!normalized) return [];

    const results = [];

    tasks.filter((item) => item.project === selectedProject).forEach((item) => {
      if (containsText(item.title, normalized) || containsText(item.nextAction, normalized)) {
        results.push({ id: `task-${item.id}`, type: 'Tarefa', label: item.title, meta: item.nextAction || 'Sem proxima acao definida' });
      }
    });

    folders.forEach((item) => {
      if (containsText(item.name, normalized)) {
        results.push({ id: `folder-${item.id}`, type: 'Pasta', label: item.name, meta: folderPathMap[item.id] || item.name });
      }
    });

    files.forEach((item) => {
      if (
        containsText(item.name, normalized) ||
        containsText(item.description, normalized) ||
        containsText(item.tags?.join(' '), normalized)
      ) {
        results.push({ id: `file-${item.id}`, type: 'Arquivo', label: item.name, meta: `${item.folder || 'Sem pasta'} • ${item.type || 'Tipo nao informado'}` });
      }
    });

    links.forEach((item) => {
      if (containsText(item.title, normalized) || containsText(item.url, normalized) || containsText(item.description, normalized)) {
        results.push({ id: `link-${item.id}`, type: 'Link', label: item.title, meta: item.url });
      }
    });

    accesses.forEach((item) => {
      if (containsText(item.title, normalized) || containsText(item.platform, normalized) || containsText(item.username, normalized)) {
        results.push({ id: `access-${item.id}`, type: 'Acesso', label: item.title, meta: `${item.platform || 'Plataforma'} • ${item.username || 'Usuario nao informado'}` });
      }
    });

    notes.forEach((item) => {
      if (containsText(item.title, normalized) || containsText(item.content, normalized) || containsText(item.tags?.join(' '), normalized)) {
        results.push({ id: `note-${item.id}`, type: 'Nota', label: item.title || 'Nota sem titulo', meta: item.content.slice(0, 90) });
      }
    });

    return results.slice(0, 30);
  }, [searchTerm, tasks, selectedProject, folders, folderPathMap, files, links, accesses, notes]);

  const projectLinkTypes = useMemo(() => getProjectLinkTypes(), []);
  const deleteImpact = useMemo(() => {
    const tasksToUnlink = tasks.filter((item) => item.project === selectedProject).length;
    const hasHistory = historyItems.length > 0 ? 1 : 0;

    return {
      tasksToUnlink,
      foldersToDelete: folders.length,
      filesToDelete: files.length,
      linksToDelete: links.length,
      accessesToDelete: accesses.length,
      notesToDelete: notes.length,
      historyToDelete: hasHistory
    };
  }, [selectedProject, tasks, folders.length, files.length, links.length, accesses.length, notes.length, historyItems.length]);

  const refreshWorkspaceData = (projectName) => {
    if (!projectName) return;
    setFolders(listProjectFolders(projectName));
    setFiles(listProjectFiles(projectName));
    setLinks(listProjectLinks(projectName));
    setAccesses(listProjectAccesses(projectName));
    setNotes(listProjectNotes(projectName));
    setWorkSessions(listProjectWorkSessions(projectName));

    const historyMap = readProjectHistory();
    setHistoryItems((historyMap[projectName] || []).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  };

  useEffect(() => {
    if (!selectedProject) return;
    refreshWorkspaceData(selectedProject);
    setCurrentFolderId(null);
    setFileSearchTerm('');
  }, [selectedProject]);

  useEffect(() => {
    if (!selectedProject) return;
    setProfileForm({
      name: selectedProfile?.name || selectedProject,
      projectType: selectedProfile?.projectType || 'Administrativo',
      summary: selectedProfile?.summary || '',
      professionalTrackingEnabled: Boolean(selectedProfile?.professionalTrackingEnabled),
      weeklyTargetMinutes: Number(selectedProfile?.weeklyTargetMinutes || 2400),
      workDays: selectedProfile?.workDays || [1, 2, 3, 4, 5],
      timezone: selectedProfile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    });

  }, [selectedProject, selectedProfile]);

  const appendHistory = (projectName, action, details) => {
    const historyMap = readProjectHistory();
    const current = historyMap[projectName] || [];
    const next = [
      {
        id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        action,
        details,
        createdAt: nowIso()
      },
      ...current
    ].slice(0, 200);

    const updatedMap = { ...historyMap, [projectName]: next };
    writeProjectHistory(updatedMap);
    setHistoryItems(next);
  };

  const saveProfile = async ({ oldName, nextProfile }) => {
    const existing = [...profiles];
    const cleanName = normalizeText(nextProfile.name);
    if (!cleanName) {
      toast.error('Informe o nome do projeto.');
      return false;
    }

    const duplicate = existing.some(
      (item) => item.name.toLowerCase() === cleanName.toLowerCase() && item.name !== oldName
    );
    if (duplicate) {
      toast.error('Ja existe um projeto com esse nome.');
      return false;
    }

    let profilePayload = null;
    try {
      if (oldName) {
        profilePayload = await updateProjectProfileApi(oldName, {
          name: cleanName,
          summary: normalizeText(nextProfile.summary),
          projectType: nextProfile.projectType || 'Administrativo',
          professionalTrackingEnabled: Boolean(nextProfile.professionalTrackingEnabled),
          weeklyTargetMinutes: Number(nextProfile.weeklyTargetMinutes || 2400),
          workDays: nextProfile.workDays || [1, 2, 3, 4, 5],
          timezone: nextProfile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        });
      } else {
        profilePayload = await createProjectProfileApi({
          name: cleanName,
          summary: normalizeText(nextProfile.summary),
          projectType: nextProfile.projectType || 'Administrativo',
        });
      }
    } catch (error) {
      toast.error(error?.message || 'Nao foi possivel salvar o projeto no servidor.');
      return false;
    }

    if (!profilePayload?.name) {
      toast.error('Nao foi possivel salvar o projeto.');
      return false;
    }

    let next = existing.filter((item) => item.name !== oldName);
    next = [profilePayload, ...next].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    setProfiles(next);
    await refreshProfessionalJourney();

    return profilePayload;
  };

  const handleCreateProject = async () => {
    if (isCreatingProject) return;
    setIsCreatingProject(true);
    const created = await saveProfile({ oldName: null, nextProfile: newProjectForm });
    setIsCreatingProject(false);

    if (!created) return;

    appendHistory(created.name, 'Projeto criado', `Tipo definido: ${created.projectType}`);
    toast.success('Projeto criado.');
    setNewProjectForm({ name: '', projectType: 'Administrativo', summary: '' });
    setIsCreateProjectOpen(false);
  };

  const handleUpdateProject = async () => {
    if (!selectedProject) return;

    const updated = await saveProfile({
      oldName: selectedProject,
      nextProfile: {
        ...profileForm,
        // Atualização do resumo deve permanecer no mesmo projeto selecionado.
        name: selectedProject
      }
    });

    if (!updated) return;

    setSelectedProject(selectedProject);
    appendHistory(selectedProject, 'Projeto atualizado', `Resumo e tipo revisados (${updated.projectType}).`);
    refreshWorkspaceData(selectedProject);
    toast.success('Dados do projeto atualizados.');
  };

  const handleSaveProjectDriveConfig = async () => {
    if (!selectedProject) return;

    const driveFolderUrl = normalizeText(driveConfigForm.driveFolderUrl);
    const driveFolderId = normalizeText(driveConfigForm.driveFolderId) || extractDriveFolderId(driveFolderUrl);

    if (!driveFolderUrl) {
      toast.error('Informe o link da pasta principal do Google Drive.');
      return false;
    }

    let saved = null;
    try {
      const persisted = await saveGoogleDriveProjectFolderConfig({
        projectId: selectedProject,
        projectName: normalizeText(driveConfigForm.folderName) || selectedProject,
        projectType: selectedProfile?.projectType || 'Administrativo',
        rootFolderId: driveFolderId,
        rootFolderUrl: driveFolderUrl,
      });

      if (!persisted?.rootFolderUrl) {
        throw new Error('Nao foi possivel persistir configuracao da pasta no servidor.');
      }

      saved = {
        projectId: selectedProject,
        folderName: persisted.projectName || selectedProject,
        driveFolderId: persisted.rootFolderId || driveFolderId,
        driveFolderUrl: persisted.rootFolderUrl,
        status: 'conectado manualmente',
        connectionType: 'manual'
      };
    } catch (error) {
      toast.error(error?.message || 'Nao foi possivel salvar a configuracao do Drive no servidor.');
      return false;
    }

    if (!saved?.driveFolderUrl) {
      toast.error('Nao foi possivel salvar a configuracao do Drive.');
      return false;
    }

    setProjectDriveConfig(saved);
    setDriveConfigForm((current) => ({
      ...current,
      folderName: saved.folderName,
      driveFolderId: saved.driveFolderId,
      status: saved.status,
      driveFolderUrl: saved.driveFolderUrl
    }));

    appendHistory(selectedProject, 'Google Drive configurado', saved.driveFolderUrl);
    toast.success('Pasta do Google Drive conectada manualmente.');
    return true;
  };

  const handleOpenProjectDriveFolder = () => {
    const targetUrl = normalizeText(driveConfigForm.driveFolderUrl) || normalizeText(projectDriveConfig?.driveFolderUrl);
    if (!targetUrl) {
      toast.error('Cadastre primeiro a pasta principal do Drive.');
      return;
    }
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  const handleDisconnectProjectDriveFolder = async () => {
    if (!selectedProject || !projectDriveConfig || isDisconnectingProjectDrive) return;

    const confirmed = window.confirm(
      'Deseja desconectar a pasta deste projeto? A conta Google continuara conectada e voce podera reconectar depois.'
    );

    if (!confirmed) return;

    try {
      setIsDisconnectingProjectDrive(true);
      await removeGoogleDriveProjectFolderConfig(selectedProject);

      setProjectDriveConfig(null);
      setDriveConfigForm((current) => ({
        ...current,
        driveFolderUrl: '',
        driveFolderId: '',
        status: 'conectado manualmente'
      }));

      appendHistory(selectedProject, 'Google Drive desconectado', 'Vinculo da pasta do projeto removido.');
      toast.success('Pasta do projeto desconectada com sucesso.');
    } catch (error) {
      toast.error(error?.message || 'Nao foi possivel desconectar a pasta do projeto.');
    } finally {
      setIsDisconnectingProjectDrive(false);
    }
  };

  const handleCreateDriveDefaultSubfolders = async () => {
    if (!selectedProject) return;

    if (driveConnectionStatus?.connected) {
      try {
        setIsBootstrappingDriveFolders(true);

        const selectedParentId = normalizeText(driveConfigForm.parentFolderId);
        const selectedParentUrl = normalizeText(driveConfigForm.parentFolderUrl);
        const currentDefaultParentId = normalizeText(driveConnectionStatus?.defaultParentFolderId);

        let parentFolderIdToUse = selectedParentId || currentDefaultParentId;

        if (selectedParentUrl && !selectedParentId) {
          toast.error('Link da pasta mae invalido. Use um link completo da pasta no Google Drive.');
          return;
        }

        if (selectedParentId && selectedParentId !== currentDefaultParentId) {
          const updatedStatus = await saveGoogleDriveDefaultParentFolder({
            parentFolderId: selectedParentId,
            parentFolderUrl: selectedParentUrl,
          });

          setDriveConnectionStatus(updatedStatus || driveConnectionStatus);
          setDriveConfigForm((current) => ({
            ...current,
            parentFolderId: normalizeText(updatedStatus?.defaultParentFolderId),
            parentFolderUrl: normalizeText(updatedStatus?.defaultParentFolderUrl),
          }));

          parentFolderIdToUse = normalizeText(updatedStatus?.defaultParentFolderId) || selectedParentId;
        }

        const result = await bootstrapGoogleDriveProjectFolders({
          projectId: selectedProject,
          projectName: normalizeText(driveConfigForm.folderName) || selectedProject,
          projectType: selectedProfile?.projectType || 'Administrativo',
          parentFolderId: parentFolderIdToUse || undefined,
        });

        if (result?.rootFolderUrl) {
          const synced = {
            projectId: selectedProject,
            driveFolderUrl: result.rootFolderUrl,
            driveFolderId: result.rootFolderId,
            folderName: result.projectName || selectedProject,
            status: 'conectado automaticamente',
            connectionType: 'oauth'
          };

          setProjectDriveConfig(synced);
          setDriveConfigForm((current) => ({
            ...current,
            folderName: synced?.folderName || selectedProject,
            driveFolderUrl: synced?.driveFolderUrl || current.driveFolderUrl,
            driveFolderId: synced?.driveFolderId || current.driveFolderId,
            status: synced?.status || 'conectado automaticamente'
          }));
        }
      } catch (error) {
        toast.error(error?.message || 'Nao foi possivel criar subpastas no Google Drive.');
      } finally {
        setIsBootstrappingDriveFolders(false);
      }
    }

    const foldersToCreate = getDriveDefaultSubfoldersByType(selectedProfile?.projectType || 'Administrativo');
    const existingNames = new Set(listProjectFolders(selectedProject).map((item) => String(item.name || '').toLocaleLowerCase('pt-BR')));

    const created = [];
    foldersToCreate.forEach((folderName) => {
      if (!existingNames.has(folderName.toLocaleLowerCase('pt-BR'))) {
        const folder = createProjectFolder({
          projectName: selectedProject,
          name: folderName,
          parentId: null
        });
        if (folder) created.push(folder.name);
      }
    });

    if (created.length === 0) {
      toast.info('As subpastas padrao ja existem neste projeto.');
      return;
    }

    refreshWorkspaceData(selectedProject);
    appendHistory(selectedProject, 'Subpastas padrao do Drive criadas', created.join(', '));
    toast.success(`${created.length} subpasta(s) criada(s).`);
  };

  const handleConnectGoogleDriveAutomatic = async () => {
    if (!selectedProject) return;

    try {
      setIsConnectingDrive(true);

      const response = await getGoogleDriveAuthUrl({
        projectId: selectedProject,
        projectName: selectedProject,
        projectType: selectedProfile?.projectType || 'Administrativo',
        returnTo: '/projects'
      });

      if (!response?.authUrl) {
        toast.error('Nao foi possivel iniciar a conexao com Google Drive.');
        return;
      }

      window.location.href = response.authUrl;
    } catch (error) {
      toast.error(error?.message || 'Falha ao iniciar a autenticacao no Google Drive.');
    } finally {
      setIsConnectingDrive(false);
    }
  };

  const buildDriveDocumentContent = () => {
    const sections = [];
    const cleanDescription = normalizeText(fileForm.description);
    const cleanOrigin = normalizeText(fileForm.origin);
    const cleanTags = toArray(fileForm.tags);

    if (cleanDescription) {
      sections.push(`Descricao: ${cleanDescription}`);
    }

    if (cleanOrigin) {
      sections.push(`Origem: ${cleanOrigin}`);
    }

    if (cleanTags.length) {
      sections.push(`Tags: ${cleanTags.join(', ')}`);
    }

    if (!sections.length) {
      sections.push(`Material do projeto ${selectedProject}.`);
    }

    return sections.join('\n\n');
  };

  const handleAddFolder = () => {
    if (!selectedProject) return;
    const folder = createProjectFolder({ projectName: selectedProject, name: folderName, parentId: newFolderParentId });
    if (!folder) {
      toast.error('Nao foi possivel criar pasta (nome vazio ou duplicado).');
      return;
    }

    setFolderName('');
    setNewFolderParentId(null);
    setIsNewFolderDialogOpen(false);
    refreshWorkspaceData(selectedProject);
    appendHistory(selectedProject, 'Pasta criada', folder.name);
  };

  const rememberMaterialDialogTrigger = () => {
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      lastMaterialDialogTriggerRef.current = document.activeElement;
    }
  };

  const restoreMaterialDialogFocus = (event) => {
    event.preventDefault();
    lastMaterialDialogTriggerRef.current?.focus();
  };

  const handleUpdateFolder = () => {
    if (!folderEditingId) return;
    const beforePathMap = buildFolderPathMap(folders);
    const oldPath = beforePathMap[folderEditingId] || '';
    const updated = updateProjectFolder(folderEditingId, { name: folderEditingName });
    if (!updated) {
      toast.error('Nao foi possivel atualizar a pasta.');
      return;
    }

    const nextFolders = listProjectFolders(selectedProject);
    const afterPathMap = buildFolderPathMap(nextFolders);
    const newPath = afterPathMap[folderEditingId] || '';

    if (oldPath && newPath && oldPath !== newPath) {
      files
        .filter((item) => {
          const folderPath = normalizeText(item.folder);
          return folderPath === oldPath || folderPath.startsWith(`${oldPath}/`);
        })
        .forEach((file) => {
          const folderPath = normalizeText(file.folder);
          updateProjectFile(file.id, { folder: folderPath.replace(oldPath, newPath) });
        });
    }

    setFolderEditingId(null);
    setFolderEditingName('');
    setIsRenameFolderDialogOpen(false);
    refreshWorkspaceData(selectedProject);
    appendHistory(selectedProject, 'Pasta editada', updated.name);
  };

  const handleDeleteFolder = (folderId) => {
    const target = folders.find((item) => item.id === folderId);
    if (!target) return;
    openGenericDeleteDialog({
      type: 'folder',
      id: folderId,
      label: target.name,
      title: 'Excluir pasta',
      description: `Esta acao remove permanentemente a pasta "${target.name}" deste projeto.`
    });
  };

  const openCreateFolderDialog = (parentId = null) => {
    rememberMaterialDialogTrigger();
    setFolderName('');
    setNewFolderParentId(parentId);
    setIsNewFolderDialogOpen(true);
  };

  const openMaterialAddFlow = (type = 'choose') => {
    if (type === 'choose') {
      rememberMaterialDialogTrigger();
      setIsAddMaterialDialogOpen(true);
      return;
    }

    setIsAddMaterialDialogOpen(false);
    setIsAdvancedDetailsOpen(false);
    setEditingLinkId(null);
    setEditingAccessId(null);
    setEditingNoteId(null);

    if (type === 'folder') {
      openCreateFolderDialog(currentFolderId);
      return;
    }

    if (type === 'file') {
      setEditingMaterialId(null);
      setIsAdvancedDetailsOpen(false);
      setFileForm({
        materialType: 'arquivo',
        name: '',
        type: 'arquivo',
        folder: currentFolderPath,
        description: '',
        tags: '',
        origin: '',
        externalLink: '',
        provider: 'external_link',
        driveFileId: '',
        driveFolderId: '',
        autoSyncDrive: false,
        storageProvider: 'external_link',
        relatedTaskId: 'none',
        favorite: false,
      });
      setIsMaterialDialogOpen(true);
      return;
    }

    if (type === 'link') {
      setLinkForm({ title: '', url: '', type: 'outro', description: '', favorite: false, storageProvider: 'external_link', relatedTaskId: 'none', folder: currentFolderPath });
    }
    if (type === 'note') {
      setNoteForm({ title: '', content: '', tags: '', relatedTaskId: 'none', folder: currentFolderPath, favorite: false });
    }
    if (type === 'access') {
      setAccessForm({ title: '', platform: '', url: '', username: '', notes: '', folder: currentFolderPath });
    }
    setItemDialogType(type);
  };

  const openRenameFolderDialog = (folder) => {
    if (!folder) return;
    setFolderEditingId(folder.id);
    setFolderEditingName(folder.name);
    setIsRenameFolderDialogOpen(true);
  };

  const openFolder = (folderId) => {
    setCurrentFolderId(folderId);
  };

  const goBackFolder = () => {
    if (!currentFolderId) return;
    const current = folderById.get(currentFolderId);
    setCurrentFolderId(current?.parentId || null);
  };

  const handleSaveMaterial = async () => {
    if (!selectedProject) return;

    const topFolderSuggestion = folderSuggestions[0] || null;
    const autoSuggestionApplied = !fileForm.folder && Boolean(topFolderSuggestion?.folder);
    const relatedTaskId = fileForm.relatedTaskId && fileForm.relatedTaskId !== 'none' ? fileForm.relatedTaskId : '';
    const selectedFolderEntry = folders.find((folder) => folderPathMap[folder.id] === fileForm.folder);
    const inferredFolder = fileForm.folder || topFolderSuggestion?.folder || '';
    const sourceUrl = normalizeText(fileForm.externalLink);
    const provider = fileForm.autoSyncDrive
      ? 'google_drive_upload_future'
      : sourceUrl.includes('drive.google.com')
        ? 'google_drive'
        : 'external_link';
    const driveFolderIdFromUrl = extractDriveFolderId(fileForm.externalLink);
    const shouldSyncInDrive =
      (provider === 'google_drive' || provider === 'google_drive_upload_future')
      && Boolean(fileForm.autoSyncDrive);

    let driveSyncResult = null;

    if (shouldSyncInDrive) {
      if (!driveConnectionStatus?.connected) {
        toast.error('Conecte o Google Drive antes de criar/atualizar documentos automaticamente.');
        return;
      }

      if (!normalizeText(fileForm.name)) {
        toast.error('Informe o nome do material para sincronizar no Google Drive.');
        return;
      }

      try {
        setIsSyncingDriveMaterial(true);
        driveSyncResult = await syncGoogleDriveDocument({
          projectId: selectedProject,
          projectName: selectedProject,
          projectType: selectedProfile?.projectType || 'Administrativo',
          driveFolderId: normalizeText(fileForm.driveFolderId) || normalizeText(projectDriveConfig?.driveFolderId) || undefined,
          driveFileId: normalizeText(fileForm.driveFileId) || undefined,
          fileName: normalizeText(fileForm.name),
          content: buildDriveDocumentContent(),
        });
      } catch (error) {
        toast.error(error?.message || 'Nao foi possivel sincronizar o documento no Google Drive.');
        return;
      } finally {
        setIsSyncingDriveMaterial(false);
      }
    }

    const payload = {
      ...fileForm,
      projectId: selectedProject,
      projectName: selectedProject,
      tags: toArray(fileForm.tags),
      relatedTaskId,
      relatedTaskIds: relatedTaskId ? [relatedTaskId] : [],
      folderId: selectedFolderEntry?.id || '',
      folder: inferredFolder,
      type: fileForm.type || fileForm.materialType,
      provider,
      storageProvider: provider,
      driveFileId: driveSyncResult?.driveFileId || fileForm.driveFileId,
      driveFolderId:
        driveSyncResult?.driveFolderId ||
        fileForm.driveFolderId ||
        projectDriveConfig?.driveFolderId ||
        driveFolderIdFromUrl ||
        '',
      url: driveSyncResult?.webViewLink || fileForm.externalLink,
      externalLink: driveSyncResult?.webViewLink || fileForm.externalLink
    };

    const created = editingMaterialId
      ? updateProjectFile(editingMaterialId, payload)
      : createProjectFile(payload);

    if (!created) {
      toast.error('Nao foi possivel salvar o material (nome e projeto sao obrigatorios).');
      return;
    }

    setFileForm({
      materialType: 'arquivo',
      name: '',
      type: '',
      folder: '',
      description: '',
      tags: '',
      origin: '',
      externalLink: '',
      provider: 'external_link',
      driveFileId: '',
      driveFolderId: '',
      autoSyncDrive: false,
      storageProvider: 'local',
      relatedTaskId: 'none',
      favorite: false
    });
    setEditingMaterialId(null);
    setIsAdvancedDetailsOpen(false);
    setIsMaterialDialogOpen(false);
    refreshWorkspaceData(selectedProject);

    const baseAction = editingMaterialId ? 'Material atualizado' : 'Material cadastrado';
    let historyDetails = created.name;
    if (driveSyncResult?.driveFileId) {
      historyDetails = `${historyDetails} | Google Drive: ${driveSyncResult.updated ? 'documento atualizado' : 'documento criado'}`;
    }
    if (autoSuggestionApplied && topFolderSuggestion) {
      const confidenceLabel = topFolderSuggestion.confidence === 'alta'
        ? 'alta'
        : topFolderSuggestion.confidence === 'media'
          ? 'media'
          : 'baixa';
      historyDetails = `${created.name} | Pasta aplicada automaticamente: ${inferredFolder} | Confianca: ${confidenceLabel} | Motivo: ${topFolderSuggestion.reason}`;
    }
    appendHistory(selectedProject, baseAction, historyDetails);
  };

  const handleEditMaterial = (material) => {
    rememberMaterialDialogTrigger();
    const materialType = String(material.materialType || material.type || 'arquivo').toLocaleLowerCase('pt-BR');
    const normalizedMaterialType = materialType.includes('link')
      ? 'link'
      : materialType.includes('nota')
        ? 'nota'
        : materialType.includes('acesso')
          ? 'acesso'
          : 'arquivo';
    const provider = material.provider || material.storageProvider || 'external_link';
    setEditingMaterialId(material.id);
    setFileForm({
      materialType: normalizedMaterialType,
      name: material.name || '',
      type: material.type || '',
      folder: material.folder || '',
      description: material.description || '',
      tags: (material.tags || []).join(', '),
      origin: material.origin || '',
      externalLink: material.url || material.externalLink || '',
      provider,
      driveFileId: material.driveFileId || '',
      driveFolderId: material.driveFolderId || '',
      autoSyncDrive: provider === 'google_drive_upload_future',
      storageProvider: material.storageProvider || 'local',
      relatedTaskId: material.relatedTaskId || material.relatedTaskIds?.[0] || 'none',
      favorite: Boolean(material.favorite)
    });
    setIsMaterialDialogOpen(true);
  };

  const handleToggleFavoriteMaterial = (material) => {
    updateProjectFile(material.id, { favorite: !material.favorite });
    refreshWorkspaceData(selectedProject);
  };

  const handleOpenMaterial = (material) => {
    const targetUrl = material.url || material.externalLink;
    if (targetUrl) {
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    toast.info('Este material nao possui link externo cadastrado.');
  };

  const handleDeleteFile = (id) => {
    const target = files.find((item) => item.id === id);
    if (!target) return;
    openGenericDeleteDialog({
      type: 'file',
      id,
      label: target.name,
      title: 'Excluir arquivo',
      description: `Esta acao remove permanentemente o arquivo "${target.name}" deste projeto.`
    });
  };

  const handleCreateLink = () => {
    if (!selectedProject) return;
    const payload = {
      ...linkForm,
      projectName: selectedProject,
      relatedTaskIds: linkForm.relatedTaskId && linkForm.relatedTaskId !== 'none' ? [linkForm.relatedTaskId] : []
    };
    const created = editingLinkId ? updateProjectLink(editingLinkId, payload) : createProjectLink(payload);

    if (!created) {
      toast.error('Nao foi possivel salvar o link (titulo e URL sao obrigatorios).');
      return;
    }

    setLinkForm({
      title: '',
      url: '',
      type: 'outro',
      description: '',
      favorite: false,
      storageProvider: 'external_link',
      relatedTaskId: 'none',
      folder: ''
    });
    setEditingLinkId(null);
    setItemDialogType(null);
    setLinks(listProjectLinks(selectedProject));
    appendHistory(selectedProject, editingLinkId ? 'Link atualizado' : 'Link cadastrado', created.title);
  };

  const handleEditLink = (link) => {
    rememberMaterialDialogTrigger();
    setEditingLinkId(link.id);
    setLinkForm({
      title: link.title || '',
      url: link.url || '',
      type: link.type || 'outro',
      description: link.description || '',
      favorite: Boolean(link.favorite),
      storageProvider: 'external_link',
      relatedTaskId: link.relatedTaskIds?.[0] || 'none',
      folder: link.folder || '',
    });
    setItemDialogType('link');
  };

  const handleDeleteLink = (id) => {
    const target = links.find((item) => item.id === id);
    if (!target) return;
    openGenericDeleteDialog({
      type: 'link',
      id,
      label: target.title,
      title: 'Excluir link',
      description: `Esta acao remove permanentemente o link "${target.title}" deste projeto.`
    });
  };

  const handleCreateAccess = () => {
    if (!selectedProject) return;
    const payload = { ...accessForm, projectName: selectedProject };
    const created = editingAccessId ? updateProjectAccess(editingAccessId, payload) : createProjectAccess(payload);
    if (!created) {
      toast.error('Nao foi possivel salvar o acesso (titulo e projeto sao obrigatorios).');
      return;
    }

    setAccessForm({ title: '', platform: '', url: '', username: '', notes: '', folder: '' });
    setEditingAccessId(null);
    setItemDialogType(null);
    setAccesses(listProjectAccesses(selectedProject));
    appendHistory(selectedProject, editingAccessId ? 'Acesso atualizado' : 'Acesso cadastrado', created.title);
  };

  const handleEditAccess = (access) => {
    rememberMaterialDialogTrigger();
    setEditingAccessId(access.id);
    setAccessForm({
      title: access.title || '',
      platform: access.platform || '',
      url: access.url || '',
      username: access.username || '',
      notes: access.notes || '',
      folder: access.folder || '',
    });
    setItemDialogType('access');
  };

  const handleDeleteAccess = (id) => {
    const target = accesses.find((item) => item.id === id);
    if (!target) return;
    openGenericDeleteDialog({
      type: 'access',
      id,
      label: target.title,
      title: 'Excluir acesso',
      description: `Esta acao remove permanentemente o acesso "${target.title}" deste projeto.`
    });
  };

  const handleCreateTaskForProject = async (taskPayload) => {
    if (!selectedProject) return;

    try {
      await addTask({
        ...taskPayload,
        project: selectedProject
      });
      setTaskFilter('abertas');
      setIsCreateTaskDialogOpen(false);
      refreshWorkspaceData(selectedProject);
      toast.success('Tarefa criada no projeto.');
    } catch (error) {
      console.error(error);
      toast.error('Nao foi possivel criar a tarefa neste projeto.');
    }
  };

  const handleCreateOrUpdateNote = () => {
    if (!selectedProject) return;

    const payload = {
      ...noteForm,
      projectName: selectedProject,
      relatedTaskIds: noteForm.relatedTaskId && noteForm.relatedTaskId !== 'none' ? [noteForm.relatedTaskId] : []
    };

    let saved = null;
    if (editingNoteId) {
      saved = updateProjectNote(editingNoteId, payload);
    } else {
      saved = createProjectNote(payload);
    }

    if (!saved) {
      toast.error('Nao foi possivel salvar a nota.');
      return;
    }

    appendHistory(selectedProject, editingNoteId ? 'Nota atualizada' : 'Nota criada', saved.title || 'Nota sem titulo');
    setEditingNoteId(null);
    setNoteForm({ title: '', content: '', tags: '', relatedTaskId: 'none', folder: '', favorite: false });
    setItemDialogType(null);
    setNotes(listProjectNotes(selectedProject));
  };

  const handleEditNote = (note) => {
    rememberMaterialDialogTrigger();
    setEditingNoteId(note.id);
    setNoteForm({
      title: note.title || '',
      content: note.content || '',
      tags: (note.tags || []).join(', '),
      relatedTaskId: note.relatedTaskIds?.[0] || 'none',
      folder: note.folder || '',
      favorite: Boolean(note.favorite)
    });
    setItemDialogType('note');
  };

  const handleDeleteNote = (id) => {
    const target = notes.find((item) => item.id === id);
    if (!target) return;
    openGenericDeleteDialog({
      type: 'note',
      id,
      label: target.title || 'Nota sem titulo',
      title: 'Excluir nota',
      description: 'Esta acao remove permanentemente a nota deste projeto.'
    });
  };

  const handleOpenProjectItem = (item) => {
    if (item.entity === 'note') {
      handleEditNote(item.source);
      return;
    }
    if (item.url) {
      window.open(item.url, '_blank', 'noopener,noreferrer');
      return;
    }
    if (item.entity === 'access' && item.source.username) {
      navigator.clipboard.writeText(item.source.username);
      toast.success('Usuário copiado.');
      return;
    }
    toast.info('Este item não possui link para abrir.');
  };

  const handleEditProjectItem = (item) => {
    if (item.entity === 'file') handleEditMaterial(item.source);
    if (item.entity === 'link') handleEditLink(item.source);
    if (item.entity === 'note') handleEditNote(item.source);
    if (item.entity === 'access') handleEditAccess(item.source);
  };

  const handleDeleteProjectItem = (item) => {
    if (item.entity === 'file') handleDeleteFile(item.id);
    if (item.entity === 'link') handleDeleteLink(item.id);
    if (item.entity === 'note') handleDeleteNote(item.id);
    if (item.entity === 'access') handleDeleteAccess(item.id);
  };

  const handleToggleFavoriteProjectItem = (item) => {
    if (item.entity === 'file') updateProjectFile(item.id, { favorite: !item.favorite });
    if (item.entity === 'link') updateProjectLink(item.id, { favorite: !item.favorite });
    if (item.entity === 'note') updateProjectNote(item.id, { favorite: !item.favorite });
    refreshWorkspaceData(selectedProject);
  };

  const openDriveDialog = () => {
    rememberMaterialDialogTrigger();
    setIsDriveDialogOpen(true);
  };

  const openEditSessionDialog = (session) => {
    if (!session) return;
    setEditingSessionId(session.id);
    setEditSessionForm({
      title: session.title || '',
      durationMinutes: String(session.durationMinutes || ''),
      notes: session.notes || ''
    });
    setIsEditSessionDialogOpen(true);
  };

  const handleSaveSessionEdit = () => {
    if (!editingSessionId) return;

    const durationMinutes = Number(editSessionForm.durationMinutes);
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      toast.error('Informe uma duracao valida em minutos.');
      return;
    }

    const updated = updateWorkSession(editingSessionId, {
      title: editSessionForm.title,
      durationMinutes: Math.round(durationMinutes),
      notes: editSessionForm.notes
    });

    if (!updated) {
      toast.error('Nao foi possivel atualizar a sessao.');
      return;
    }

    appendHistory(selectedProject, 'Sessao de tempo editada', `${updated.title || 'Sessao de trabalho'} (${updated.durationMinutes} min)`);
    refreshWorkspaceData(selectedProject);
    setIsEditSessionDialogOpen(false);
    setEditingSessionId(null);
    setEditSessionForm({ title: '', durationMinutes: '', notes: '' });
    toast.success('Sessao atualizada.');
  };

  const openGenericDeleteDialog = (target) => {
    if (!target?.type || !target?.id) return;
    setGenericDeleteTarget(target);
    setIsGenericDeleteDialogOpen(true);
  };

  const confirmGenericDelete = () => {
    if (!genericDeleteTarget?.id || !genericDeleteTarget?.type) return;

    switch (genericDeleteTarget.type) {
      case 'folder': {
        const allFolders = listProjectFolders(selectedProject);
        const pathMap = buildFolderPathMap(allFolders);
        const idsToDelete = [genericDeleteTarget.id];
        let cursor = 0;
        while (cursor < idsToDelete.length) {
          const currentId = idsToDelete[cursor];
          allFolders
            .filter((folder) => folder.parentId === currentId)
            .forEach((child) => idsToDelete.push(child.id));
          cursor += 1;
        }

        const pathsToDelete = idsToDelete.map((id) => pathMap[id]).filter(Boolean);
        files
          .filter((item) => pathsToDelete.some((path) => normalizeText(item.folder) === path || normalizeText(item.folder).startsWith(`${path}/`)))
          .forEach((file) => updateProjectFile(file.id, { folder: '' }));

        idsToDelete.forEach((id) => deleteProjectFolder(id));
        if (currentFolderId && idsToDelete.includes(currentFolderId)) {
          setCurrentFolderId(null);
        }
        refreshWorkspaceData(selectedProject);
        appendHistory(selectedProject, 'Pasta excluida', genericDeleteTarget.label || 'Pasta');
        break;
      }
      case 'file': {
        const deleted = deleteProjectFile(genericDeleteTarget.id);
        if (!deleted) break;
        setFiles(listProjectFiles(selectedProject));
        appendHistory(selectedProject, 'Arquivo removido', genericDeleteTarget.label || 'Arquivo');
        break;
      }
      case 'link': {
        const deleted = deleteProjectLink(genericDeleteTarget.id);
        if (!deleted) break;
        setLinks(listProjectLinks(selectedProject));
        appendHistory(selectedProject, 'Link removido', genericDeleteTarget.label || 'Link');
        break;
      }
      case 'access': {
        const deleted = deleteProjectAccess(genericDeleteTarget.id);
        if (!deleted) break;
        setAccesses(listProjectAccesses(selectedProject));
        appendHistory(selectedProject, 'Acesso removido', genericDeleteTarget.label || 'Acesso');
        break;
      }
      case 'note': {
        const deleted = deleteProjectNote(genericDeleteTarget.id);
        if (!deleted) break;
        if (editingNoteId === genericDeleteTarget.id) {
          setEditingNoteId(null);
          setNoteForm({ title: '', content: '', tags: '', relatedTaskId: 'none' });
        }
        setNotes(listProjectNotes(selectedProject));
        appendHistory(selectedProject, 'Nota removida', genericDeleteTarget.label || 'Nota sem titulo');
        break;
      }
      default:
        break;
    }

    setIsGenericDeleteDialogOpen(false);
    setGenericDeleteTarget(null);
  };

  const openDeleteSessionDialog = (session) => {
    if (!session) return;
    setSessionToDelete(session);
    setIsDeleteSessionDialogOpen(true);
  };

  const confirmDeleteSession = () => {
    if (!sessionToDelete?.id) return;
    deleteWorkSession(sessionToDelete.id);
    appendHistory(selectedProject, 'Sessao de tempo removida', sessionToDelete.title || 'Sessao de trabalho');
    refreshWorkspaceData(selectedProject);
    setIsDeleteSessionDialogOpen(false);
    setSessionToDelete(null);
    toast.success('Sessao excluida.');
  };

  const openReopenTaskDialog = (task) => {
    if (!task?.id) return;
    setReopenTaskTarget({
      taskId: task.id,
      taskTitle: task.title || 'Tarefa'
    });
    setIsReopenTaskDialogOpen(true);
  };

  const confirmReopenTask = async (destination) => {
    if (!reopenTaskTarget?.taskId || !destination) return;
    await reopenTask(reopenTaskTarget.taskId, destination);
    setTaskFilter('abertas');
    setIsReopenTaskDialogOpen(false);
    setReopenTaskTarget(null);
    toast.success('Tarefa reaberta com sucesso.');
  };

  const getTaskMaterials = (taskId) => {
    const relatedFiles = files.filter((item) => item.relatedTaskIds?.includes(taskId));
    const relatedLinks = links.filter((item) => item.relatedTaskIds?.includes(taskId));
    const relatedAccesses = accesses.filter((item) => item.relatedTaskIds?.includes(taskId));
    const relatedNotes = notes.filter((item) => item.relatedTaskIds?.includes(taskId));
    return { relatedFiles, relatedLinks, relatedAccesses, relatedNotes };
  };

  const getProjectStats = (projectName) => {
    const projectTasksOpen = tasks.filter((item) => item.project === projectName && isTaskOpenStatus(item.status));
    const materialsCount =
      listProjectFiles(projectName).length +
      listProjectLinks(projectName).length +
      listProjectNotes(projectName).length;

    return {
      openTasks: projectTasksOpen.length,
      materialsCount
    };
  };

  const getProjectWhereStoppedPreview = (projectName) => {
    const openTasks = tasks.filter((item) => item.project === projectName && isTaskOpenStatus(item.status));
    const paused = openTasks.find((item) => normalizeTaskStatus(item.status) === TASK_STATUS.PAUSADA);
    const next = paused || openTasks.find((item) => normalizeTaskStatus(item.status) === TASK_STATUS.EM_ANDAMENTO) || openTasks[0];
    if (!next) return '';
    const action = getTaskNextActionPresentation(next).action;
    return paused ? `Onde parou: ${paused.pauseNote || action}` : `Próximo: ${action}`;
  };

  const clearProjectWorkspaceData = (projectName) => {
    listProjectFolders(projectName).forEach((item) => deleteProjectFolder(item.id));
    listProjectFiles(projectName).forEach((item) => deleteProjectFile(item.id));
    listProjectLinks(projectName).forEach((item) => deleteProjectLink(item.id));
    listProjectAccesses(projectName).forEach((item) => deleteProjectAccess(item.id));
    listProjectNotes(projectName).forEach((item) => deleteProjectNote(item.id));
    deleteProjectDriveConfig(projectName);
  };

  const renameProjectWorkspaceData = (oldName, newName) => {
    listProjectFolders(oldName).forEach((item) => updateProjectFolder(item.id, { projectName: newName }));
    listProjectFiles(oldName).forEach((item) => updateProjectFile(item.id, { projectName: newName, projectId: newName }));
    listProjectLinks(oldName).forEach((item) => updateProjectLink(item.id, { projectName: newName }));
    listProjectAccesses(oldName).forEach((item) => updateProjectAccess(item.id, { projectName: newName }));
    listProjectNotes(oldName).forEach((item) => updateProjectNote(item.id, { projectName: newName }));
    if (getProjectDriveConfig(newName)) {
      deleteProjectDriveConfig(oldName);
    } else {
      renameProjectDriveConfig(oldName, newName);
    }
  };

  const openMergeProjectDialog = () => {
    const firstTarget = allProjects.find((projectName) => projectName !== selectedProject) || '';
    setMergeTargetName(firstTarget);
    setIsMergeDialogOpen(true);
  };

  const confirmMergeProject = async () => {
    if (!selectedProject || !mergeTargetName || selectedProject === mergeTargetName || isMergingProject) return;

    const sourceProject = selectedProject;
    const targetProject = mergeTargetName;
    setIsMergingProject(true);
    try {
      await mergeProjectProfilesApi(sourceProject, targetProject);
      renameProjectWorkspaceData(sourceProject, targetProject);
      reassignProjectWorkSessions(sourceProject, targetProject);
      reassignTaskHistoryProject(sourceProject, targetProject);

      const historyMap = readProjectHistory();
      historyMap[targetProject] = [
        ...(Array.isArray(historyMap[sourceProject]) ? historyMap[sourceProject] : []),
        ...(Array.isArray(historyMap[targetProject]) ? historyMap[targetProject] : [])
      ]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 200);
      delete historyMap[sourceProject];
      writeProjectHistory(historyMap);

      await refreshTasks();
      setProfiles((current) => current.filter((item) => item.name !== sourceProject));
      setSelectedProject(targetProject);
      setProfileForm((current) => ({ ...current, name: targetProject }));
      appendHistory(targetProject, 'Projetos mesclados', `Origem: ${sourceProject}`);
      refreshWorkspaceData(targetProject);
      setIsMergeDialogOpen(false);
      toast.success(`Conteúdo movido para ${targetProject}.`);
    } catch (error) {
      console.error(error);
      toast.error(error?.message || 'Nao foi possivel mesclar os projetos.');
    } finally {
      setIsMergingProject(false);
    }
  };

  const openRenameProjectDialog = () => {
    if (!selectedProject || isRenamingProject) return;
    setRenameTargetName(selectedProject);
    setIsRenameDialogOpen(true);
  };

  const confirmRenameProject = async () => {
    if (!selectedProject || isRenamingProject) return;

    const nextName = normalizeText(renameTargetName);
    if (!nextName) {
      toast.error('Informe o novo nome do projeto.');
      return;
    }

    if (nextName === selectedProject) {
      toast.info('O nome informado e igual ao atual.');
      setIsRenameDialogOpen(false);
      return;
    }

    setIsRenamingProject(true);
    try {
      const updated = await saveProfile({
        oldName: selectedProject,
        nextProfile: {
          name: nextName,
          projectType: selectedProfile?.projectType || profileForm.projectType || 'Administrativo',
          summary: selectedProfile?.summary || profileForm.summary || ''
        },
        applyTemplate: false
      });

      if (!updated) {
        setIsRenamingProject(false);
        return;
      }

      renameProjectWorkspaceData(selectedProject, nextName);

      const historyMap = readProjectHistory();
      if (historyMap[selectedProject]) {
        historyMap[nextName] = historyMap[selectedProject];
        delete historyMap[selectedProject];
        writeProjectHistory(historyMap);
      }

      const tasksToRename = tasks.filter((item) => item.project === selectedProject);
      for (const task of tasksToRename) {
        await updateTask(task.id, { project: nextName });
      }

      setSelectedProject(nextName);
      setProfileForm((current) => ({ ...current, name: nextName }));
      appendHistory(nextName, 'Projeto renomeado', `Nome anterior: ${selectedProject}`);
      refreshWorkspaceData(nextName);
      setIsRenameDialogOpen(false);
      toast.success('Projeto renomeado com sucesso.');
    } catch (error) {
      console.error(error);
      toast.error('Nao foi possivel renomear o projeto.');
    } finally {
      setIsRenamingProject(false);
    }
  };

  const openDeleteProjectDialog = () => {
    if (!selectedProject || isDeletingProject) return;
    setDeleteConfirmName('');
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteProject = async () => {
    if (!selectedProject || isDeletingProject) return;

    const confirmation = normalizeText(deleteConfirmName);
    if (confirmation !== selectedProject) {
      toast.error('Digite o nome exato do projeto para confirmar a exclusao.');
      return;
    }

    setIsDeletingProject(true);
    try {
      clearProjectWorkspaceData(selectedProject);

      await deleteProjectProfileApi(selectedProject);

      const nextProfiles = profiles.filter((item) => item.name !== selectedProject);
      setProfiles(nextProfiles);

      const historyMap = readProjectHistory();
      if (historyMap[selectedProject]) {
        delete historyMap[selectedProject];
        writeProjectHistory(historyMap);
      }

      const tasksToUnlink = tasks.filter((item) => item.project === selectedProject);
      for (const task of tasksToUnlink) {
        // Remove vínculo com o projeto para evitar recriação automática do card.
        await updateTask(task.id, { project: '' });
      }

      setSelectedProject(null);
      setHistoryItems([]);
      setFolders([]);
      setFiles([]);
      setLinks([]);
      setAccesses([]);
      setNotes([]);
      setSearchTerm('');
      setIsDeleteDialogOpen(false);
      toast.success('Projeto excluido com sucesso.');
    } catch (error) {
      console.error(error);
      toast.error('Nao foi possivel excluir o projeto.');
    } finally {
      setIsDeletingProject(false);
    }
  };

  return (
    <>
      <Helmet><title>Projetos - Clareia</title></Helmet>
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 pb-20 md:pb-8 relative">
            <div className="page-container section-spacing">
              {!selectedProject ? (
                <>
                  <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex items-center gap-3 mb-3">
                        <FolderKanban className="w-8 h-8 text-primary" />
                        <h1 className="text-3xl font-medium text-foreground">Seus Projetos</h1>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Entre em cada projeto para abrir uma area de trabalho com materiais, acessos, notas e tarefas no mesmo lugar.
                      </p>
                    </div>
                    <Button onClick={() => setIsCreateProjectOpen(true)} className="shrink-0">
                      <Plus className="mr-2 h-4 w-4" /> Novo projeto
                    </Button>
                  </div>

                  {allProjects.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                      {allProjects.map((projectName) => {
                        const stats = getProjectStats(projectName);
                        const profile = profiles.find((item) => item.name === projectName);
                        return (
                          <Card
                            key={projectName}
                            className="card-hover cursor-pointer border-border shadow-sm"
                            role="button"
                            tabIndex={0}
                            aria-label={`Abrir projeto ${projectName}`}
                            onClick={() => setSelectedProject(projectName)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                setSelectedProject(projectName);
                              }
                            }}
                          >
                            <CardContent className="p-6">
                              <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-medium text-foreground truncate pr-4">{projectName}</h3>
                                <ChevronRight className="text-muted-foreground w-5 h-5 shrink-0" />
                              </div>
                              {profile?.projectType && <Badge variant="outline" className="mb-4">{profile.projectType}</Badge>}
                              <div className="flex gap-4">
                                <div className="bg-muted/50 rounded-lg p-3 flex-1">
                                  <p className="text-sm text-muted-foreground mb-1">Tarefas</p>
                                  <p className="text-xl font-medium text-foreground">{stats.openTasks}</p>
                                </div>
                                <div className="bg-muted/50 rounded-lg p-3 flex-1">
                                  <p className="text-sm text-muted-foreground mb-1">Materiais</p>
                                  <p className="text-xl font-medium text-foreground">{stats.materialsCount}</p>
                                </div>
                              </div>
                              {getProjectWhereStoppedPreview(projectName) && <p className="mt-4 line-clamp-1 text-sm text-muted-foreground" title={getProjectWhereStoppedPreview(projectName)}>{getProjectWhereStoppedPreview(projectName)}</p>}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-16 bg-card border border-border rounded-xl shadow-sm">
                      <CheckCircle2 className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                      <h2 className="text-xl font-medium text-foreground mb-2">Sem projetos ativos</h2>
                      <p className="text-muted-foreground">Comece criando o primeiro projeto e organize a mesa de trabalho digital.</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="animate-in slide-in-from-right-8 duration-300">
                  <Button variant="ghost" onClick={() => setSelectedProject(null)} className="mb-6 text-muted-foreground -ml-4">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Voltar para projetos
                  </Button>

                  <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <h1 className="text-3xl font-medium text-foreground">{selectedProject}</h1>
                      <p className="mt-1 text-sm text-muted-foreground">Area de trabalho do projeto</p>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon" aria-label="Mais ações do projeto"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={openRenameProjectDialog}>Renomear projeto</DropdownMenuItem>
                        <DropdownMenuItem onClick={openMergeProjectDialog} disabled={allProjects.length < 2 || isMergingProject}>
                          <GitMerge className="mr-2 h-4 w-4" /> Mesclar com outro projeto
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={openDeleteProjectDialog} disabled={isDeletingProject}>
                          <Trash2 className="mr-2 h-4 w-4" /> Excluir projeto
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {activeTab !== 'materiais' && <div className="w-full lg:w-[360px]">
                      <Label htmlFor="project-search">Buscar neste projeto...</Label>
                      <div className="relative mt-2">
                        <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
                        <Input
                          id="project-search"
                          value={searchTerm}
                          onChange={(event) => setSearchTerm(event.target.value)}
                          className="pl-9"
                          placeholder="Buscar tarefas, arquivos, links, notas e acessos"
                        />
                      </div>
                    </div>}
                  </div>

                  <section className="mb-6 rounded-lg border border-border bg-card p-5" aria-labelledby="project-resume-title">
                    <h2 id="project-resume-title" className="text-lg font-medium">
                      {projectResumeTask
                        ? normalizeTaskStatus(projectResumeTask.status) === TASK_STATUS.PAUSADA ? 'Onde você parou' : 'Próximo passo do projeto'
                        : 'Nenhuma próxima ação definida.'}
                    </h2>
                    {projectResumeTask ? (
                      <div className="mt-3">
                        <p className="font-medium text-foreground">{projectResumeTask.title}</p>
                        <p className="mt-1 text-lg text-foreground">{projectResumeAction?.action}</p>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          {projectResumeMinutes > 0 && <span>{projectResumeMinutes} min registrados</span>}
                          {projectResumeTask.pauseNote && <span>Onde você parou: {projectResumeTask.pauseNote}</span>}
                        </div>
                        <Button className="mt-4" onClick={handleProjectResume}>
                          {normalizeTaskStatus(projectResumeTask.status) === TASK_STATUS.PAUSADA ? 'Continuar de onde parei' : 'Começar'}
                        </Button>
                      </div>
                    ) : (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button onClick={() => setIsCreateTaskDialogOpen(true)}>Criar tarefa</Button>
                        <Button variant="outline" onClick={() => navigate('/descarregar-mente')}>Tirar da cabeça</Button>
                        <Button variant="ghost" onClick={() => setActiveTab('tarefas')}>Ver tarefas do projeto</Button>
                      </div>
                    )}
                  </section>

                  {searchTerm.trim() && (
                    <Card className="bg-card border-border shadow-sm mb-6">
                      <CardContent className="p-4 space-y-3">
                        <p className="text-sm text-muted-foreground">Resultados da busca: {searchResults.length}</p>
                        {searchResults.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Nenhum resultado encontrado.</p>
                        ) : (
                          <ul className="space-y-2">
                            {searchResults.map((item) => (
                              <li key={item.id} className="rounded-lg border border-border p-3 bg-muted/20">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant="secondary">{item.type}</Badge>
                                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                                </div>
                                <p className="text-xs text-muted-foreground">{item.meta}</p>
                              </li>
                            ))}
                          </ul>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="h-auto flex flex-wrap justify-start gap-2 p-2 mb-4">
                      <TabsTrigger value="resumo">Resumo</TabsTrigger>
                      <TabsTrigger value="tarefas">Tarefas</TabsTrigger>
                      <TabsTrigger value="materiais">Materiais</TabsTrigger>
                      <TabsTrigger value="historico">Histórico</TabsTrigger>
                    </TabsList>

                    <TabsContent value="resumo">
                      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                        <Card className="xl:col-span-2 bg-card border-border shadow-sm">
                          <CardContent className="p-6 space-y-4">
                            <h2 className="text-lg font-medium">Resumo do projeto</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Nome do projeto</Label>
                                <Input value={profileForm.name} readOnly className="bg-muted/40" />
                              </div>
                              <div className="space-y-2">
                                <Label>Tipo de projeto</Label>
                                <Select value={profileForm.projectType} onValueChange={(value) => setProfileForm((current) => ({ ...current, projectType: value }))}>
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {PROJECT_TYPE_OPTIONS.map((option) => (
                                      <SelectItem key={option} value={option}>{option}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label>Objetivo/resumo</Label>
                              <Textarea
                                value={profileForm.summary}
                                onChange={(event) => setProfileForm((current) => ({ ...current, summary: event.target.value }))}
                                className="min-h-24"
                                placeholder="Descreva o objetivo principal, escopo e resultado esperado."
                              />
                            </div>
                            <div className="border-y border-border py-4">
                              <label className="flex cursor-pointer items-start gap-3">
                                <input
                                  type="checkbox"
                                  className="mt-1 h-4 w-4 accent-sky-500"
                                  checked={profileForm.professionalTrackingEnabled}
                                  onChange={(event) => setProfileForm((current) => ({ ...current, professionalTrackingEnabled: event.target.checked }))}
                                />
                                <span>
                                  <span className="block text-sm font-medium text-foreground">Acompanhar jornada profissional</span>
                                  <span className="mt-0.5 block text-sm text-muted-foreground">Registra o período líquido trabalhado neste projeto, separado dos timers de tarefa.</span>
                                </span>
                              </label>
                              {profileForm.professionalTrackingEnabled && (
                                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                                  <div className="space-y-2">
                                    <Label htmlFor="weekly-hours">Carga semanal</Label>
                                    <div className="flex items-center gap-2">
                                      <Input
                                        id="weekly-hours"
                                        type="number"
                                        min="1"
                                        max="168"
                                        step="0.5"
                                        value={profileForm.weeklyTargetMinutes / 60}
                                        onChange={(event) => setProfileForm((current) => ({ ...current, weeklyTargetMinutes: Math.round(Number(event.target.value || 0) * 60) }))}
                                      />
                                      <span className="text-sm text-muted-foreground">horas</span>
                                    </div>
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Fuso horário</Label>
                                    <Input value={profileForm.timezone} readOnly className="bg-muted/40" />
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button onClick={handleUpdateProject}>Salvar projeto</Button>
                              <Button variant="outline" onClick={openRenameProjectDialog} disabled={isRenamingProject}>
                                Renomear projeto
                              </Button>
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="bg-card border-border shadow-sm">
                          <CardContent className="p-6 space-y-4">
                            <h3 className="font-medium">Onde parei</h3>
                            <p className="text-sm text-muted-foreground">{whereIStopped}</p>
                            <h3 className="font-medium">Próximo passo</h3>
                            <p className="text-sm text-muted-foreground">{nextActionRecommended}</p>
                            <h3 className="font-medium">Preciso lembrar</h3>
                            <p className="text-sm text-muted-foreground">{reminderText}</p>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="rounded-lg bg-muted/30 p-3">
                                <p className="text-xs text-muted-foreground">Tarefas abertas</p>
                                <p className="text-xl font-medium">{projectTasks.length}</p>
                              </div>
                              <div className="rounded-lg bg-muted/30 p-3">
                                <p className="text-xs text-muted-foreground">Arquivos</p>
                                <p className="text-xl font-medium">{files.length}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        <Card className="bg-card border-border shadow-sm">
                          <CardContent className="p-6">
                            <h3 className="font-medium mb-3">Materiais recentes</h3>
                            {projectFilesRecent.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum arquivo cadastrado.</p> : (
                              <ul className="space-y-2">
                                {projectFilesRecent.map((item) => <li key={item.id} className="text-sm">{item.name}</li>)}
                              </ul>
                            )}
                          </CardContent>
                        </Card>

                        <Card className="bg-card border-border shadow-sm">
                          <CardContent className="p-6">
                            <h3 className="font-medium mb-3">Links rápidos</h3>
                            {projectFavoriteLinks.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum link favorito.</p> : (
                              <div className="space-y-3">
                                <ul className="space-y-2">
                                  {projectFavoriteLinks.map((item) => <li key={item.id} className="text-sm truncate">{item.title}</li>)}
                                </ul>
                                <div className="flex flex-wrap gap-2">
                                  {projectFavoriteLinks
                                    .map((item) => ({ item, label: getQuickLinkLabel(item) }))
                                    .filter((entry) => Boolean(entry.label))
                                    .slice(0, 6)
                                    .map(({ item, label }) => (
                                      <Button key={item.id} size="sm" variant="outline" onClick={() => window.open(item.url, '_blank', 'noopener,noreferrer')}>
                                        {label}
                                      </Button>
                                    ))}
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>

                        <Card className="bg-card border-border shadow-sm">
                          <CardContent className="p-6">
                            <h3 className="font-medium mb-3">Acessos principais</h3>
                            {projectMainAccesses.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum acesso cadastrado.</p> : (
                              <ul className="space-y-2">
                                {projectMainAccesses.map((item) => <li key={item.id} className="text-sm truncate">{item.title}</li>)}
                              </ul>
                            )}
                          </CardContent>
                        </Card>

                        <Card className="bg-card border-border shadow-sm xl:col-span-2">
                          <CardContent className="p-6">
                            <h3 className="font-medium mb-3">Ultimas notas</h3>
                            {projectRecentNotes.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma nota cadastrada.</p> : (
                              <ul className="space-y-2">
                                {projectRecentNotes.map((item) => (
                                  <li key={item.id} className="rounded-lg border border-border p-3">
                                    <p className="text-sm font-medium">{item.title || 'Nota sem titulo'}</p>
                                    <p className="text-xs text-muted-foreground line-clamp-2">{item.content}</p>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </CardContent>
                        </Card>

                        <Card className="bg-card border-border shadow-sm xl:col-span-3">
                          <CardContent className="p-6">
                            <h3 className="font-medium mb-3">Aguardando retorno</h3>
                            {projectWaitingReturns.length === 0 ? (
                              <p className="text-sm text-muted-foreground">Nenhuma dependência externa cadastrada para este projeto.</p>
                            ) : (
                              <ul className="space-y-2">
                                {projectWaitingReturns.slice(0, 5).map((item) => (
                                  <li key={item.id} className="rounded-lg border border-border p-3">
                                    <p className="text-sm font-medium text-foreground">{item.title}</p>
                                    <p className="text-xs text-muted-foreground">{item.contactName} • {item.nextFollowUpDate || 'Sem data de follow-up'}</p>
                                    <p className="text-xs text-foreground mt-1">{item.waitingFor}</p>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </CardContent>
                        </Card>
                      </div>
                    </TabsContent>

                    <TabsContent value="tarefas">
                      <Card className="bg-card border-border shadow-sm">
                        <CardContent className="p-6 space-y-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <h2 className="text-lg font-medium">Tarefas relacionadas ao projeto</h2>
                            <div className="flex flex-wrap items-center gap-2">
                              <Select value={taskFilter} onValueChange={setTaskFilter}>
                                <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="abertas">Abertas</SelectItem>
                                  <SelectItem value="concluidas">Concluídas</SelectItem>
                                  <SelectItem value="arquivadas">Arquivadas</SelectItem>
                                  <SelectItem value="todas">Todas</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button onClick={() => setIsCreateTaskDialogOpen(true)}>
                                <Plus className="w-4 h-4 mr-2" /> Adicionar tarefa
                              </Button>
                            </div>
                          </div>

                          {projectTasksForFilter.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Nenhuma tarefa neste filtro.</p>
                          ) : (
                            <div className="space-y-4">
                              {projectTasksForFilter.map((task) => {
                                const material = getTaskMaterials(task.id);
                                const completedAt = getTaskLastCompletionDate(task.id);
                                return (
                                  <div key={task.id} className="rounded-xl border border-border p-4">
                                    <TaskCard task={task} onComplete={completeTask} minimal />
                                    <div className="mt-3 flex flex-wrap gap-2">
                                      <Badge variant="outline">Arquivos vinculados: {material.relatedFiles.length}</Badge>
                                      <Badge variant="outline">Links vinculados: {material.relatedLinks.length}</Badge>
                                      <Badge variant="outline">Acessos vinculados: {material.relatedAccesses.length}</Badge>
                                      <Badge variant="outline">Notas vinculadas: {material.relatedNotes.length}</Badge>
                                    </div>

                                    {taskFilter === 'concluidas' && (
                                      <div className="mt-3 rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
                                        <p>Título: <span className="text-foreground">{task.title}</span></p>
                                        <p>Projeto: <span className="text-foreground">{task.project || 'Pessoal'}</span></p>
                                        <p>Data de conclusão: {completedAt ? formatDateTime(completedAt) : 'não registrada'}</p>
                                        <p>Tempo registrado: {workSessions.filter((session) => session.taskId === task.id).reduce((sum, session) => sum + Number(session.durationMinutes || 0), 0)} min</p>
                                        <p>Microtarefas concluídas: {(task.microtarefas || []).filter((item) => item.status === 'concluída').length}</p>
                                        <div className="flex flex-wrap gap-2 pt-1">
                                          <Button size="sm" variant="outline" onClick={() => openReopenTaskDialog(task)}>
                                            Reabrir tarefa
                                          </Button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="historico">
                      <div className="space-y-6">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <Card className="bg-card border-border"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Hoje</p><p className="text-2xl font-medium">{toHours(projectTimeSummary.todayMinutes)}h</p></CardContent></Card>
                          <Card className="bg-card border-border"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Semana</p><p className="text-2xl font-medium">{toHours(projectTimeSummary.weekMinutes)}h</p></CardContent></Card>
                          <Card className="bg-card border-border"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Mês</p><p className="text-2xl font-medium">{toHours(projectTimeSummary.monthMinutes)}h</p></CardContent></Card>
                          <Card className="bg-card border-border"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total</p><p className="text-2xl font-medium">{toHours(projectTimeSummary.totalMinutes)}h</p></CardContent></Card>
                        </div>

                        <Card className="bg-card border-border shadow-sm">
                          <CardContent className="p-6 space-y-4">
                            <div className="flex items-center justify-between">
                              <h3 className="font-medium">Sessões de trabalho</h3>
                              <Button onClick={() => setIsManualTimeOpen(true)}>Adicionar tempo manual</Button>
                            </div>

                            {workSessions.length === 0 ? (
                              <p className="text-sm text-muted-foreground">Nenhuma sessão registrada para este projeto.</p>
                            ) : (
                              <ul className="space-y-2">
                                {workSessions.map((session) => (
                                  <li key={session.id} className="rounded-lg border border-border p-3">
                                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                      <div>
                                        <p className="text-sm font-medium text-foreground">{session.title || 'Sessão de trabalho'}</p>
                                        <p className="text-xs text-muted-foreground">
                                          {formatDateTime(session.startedAt)} • {session.taskId ? `Tarefa: ${tasks.find((task) => task.id === session.taskId)?.title || 'vinculada'}` : 'Sem tarefa'}
                                        </p>
                                        <p className="text-xs text-muted-foreground">Origem: {session.source === 'manual' ? 'manual' : 'timer'} • {session.durationMinutes} min</p>
                                      </div>
                                      <div className="flex gap-2">
                                        <Button size="sm" variant="outline" onClick={() => openEditSessionDialog(session)}>
                                          Editar
                                        </Button>
                                        <Button size="sm" variant="outline" className="text-destructive" onClick={() => {
                                          openDeleteSessionDialog(session);
                                        }}>
                                          Excluir
                                        </Button>
                                      </div>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </CardContent>
                        </Card>
                      </div>
                    </TabsContent>

                    <TabsContent value="materiais">
                      <ProjectMaterialsWorkspace
                        items={projectMaterialItems}
                        folders={folders}
                        folderPathMap={folderPathMap}
                        folderItemCounters={folderItemCounters}
                        currentFolder={currentFolder}
                        currentFolderPath={currentFolderPath}
                        foldersInCurrentLevel={foldersInCurrentLevel}
                        driveState={drivePresentationState}
                        driveFolder={projectDriveConfig}
                        onAdd={openMaterialAddFlow}
                        onOpenFolder={openFolder}
                        onBackFolder={goBackFolder}
                        onEditFolder={openRenameFolderDialog}
                        onDeleteFolder={handleDeleteFolder}
                        onOpenDrive={openDriveDialog}
                        onOpenDriveFolder={handleOpenProjectDriveFolder}
                        onDisconnectDriveFolder={handleDisconnectProjectDriveFolder}
                        onRetryDrive={() => setDriveReloadKey((current) => current + 1)}
                        onOpenItem={handleOpenProjectItem}
                        onEditItem={handleEditProjectItem}
                        onDeleteItem={handleDeleteProjectItem}
                        onToggleFavorite={handleToggleFavoriteProjectItem}
                      />
                    </TabsContent>

                    <TabsContent value="materiais-legado-arquivos">
                      <div className="space-y-6">
                        <Card className="bg-card border-border shadow-sm">
                          <CardContent className="p-6 space-y-4">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                              <div>
                                <h3 className="text-lg font-medium">Arquivos do projeto</h3>
                                <p className="text-sm text-muted-foreground">Materiais, links, prints, documentos e referencias deste projeto.</p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Button variant="outline" onClick={() => openCreateFolderDialog(currentFolderId)}>
                                  <Plus className="w-4 h-4 mr-2" /> Nova pasta
                                </Button>
                                <Button onClick={() => {
                                  setEditingMaterialId(null);
                                  setFileForm((current) => ({
                                    ...current,
                                    materialType: 'arquivo',
                                    folder: currentFolderPath,
                                    provider: 'external_link',
                                    driveFileId: '',
                                    driveFolderId: '',
                                    relatedTaskId: 'none'
                                  }));
                                  setIsMaterialDialogOpen(true);
                                }}>
                                  Adicionar material
                                </Button>
                                <Button variant="outline" onClick={() => {
                                  setIsDriveDialogOpen(true);
                                }}>
                                  Configurar/Alterar Drive
                                </Button>
                              </div>
                            </div>

                            {!currentFolder && (
                              !projectDriveConfig ? (
                                <div className="rounded-xl border border-border bg-muted/20 p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                  <p className="text-sm text-muted-foreground">Nenhuma pasta do Google Drive conectada.</p>
                                  <Button size="sm" onClick={() => setIsDriveDialogOpen(true)}>Conectar Drive</Button>
                                </div>
                              ) : !driveConnectionStatus?.connected ? (
                                <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                  <p className="text-sm text-amber-800 truncate">
                                    A conexao com o Google Drive foi encerrada. Reconecte para continuar usando a pasta{' '}
                                    <span className="font-medium">{projectDriveConfig.folderName || selectedProject}</span>.
                                  </p>
                                  <Button size="sm" onClick={() => setIsDriveDialogOpen(true)}>Reconectar</Button>
                                </div>
                              ) : (
                                <div className="rounded-xl border border-border bg-muted/20 p-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                  <p className="text-sm text-muted-foreground truncate">
                                    Google Drive conectado: <span className="text-foreground font-medium">{projectDriveConfig.folderName || selectedProject}</span>
                                  </p>
                                  <div className="flex flex-wrap gap-2">
                                    <Button size="sm" variant="outline" onClick={handleOpenProjectDriveFolder}>Abrir no Drive</Button>
                                    <Button size="sm" variant="outline" onClick={() => setIsDriveDialogOpen(true)}>Alterar conexao</Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={handleDisconnectProjectDriveFolder}
                                      disabled={isDisconnectingProjectDrive}
                                    >
                                      {isDisconnectingProjectDrive ? 'Desconectando...' : 'Desconectar pasta'}
                                    </Button>
                                  </div>
                                </div>
                              )
                            )}

                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                              <div className="relative w-full md:max-w-md">
                                <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
                                <Input
                                  value={fileSearchTerm}
                                  onChange={(event) => setFileSearchTerm(event.target.value)}
                                  className="pl-9"
                                  placeholder="Buscar pastas, materiais, links, tags e origem"
                                />
                              </div>
                              <div className="flex gap-2">
                                <Button variant={fileViewMode === 'grid' ? 'default' : 'outline'} size="sm" onClick={() => setFileViewMode('grid')}>
                                  <Folder className="w-4 h-4 mr-2" /> Grade
                                </Button>
                                <Button variant={fileViewMode === 'list' ? 'default' : 'outline'} size="sm" onClick={() => setFileViewMode('list')}>
                                  <List className="w-4 h-4 mr-2" /> Lista
                                </Button>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              {MATERIAL_TYPE_FILTER_OPTIONS.map((option) => (
                                <Button
                                  key={option.value}
                                  size="sm"
                                  variant={materialTypeFilter === option.value ? 'default' : 'outline'}
                                  onClick={() => setMaterialTypeFilter(option.value)}
                                >
                                  {option.label} ({materialTypeCounts[option.value] || 0})
                                </Button>
                              ))}
                            </div>

                            {currentFolder && (
                              <div className="rounded-lg border border-border bg-muted/20 p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div className="text-sm text-muted-foreground">
                                  {selectedProject} &gt; Arquivos &gt; {currentFolderBreadcrumb.map((item) => item.name).join(' > ')}
                                </div>
                                <Button size="sm" variant="outline" onClick={goBackFolder}>
                                  <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
                                </Button>
                              </div>
                            )}
                          </CardContent>
                        </Card>

                        {fileSearchResults ? (
                          <Card className="bg-card border-border shadow-sm">
                            <CardContent className="p-6 space-y-4">
                              <h4 className="font-medium">Resultados da busca</h4>
                              <p className="text-xs text-muted-foreground">Pastas: {fileSearchResults.folderMatches.length} • Materiais: {fileSearchResults.materialMatches.length}</p>
                              {fileSearchResults.folderMatches.length > 0 && (
                                <div className="space-y-2">
                                  <p className="text-sm font-medium">Pastas</p>
                                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                                    {fileSearchResults.folderMatches.map((folder) => (
                                      <button key={folder.id} type="button" onClick={() => openFolder(folder.id)} className="rounded-lg border border-border p-3 text-left hover:bg-muted">
                                        <p className="text-sm font-medium">{folder.name}</p>
                                        <p className="text-xs text-muted-foreground">{folderPathMap[folder.id]}</p>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {fileSearchResults.materialMatches.length > 0 && (
                                <div className="space-y-2">
                                  <p className="text-sm font-medium">Materiais</p>
                                  <div className="space-y-2">
                                    {fileSearchResults.materialMatches.map((material) => {
                                      const MaterialIcon = getMaterialIcon(material.materialType || material.type);
                                      return (
                                        <div key={material.id} className="rounded-lg border border-border p-3 flex items-center justify-between gap-3">
                                          <div className="flex items-center gap-3 min-w-0">
                                            <MaterialIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                                            <div className="min-w-0">
                                              <p className="text-sm font-medium truncate">{material.name}</p>
                                              <p className="text-xs text-muted-foreground truncate">{material.folder || 'Sem pasta'}</p>
                                            </div>
                                          </div>
                                          <Button size="sm" variant="outline" onClick={() => handleOpenMaterial(material)}>Abrir</Button>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ) : (
                          <>
                            <Card className="bg-card border-border shadow-sm">
                              <CardContent className="p-6 space-y-4">
                                <h4 className="font-medium">{currentFolder ? `Conteudo da pasta ${currentFolder.name}` : 'Pastas'}</h4>
                                {foldersInCurrentLevel.length === 0 ? (
                                  <p className="text-sm text-muted-foreground">Nenhuma pasta neste nivel.</p>
                                ) : (
                                  <div className={fileViewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3' : 'space-y-2'}>
                                    {foldersInCurrentLevel.map((folder) => (
                                      <div key={folder.id} className="rounded-lg border border-border p-3">
                                        <div className="flex items-start justify-between gap-2">
                                          <button type="button" className="min-w-0 text-left" onClick={() => openFolder(folder.id)}>
                                            <p className="text-sm font-medium flex items-center gap-2"><Folder className="w-4 h-4 text-primary" /> {folder.name}</p>
                                            <p className="text-xs text-muted-foreground mt-1">{folderFileCounters[folder.id] || 0} item(ns)</p>
                                          </button>
                                          <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                              <Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                              <DropdownMenuItem onClick={() => openFolder(folder.id)}>Abrir</DropdownMenuItem>
                                              <DropdownMenuItem onClick={() => openRenameFolderDialog(folder)}>Renomear</DropdownMenuItem>
                                              <DropdownMenuItem onClick={() => openCreateFolderDialog(folder.id)}>Criar subpasta</DropdownMenuItem>
                                              <DropdownMenuSeparator />
                                              <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteFolder(folder.id)}>Excluir</DropdownMenuItem>
                                            </DropdownMenuContent>
                                          </DropdownMenu>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </CardContent>
                            </Card>

                            <Card className="bg-card border-border shadow-sm">
                              <CardContent className="p-6 space-y-4">
                                <h4 className="font-medium">Materiais {currentFolder ? `em ${currentFolder.name}` : 'do projeto'}</h4>
                                {filteredMaterialsInCurrentFolder.length === 0 ? (
                                  <p className="text-sm text-muted-foreground">Nenhum material neste recorte.</p>
                                ) : (
                                  <div className={fileViewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3' : 'space-y-2'}>
                                    {filteredMaterialsInCurrentFolder.map((material) => {
                                      const MaterialIcon = getMaterialIcon(material.materialType || material.type);
                                      return (
                                        <div key={material.id} className="rounded-lg border border-border p-3">
                                          <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                              <p className="text-sm font-medium flex items-center gap-2 truncate">
                                                <MaterialIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                                                <span className="truncate">{material.name}</span>
                                              </p>
                                              <p className="text-xs text-muted-foreground mt-1 truncate">{material.type || material.materialType || 'material'}</p>
                                              <p className="text-xs text-muted-foreground mt-1 truncate">provider: {material.provider || material.storageProvider || 'local'}</p>
                                              {material.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{material.description}</p>}
                                            </div>
                                            <DropdownMenu>
                                              <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button>
                                              </DropdownMenuTrigger>
                                              <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => handleOpenMaterial(material)}>Abrir</DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleEditMaterial(material)}>Editar</DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => {
                                                  handleEditMaterial(material);
                                                  setIsAdvancedDetailsOpen(false);
                                                }}>Mover para outra pasta</DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => {
                                                  handleEditMaterial(material);
                                                  setIsAdvancedDetailsOpen(true);
                                                }}>Relacionar a tarefa</DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleToggleFavoriteMaterial(material)}>{material.favorite ? 'Desfavoritar' : 'Favoritar'}</DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteFile(material.id)}>Excluir</DropdownMenuItem>
                                              </DropdownMenuContent>
                                            </DropdownMenu>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </CardContent>
                            </Card>

                            {!currentFolder && (
                              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                                <Card className="bg-card border-border shadow-sm">
                                  <CardContent className="p-6 space-y-3">
                                    <h4 className="font-medium">Favoritos</h4>
                                    {projectFilesFavorites.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum material favoritado.</p> : (
                                      <ul className="space-y-2">
                                        {projectFilesFavorites.map((item) => <li key={item.id} className="text-sm truncate">{item.name}</li>)}
                                      </ul>
                                    )}
                                  </CardContent>
                                </Card>

                                <Card className="bg-card border-border shadow-sm">
                                  <CardContent className="p-6 space-y-3">
                                    <h4 className="font-medium">Recentes</h4>
                                    {projectFilesRecent.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum material recente.</p> : (
                                      <ul className="space-y-2">
                                        {projectFilesRecent.map((item) => <li key={item.id} className="text-sm truncate">{item.name}</li>)}
                                      </ul>
                                    )}
                                  </CardContent>
                                </Card>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </TabsContent>

                    <TabsContent value="materiais-legado-links">
                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        <Card className="bg-card border-border shadow-sm">
                          <CardContent className="p-6 space-y-4">
                            <h3 className="font-medium">Cadastrar link util</h3>
                            <div className="space-y-2">
                              <Label>Titulo</Label>
                              <Input value={linkForm.title} onChange={(event) => setLinkForm((current) => ({ ...current, title: event.target.value }))} />
                            </div>
                            <div className="space-y-2">
                              <Label>URL</Label>
                              <Input value={linkForm.url} onChange={(event) => setLinkForm((current) => ({ ...current, url: event.target.value }))} placeholder="https://..." />
                            </div>
                            <div className="space-y-2">
                              <Label>Tipo</Label>
                              <Select value={linkForm.type} onValueChange={(value) => setLinkForm((current) => ({ ...current, type: value }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {projectLinkTypes.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Descricao</Label>
                              <Textarea value={linkForm.description} onChange={(event) => setLinkForm((current) => ({ ...current, description: event.target.value }))} className="min-h-20" />
                            </div>
                            <div className="space-y-2">
                              <Label>Storage provider</Label>
                              <Select value={linkForm.storageProvider} onValueChange={(value) => setLinkForm((current) => ({ ...current, storageProvider: value }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="local">local</SelectItem>
                                  <SelectItem value="google_drive">google_drive</SelectItem>
                                  <SelectItem value="external_link">external_link</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Relacionar a tarefa (opcional)</Label>
                              <Select value={linkForm.relatedTaskId} onValueChange={(value) => setLinkForm((current) => ({ ...current, relatedTaskId: value }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">Nao vincular</SelectItem>
                                  {projectTasks.map((task) => <SelectItem key={task.id} value={task.id}>{task.title}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                            <label className="text-sm flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={linkForm.favorite}
                                onChange={(event) => setLinkForm((current) => ({ ...current, favorite: event.target.checked }))}
                              />
                              Marcar como favorito
                            </label>
                            <Button onClick={handleCreateLink}>Salvar link</Button>
                          </CardContent>
                        </Card>

                        <Card className="bg-card border-border shadow-sm">
                          <CardContent className="p-6 space-y-4">
                            <h3 className="font-medium">Links do projeto</h3>
                            {links.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum link cadastrado.</p> : (
                              <>
                                <div>
                                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Favoritos</p>
                                  <div className="space-y-2">
                                    {links.filter((item) => item.favorite).length === 0 ? (
                                      <p className="text-sm text-muted-foreground">Sem favoritos.</p>
                                    ) : links.filter((item) => item.favorite).map((item) => (
                                      <div key={item.id} className="rounded-lg border border-border p-3">
                                        <div className="flex justify-between gap-2">
                                          <div className="min-w-0">
                                            <p className="text-sm font-medium truncate">{item.title}</p>
                                            <a href={item.url} target="_blank" rel="noreferrer" className="text-xs text-primary underline truncate block">{item.url}</a>
                                          </div>
                                          <Button size="sm" variant="outline" className="text-destructive" onClick={() => handleDeleteLink(item.id)}>Excluir</Button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                <div>
                                  <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Todos os links</p>
                                  <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
                                    {links.map((item) => (
                                      <div key={item.id} className="rounded-lg border border-border p-3">
                                        <div className="flex justify-between gap-2">
                                          <div className="min-w-0">
                                            <p className="text-sm font-medium truncate">{item.title}</p>
                                            <p className="text-xs text-muted-foreground">{item.type} • provider: {item.storageProvider}</p>
                                            <a href={item.url} target="_blank" rel="noreferrer" className="text-xs text-primary underline truncate block">{item.url}</a>
                                          </div>
                                          <Button size="sm" variant="outline" className="text-destructive" onClick={() => handleDeleteLink(item.id)}>Excluir</Button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </>
                            )}
                          </CardContent>
                        </Card>
                      </div>
                    </TabsContent>

                    <TabsContent value="materiais-legado-acessos">
                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        <Card className="bg-card border-border shadow-sm">
                          <CardContent className="p-6 space-y-4">
                            <div className="rounded-lg border border-amber-300/50 bg-amber-50 p-3 text-sm text-amber-900">
                              Evite salvar senhas sensiveis sem criptografia. Integracao segura sera adicionada depois.
                            </div>
                            <h3 className="font-medium">Cadastrar acesso</h3>
                            <div className="space-y-2"><Label>Titulo</Label><Input value={accessForm.title} onChange={(event) => setAccessForm((current) => ({ ...current, title: event.target.value }))} /></div>
                            <div className="space-y-2"><Label>Plataforma</Label><Input value={accessForm.platform} onChange={(event) => setAccessForm((current) => ({ ...current, platform: event.target.value }))} /></div>
                            <div className="space-y-2"><Label>URL</Label><Input value={accessForm.url} onChange={(event) => setAccessForm((current) => ({ ...current, url: event.target.value }))} placeholder="https://..." /></div>
                            <div className="space-y-2"><Label>Usuario/E-mail</Label><Input value={accessForm.username} onChange={(event) => setAccessForm((current) => ({ ...current, username: event.target.value }))} /></div>
                            <div className="space-y-2"><Label>Senha</Label><Input type="text" value={accessForm.password} onChange={(event) => setAccessForm((current) => ({ ...current, password: event.target.value }))} /></div>
                            <div className="space-y-2"><Label>Observacoes</Label><Textarea value={accessForm.notes} onChange={(event) => setAccessForm((current) => ({ ...current, notes: event.target.value }))} className="min-h-20" /></div>
                            <Button onClick={handleCreateAccess}>Salvar acesso</Button>
                          </CardContent>
                        </Card>

                        <Card className="bg-card border-border shadow-sm">
                          <CardContent className="p-6 space-y-3">
                            <h3 className="font-medium">Acessos cadastrados</h3>
                            {accesses.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum acesso cadastrado.</p> : accesses.map((item) => (
                              <div key={item.id} className="rounded-lg border border-border p-3 space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="font-medium text-sm">{item.title}</p>
                                  <Button size="sm" variant="outline" className="text-destructive" onClick={() => handleDeleteAccess(item.id)}>Excluir</Button>
                                </div>
                                <p className="text-xs text-muted-foreground">{item.platform || 'Plataforma nao informada'}</p>
                                {item.url && <a href={item.url} target="_blank" rel="noreferrer" className="text-xs text-primary underline block">{item.url}</a>}
                                <p className="text-xs text-muted-foreground">Usuario: {item.username || '-'}</p>
                                {item.password && <p className="text-xs text-muted-foreground">Senha legada oculta. Migre-a para um gerenciador seguro.</p>}
                                {item.notes && <p className="text-xs text-muted-foreground">Obs.: {item.notes}</p>}
                              </div>
                            ))}
                          </CardContent>
                        </Card>
                      </div>
                    </TabsContent>

                    <TabsContent value="materiais-legado-notas">
                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        <Card className="bg-card border-border shadow-sm">
                          <CardContent className="p-6 space-y-4">
                            <h3 className="font-medium">Salvar nota do projeto</h3>
                            <div className="space-y-2"><Label>Titulo</Label><Input value={noteForm.title} onChange={(event) => setNoteForm((current) => ({ ...current, title: event.target.value }))} /></div>
                            <div className="space-y-2"><Label>Conteudo</Label><Textarea value={noteForm.content} onChange={(event) => setNoteForm((current) => ({ ...current, content: event.target.value }))} className="min-h-36" /></div>
                            <div className="space-y-2"><Label>Tags</Label><Input value={noteForm.tags} onChange={(event) => setNoteForm((current) => ({ ...current, tags: event.target.value }))} placeholder="decisao, cliente, tecnico" /></div>
                            <div className="space-y-2">
                              <Label>Relacionar a tarefa (opcional)</Label>
                              <Select value={noteForm.relatedTaskId} onValueChange={(value) => setNoteForm((current) => ({ ...current, relatedTaskId: value }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">Nao vincular</SelectItem>
                                  {projectTasks.map((task) => <SelectItem key={task.id} value={task.id}>{task.title}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                            <Button onClick={handleCreateOrUpdateNote}>{editingNoteId ? 'Atualizar nota' : 'Salvar nota'}</Button>
                          </CardContent>
                        </Card>

                        <Card className="bg-card border-border shadow-sm">
                          <CardContent className="p-6 space-y-3">
                            <h3 className="font-medium">Notas do projeto</h3>
                            {notes.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma nota cadastrada.</p> : notes.map((item) => (
                              <div key={item.id} className="rounded-lg border border-border p-3 space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-sm font-medium">{item.title || 'Nota sem titulo'}</p>
                                  <div className="flex gap-2">
                                    <Button size="sm" variant="outline" onClick={() => handleEditNote(item)}>Editar</Button>
                                    <Button size="sm" variant="outline" className="text-destructive" onClick={() => handleDeleteNote(item.id)}>Excluir</Button>
                                  </div>
                                </div>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{item.content}</p>
                                {(item.tags || []).length > 0 && <p className="text-xs text-muted-foreground">Tags: {item.tags.join(', ')}</p>}
                                <p className="text-xs text-muted-foreground">Atualizada em {formatDateTime(item.updatedAt)}</p>
                              </div>
                            ))}
                          </CardContent>
                        </Card>
                      </div>
                    </TabsContent>

                    <TabsContent value="historico">
                      <Card className="bg-card border-border shadow-sm">
                        <CardContent className="p-6">
                          <h2 className="text-lg font-medium mb-4">Historico do projeto</h2>
                          {historyItems.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Sem eventos registrados ainda.</p>
                          ) : (
                            <ul className="space-y-3">
                              {historyItems.map((item) => (
                                <li key={item.id} className="rounded-lg border border-border p-3 flex items-start gap-3">
                                  <History className="w-4 h-4 text-muted-foreground mt-0.5" />
                                  <div>
                                    <p className="text-sm font-medium">{item.action}</p>
                                    <p className="text-xs text-muted-foreground">{item.details}</p>
                                    <p className="text-xs text-muted-foreground mt-1">{formatDateTime(item.createdAt)}</p>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
                        </CardContent>
                      </Card>
                    </TabsContent>
                  </Tabs>
                </div>
              )}
            </div>
          </main>
        </div>
        <MobileNav />

        <ManualTimeDialog
          isOpen={isManualTimeOpen}
          onOpenChange={setIsManualTimeOpen}
          defaultProject={selectedProject || 'Pessoal'}
          defaultTaskId="none"
          tasks={projectAllTasks}
          onSaved={() => refreshWorkspaceData(selectedProject)}
        />

        <Dialog open={isAddMaterialDialogOpen} onOpenChange={setIsAddMaterialDialogOpen}>
          <DialogContent className="max-w-lg [&>button]:h-11 [&>button]:w-11 [&>button]:flex [&>button]:items-center [&>button]:justify-center" onInteractOutside={(event) => event.preventDefault()} onCloseAutoFocus={restoreMaterialDialogFocus}>
            <DialogHeader>
              <DialogTitle>O que você quer guardar?</DialogTitle>
              <DialogDescription>Escolha o tipo de item para adicionar ao projeto.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {[
                { type: 'file', label: 'Arquivo', icon: FileText, description: 'Documento, imagem ou referência' },
                { type: 'link', label: 'Link', icon: Link2, description: 'Site, painel ou página útil' },
                { type: 'note', label: 'Nota', icon: NotebookText, description: 'Decisão ou informação do projeto' },
                { type: 'access', label: 'Acesso', icon: Lock, description: 'URL e usuário, sem armazenar senha' },
                { type: 'folder', label: 'Pasta', icon: Folder, description: 'Organize os itens do projeto' },
              ].map((option) => {
                const OptionIcon = option.icon;
                return (
                  <button key={option.type} type="button" onClick={() => openMaterialAddFlow(option.type)} className="rounded-lg border border-border p-4 text-left transition-colors hover:bg-muted/50">
                    <OptionIcon className="mb-3 h-5 w-5 text-primary" />
                    <span className="block text-sm font-medium">{option.label}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">{option.description}</span>
                  </button>
                );
              })}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddMaterialDialogOpen(false)}>Cancelar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={Boolean(itemDialogType)}
          onOpenChange={(open) => {
            if (!open) {
              setItemDialogType(null);
              setEditingLinkId(null);
              setEditingAccessId(null);
              setEditingNoteId(null);
              setIsAdvancedDetailsOpen(false);
            }
          }}
        >
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto [&>button]:h-11 [&>button]:w-11 [&>button]:flex [&>button]:items-center [&>button]:justify-center" onInteractOutside={(event) => event.preventDefault()} onCloseAutoFocus={restoreMaterialDialogFocus}>
            <DialogHeader>
              <DialogTitle>
                {itemDialogType === 'link' && (editingLinkId ? 'Editar link' : 'Adicionar link')}
                {itemDialogType === 'note' && (editingNoteId ? 'Editar nota' : 'Nova nota')}
                {itemDialogType === 'access' && (editingAccessId ? 'Editar acesso' : 'Adicionar acesso')}
              </DialogTitle>
              <DialogDescription>
                {itemDialogType === 'access'
                  ? 'Guarde apenas os dados necessários para localizar o acesso.'
                  : 'Salve este item sem sair da área do projeto.'}
              </DialogDescription>
            </DialogHeader>

            {itemDialogType === 'link' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="material-link-title">Título</Label>
                  <Input id="material-link-title" value={linkForm.title} onChange={(event) => setLinkForm((current) => ({ ...current, title: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="material-link-url">URL</Label>
                  <Input
                    id="material-link-url"
                    value={linkForm.url}
                    onChange={(event) => setLinkForm((current) => ({ ...current, url: event.target.value }))}
                    onBlur={() => {
                      if (linkForm.title || !linkForm.url) return;
                      try {
                        const hostname = new URL(linkForm.url).hostname.replace(/^www\./, '');
                        setLinkForm((current) => ({ ...current, title: hostname }));
                      } catch {
                        // Mantém o título vazio para o usuário corrigir a URL.
                      }
                    }}
                    placeholder="https://..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="material-link-description">Descrição <span className="text-muted-foreground">(opcional)</span></Label>
                  <Textarea id="material-link-description" value={linkForm.description} onChange={(event) => setLinkForm((current) => ({ ...current, description: event.target.value }))} className="min-h-20" />
                </div>
              </div>
            )}

            {itemDialogType === 'note' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="material-note-title">Título</Label>
                  <Input id="material-note-title" value={noteForm.title} onChange={(event) => setNoteForm((current) => ({ ...current, title: event.target.value }))} placeholder="Nota rápida" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="material-note-content">Conteúdo</Label>
                  <Textarea id="material-note-content" value={noteForm.content} onChange={(event) => setNoteForm((current) => ({ ...current, content: event.target.value }))} className="min-h-40" autoFocus />
                </div>
              </div>
            )}

            {itemDialogType === 'access' && (
              <div className="space-y-4">
                <div className="space-y-2"><Label htmlFor="material-access-title">Nome do acesso</Label><Input id="material-access-title" value={accessForm.title} onChange={(event) => setAccessForm((current) => ({ ...current, title: event.target.value }))} placeholder="Ex.: WordPress IDT-PR" /></div>
                <div className="space-y-2"><Label htmlFor="material-access-platform">Plataforma</Label><Input id="material-access-platform" value={accessForm.platform} onChange={(event) => setAccessForm((current) => ({ ...current, platform: event.target.value }))} placeholder="Ex.: WordPress" /></div>
                <div className="space-y-2"><Label htmlFor="material-access-url">URL</Label><Input id="material-access-url" value={accessForm.url} onChange={(event) => setAccessForm((current) => ({ ...current, url: event.target.value }))} placeholder="https://..." /></div>
                <div className="space-y-2"><Label htmlFor="material-access-username">Usuário/e-mail</Label><Input id="material-access-username" value={accessForm.username} onChange={(event) => setAccessForm((current) => ({ ...current, username: event.target.value }))} /></div>
                <div className="space-y-2"><Label htmlFor="material-access-notes">Observação <span className="text-muted-foreground">(opcional)</span></Label><Textarea id="material-access-notes" value={accessForm.notes} onChange={(event) => setAccessForm((current) => ({ ...current, notes: event.target.value }))} className="min-h-20" placeholder="Ex.: Senha armazenada no Bitwarden" /></div>
                <p className="text-xs text-muted-foreground">Por segurança, o Clareia não armazena senhas neste momento.</p>
              </div>
            )}

            {(itemDialogType === 'link' || itemDialogType === 'note' || itemDialogType === 'access') && (
              <div className="space-y-3">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsAdvancedDetailsOpen((current) => !current)}>
                  {isAdvancedDetailsOpen ? 'Ocultar opções' : 'Mais opções'}
                </Button>
                {isAdvancedDetailsOpen && (
                  <div className="space-y-4 rounded-lg border border-border p-4">
                    <div className="space-y-2">
                      <Label>Pasta</Label>
                      <Select
                        value={(itemDialogType === 'link' ? linkForm.folder : itemDialogType === 'note' ? noteForm.folder : accessForm.folder) || 'none'}
                        onValueChange={(value) => {
                          const folder = value === 'none' ? '' : value;
                          if (itemDialogType === 'link') setLinkForm((current) => ({ ...current, folder }));
                          if (itemDialogType === 'note') setNoteForm((current) => ({ ...current, folder }));
                          if (itemDialogType === 'access') setAccessForm((current) => ({ ...current, folder }));
                        }}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sem pasta</SelectItem>
                          {folders.map((folder) => <SelectItem key={folder.id} value={folderPathMap[folder.id]}>{folderPathMap[folder.id]}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    {(itemDialogType === 'link' || itemDialogType === 'note') && (
                      <div className="space-y-2">
                        <Label>Relacionar a tarefa</Label>
                        <Select
                          value={itemDialogType === 'link' ? linkForm.relatedTaskId : noteForm.relatedTaskId}
                          onValueChange={(value) => itemDialogType === 'link'
                            ? setLinkForm((current) => ({ ...current, relatedTaskId: value }))
                            : setNoteForm((current) => ({ ...current, relatedTaskId: value }))}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Não vincular</SelectItem>
                            {projectTasks.map((task) => <SelectItem key={task.id} value={task.id}>{task.title}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {itemDialogType === 'note' && <div className="space-y-2"><Label>Tags</Label><Input value={noteForm.tags} onChange={(event) => setNoteForm((current) => ({ ...current, tags: event.target.value }))} placeholder="decisão, cliente" /></div>}
                    {(itemDialogType === 'link' || itemDialogType === 'note') && (
                      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={itemDialogType === 'link' ? linkForm.favorite : noteForm.favorite} onChange={(event) => itemDialogType === 'link' ? setLinkForm((current) => ({ ...current, favorite: event.target.checked })) : setNoteForm((current) => ({ ...current, favorite: event.target.checked }))} /> Favorito</label>
                    )}
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setItemDialogType(null)}>Cancelar</Button>
              {itemDialogType === 'link' && <Button onClick={handleCreateLink}>{editingLinkId ? 'Salvar alterações' : 'Salvar link'}</Button>}
              {itemDialogType === 'note' && <Button onClick={handleCreateOrUpdateNote}>{editingNoteId ? 'Salvar alterações' : 'Salvar nota'}</Button>}
              {itemDialogType === 'access' && <Button onClick={handleCreateAccess}>{editingAccessId ? 'Salvar alterações' : 'Salvar acesso'}</Button>}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isCreateTaskDialogOpen} onOpenChange={setIsCreateTaskDialogOpen}>
          <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nova tarefa do projeto</DialogTitle>
              <DialogDescription>
                Cadastre uma tarefa sem sair da área do projeto.
              </DialogDescription>
            </DialogHeader>
            <TaskModal
              task={{
                project: selectedProject || '',
                taskType: 'Desenvolvimento',
                energiaNecessaria: 'Média'
              }}
              onSubmit={handleCreateTaskForProject}
              onCancel={() => setIsCreateTaskDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>

        <Dialog open={isNewFolderDialogOpen} onOpenChange={setIsNewFolderDialogOpen}>
          <DialogContent className="max-w-md [&>button]:h-11 [&>button]:w-11 [&>button]:flex [&>button]:items-center [&>button]:justify-center" onCloseAutoFocus={restoreMaterialDialogFocus}>
            <DialogHeader>
              <DialogTitle>Nova pasta</DialogTitle>
              <DialogDescription>
                {newFolderParentId ? `Criar subpasta em ${folderById.get(newFolderParentId)?.name || 'pasta selecionada'}.` : 'Crie uma pasta para organizar seus materiais.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="new-folder-name">Nome da pasta</Label>
              <Input id="new-folder-name" value={folderName} onChange={(event) => setFolderName(event.target.value)} placeholder="Ex.: Documentos" />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsNewFolderDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleAddFolder}>Criar pasta</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isRenameFolderDialogOpen} onOpenChange={setIsRenameFolderDialogOpen}>
          <DialogContent className="max-w-md [&>button]:h-11 [&>button]:w-11 [&>button]:flex [&>button]:items-center [&>button]:justify-center" onCloseAutoFocus={restoreMaterialDialogFocus}>
            <DialogHeader>
              <DialogTitle>Renomear pasta</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="rename-folder-name">Novo nome</Label>
              <Input id="rename-folder-name" value={folderEditingName} onChange={(event) => setFolderEditingName(event.target.value)} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsRenameFolderDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleUpdateFolder}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isMaterialDialogOpen} onOpenChange={setIsMaterialDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto [&>button]:h-11 [&>button]:w-11 [&>button]:flex [&>button]:items-center [&>button]:justify-center" onInteractOutside={(event) => event.preventDefault()} onCloseAutoFocus={restoreMaterialDialogFocus}>
            <DialogHeader>
              <DialogTitle>{editingMaterialId ? 'Editar arquivo' : 'Adicionar arquivo'}</DialogTitle>
              <DialogDescription>Guarde um arquivo ou uma referência sem sair do projeto.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={fileForm.name} onChange={(event) => setFileForm((current) => ({ ...current, name: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Pasta</Label>
                <Select value={fileForm.folder || 'none'} onValueChange={(value) => setFileForm((current) => ({ ...current, folder: value === 'none' ? '' : value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem pasta</SelectItem>
                    {folders.map((folder) => <SelectItem key={folder.id} value={folderPathMap[folder.id]}>{folderPathMap[folder.id]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Arquivo ou link</Label>
                <Input value={fileForm.externalLink} onChange={(event) => setFileForm((current) => ({ ...current, externalLink: event.target.value }))} placeholder="https://..." />
              </div>

              {folderSuggestions.length > 0 && (
                <div className="md:col-span-2 rounded-lg border border-amber-400/40 bg-amber-50 p-3 space-y-2">
                  <p className="text-sm text-amber-900">
                    Sugestoes automaticas de pasta (prioridade por confianca)
                  </p>
                  <div className="space-y-2">
                    {folderSuggestions.map((suggestion, index) => (
                      <div key={`${suggestion.folder}-${index}`} className="rounded-md border border-amber-500/30 bg-white/60 p-2">
                        <p className="text-sm text-amber-900">
                          {index + 1}. {selectedProject} &gt; {suggestion.folder}
                        </p>
                        <p className="text-xs text-amber-800">
                          Confianca: {suggestion.confidence === 'alta' ? 'Alta' : suggestion.confidence === 'media' ? 'Media' : 'Baixa'}
                        </p>
                        {suggestion.reason && (
                          <p className="text-xs text-amber-800">Motivo: {suggestion.reason}</p>
                        )}
                        {suggestion.relatedTaskSuggestion && (
                          <p className="text-xs text-amber-800">
                            Sugestao de tarefa relacionada: {suggestion.relatedTaskSuggestion}.
                          </p>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-2"
                          onClick={() => setFileForm((current) => ({ ...current, folder: suggestion.folder }))}
                        >
                          Aplicar esta sugestao
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2 md:col-span-2">
                <Label>Descricao curta</Label>
                <Textarea value={fileForm.description} onChange={(event) => setFileForm((current) => ({ ...current, description: event.target.value }))} className="min-h-20" />
              </div>
              <div className="md:col-span-2">
                <Button variant="outline" size="sm" onClick={() => setIsAdvancedDetailsOpen((current) => !current)}>
                  {isAdvancedDetailsOpen ? 'Ocultar opções' : 'Mais opções'}
                </Button>
              </div>
              {isAdvancedDetailsOpen && (
                <>
                  <div className="space-y-2">
                    <Label>Tags</Label>
                    <Input value={fileForm.tags} onChange={(event) => setFileForm((current) => ({ ...current, tags: event.target.value }))} placeholder="briefing, cliente" />
                  </div>
                  <div className="space-y-2">
                    <Label>Origem</Label>
                    <Input value={fileForm.origin} onChange={(event) => setFileForm((current) => ({ ...current, origin: event.target.value }))} placeholder="Email, cliente, interno..." />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Relacionar a tarefa</Label>
                    <Select value={fileForm.relatedTaskId} onValueChange={(value) => setFileForm((current) => ({ ...current, relatedTaskId: value }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nao vincular</SelectItem>
                        {projectTasks.map((task) => <SelectItem key={task.id} value={task.id}>{task.title}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {driveConnectionStatus?.connected && (
                    <label className="md:col-span-2 flex items-start gap-2 text-sm">
                      <input type="checkbox" checked={fileForm.autoSyncDrive} onChange={(event) => setFileForm((current) => ({ ...current, autoSyncDrive: event.target.checked }))} />
                      <span><span className="block text-foreground">Criar ou atualizar documento no Drive</span><span className="block text-xs text-muted-foreground">O conteúdo será salvo na pasta do projeto.</span></span>
                    </label>
                  )}
                </>
              )}
              <div className="md:col-span-2 flex items-center gap-2 text-sm text-muted-foreground">
                <input type="checkbox" checked={fileForm.favorite} onChange={(event) => setFileForm((current) => ({ ...current, favorite: event.target.checked }))} />
                Marcar como favorito
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsMaterialDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSaveMaterial} disabled={isSyncingDriveMaterial}>
                {isSyncingDriveMaterial ? 'Sincronizando...' : editingMaterialId ? 'Salvar alterações' : 'Adicionar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={isDriveDialogOpen}
          onOpenChange={(open) => {
            setIsDriveDialogOpen(open);
            if (!open) {
              setIsManualDriveSectionOpen(false);
              setIsParentFolderSectionOpen(false);
            }
          }}
        >
          <DialogContent className="w-[calc(100vw-1.5rem)] max-w-lg overflow-hidden [&>button]:h-11 [&>button]:w-11 [&>button]:flex [&>button]:items-center [&>button]:justify-center" onInteractOutside={(event) => event.preventDefault()} onCloseAutoFocus={restoreMaterialDialogFocus}>
            <DialogHeader>
              <DialogTitle>{projectDriveConfig ? 'Alterar conexao do Google Drive' : 'Conectar Google Drive'}</DialogTitle>
              <DialogDescription>
                {driveConnectionStatus?.connected
                  ? 'Sua conta ja esta conectada. Basta dar um nome ao projeto: a pasta e criada automaticamente dentro de "Clareia", no seu Google Drive.'
                  : 'Conecte sua conta do Google para criar a pasta automaticamente, ou informe o link de uma pasta ja existente.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 min-w-0">
              <div className="space-y-2 min-w-0">
                <Label className="break-words">Nome da pasta do projeto</Label>
                <Input
                  className="w-full min-w-0"
                  value={driveConfigForm.folderName}
                  onChange={(event) => setDriveConfigForm((current) => ({ ...current, folderName: event.target.value }))}
                  placeholder="Ex.: Expocentro"
                />
              </div>

              {driveConnectionStatus?.connected && (
                <div className="min-w-0">
                  <button
                    type="button"
                    className="text-sm text-muted-foreground underline underline-offset-2"
                    onClick={() => setIsParentFolderSectionOpen((current) => !current)}
                  >
                    {isParentFolderSectionOpen ? 'Ocultar opcao avancada' : 'Quero escolher em qual pasta do Drive criar (avancado)'}
                  </button>

                  {isParentFolderSectionOpen && (
                    <div className="space-y-2 min-w-0 rounded-md border border-border p-3 mt-2">
                      <Label className="break-words">Link da pasta onde criar (opcional)</Label>
                      <Input
                        className="w-full min-w-0"
                        value={driveConfigForm.parentFolderUrl || ''}
                        onChange={(event) => {
                          const nextUrl = event.target.value;
                          const extractedId = extractDriveFolderId(nextUrl);
                          setDriveConfigForm((current) => ({
                            ...current,
                            parentFolderUrl: nextUrl,
                            parentFolderId: extractedId || ''
                          }));
                        }}
                        placeholder="Ex.: link da pasta 'Projetos' ja existente no seu Drive"
                      />
                      <p className="text-xs text-muted-foreground">
                        Deixe em branco para usar a pasta padrao "Clareia" (criada automaticamente).
                      </p>
                    </div>
                  )}
                </div>
              )}

              {projectDriveConfig?.driveFolderUrl && (
                <div className="space-y-2 min-w-0">
                  <Label className="break-words">Status</Label>
                  <Input value={driveConfigForm.status || 'conectado'} readOnly className="w-full min-w-0 bg-muted/40" />
                </div>
              )}

              {!driveConnectionStatus?.connected && (
                <div className="space-y-3 min-w-0 rounded-md border border-border p-3">
                  <p className="text-sm text-muted-foreground">
                    Ja tem uma pasta criada no Google Drive? Cole o link dela abaixo.
                  </p>
                  <div className="space-y-2 min-w-0">
                    <Label className="break-words">Link da pasta do Google Drive</Label>
                    <Input
                      className="w-full min-w-0"
                      value={driveConfigForm.driveFolderUrl}
                      onChange={(event) => {
                        const nextUrl = event.target.value;
                        const extractedId = extractDriveFolderId(nextUrl);
                        setDriveConfigForm((current) => ({
                          ...current,
                          driveFolderUrl: nextUrl,
                          driveFolderId: extractedId || current.driveFolderId
                        }));
                      }}
                      placeholder="https://drive.google.com/drive/folders/..."
                    />
                  </div>
                </div>
              )}

              {driveConnectionStatus?.connected && (
                <div className="min-w-0">
                  <button
                    type="button"
                    className="text-sm text-muted-foreground underline underline-offset-2"
                    onClick={() => setIsManualDriveSectionOpen((current) => !current)}
                  >
                    {isManualDriveSectionOpen ? 'Ocultar opcao manual' : 'Prefiro vincular uma pasta ja existente'}
                  </button>

                  {isManualDriveSectionOpen && (
                    <div className="space-y-3 min-w-0 rounded-md border border-border p-3 mt-2">
                      <div className="space-y-2 min-w-0">
                        <Label className="break-words">Link da pasta do Google Drive</Label>
                        <Input
                          className="w-full min-w-0"
                          value={driveConfigForm.driveFolderUrl}
                          onChange={(event) => {
                            const nextUrl = event.target.value;
                            const extractedId = extractDriveFolderId(nextUrl);
                            setDriveConfigForm((current) => ({
                              ...current,
                              driveFolderUrl: nextUrl,
                              driveFolderId: extractedId || current.driveFolderId
                            }));
                          }}
                          placeholder="https://drive.google.com/drive/folders/..."
                        />
                      </div>
                      <Button
                        className="w-full sm:w-auto"
                        variant="outline"
                        onClick={async () => {
                          const ok = await handleSaveProjectDriveConfig();
                          if (ok) setIsDriveDialogOpen(false);
                        }}
                      >
                        Salvar pasta do Drive
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <DialogFooter className="gap-2 sm:justify-end sm:flex-wrap">
              {driveConnectionStatus?.connected ? (
                <Button className="w-full sm:w-auto" onClick={handleCreateDriveDefaultSubfolders} disabled={isBootstrappingDriveFolders}>
                  {isBootstrappingDriveFolders ? 'Criando pasta...' : 'Criar pasta do projeto no Drive'}
                </Button>
              ) : (
                <Button className="w-full sm:w-auto" onClick={handleConnectGoogleDriveAutomatic} disabled={isConnectingDrive}>
                  {isConnectingDrive ? 'Conectando...' : 'Conectar Google Drive'}
                </Button>
              )}
              <Button className="w-full sm:w-auto" variant="outline" onClick={() => setIsDriveDialogOpen(false)}>Fechar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={isEditSessionDialogOpen}
          onOpenChange={(open) => {
            setIsEditSessionDialogOpen(open);
            if (!open) {
              setEditingSessionId(null);
              setEditSessionForm({ title: '', durationMinutes: '', notes: '' });
            }
          }}
        >
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Editar sessao de trabalho</DialogTitle>
              <DialogDescription>
                Ajuste descricao, duracao e observacoes da sessao.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="edit-session-title">Descricao</Label>
                <Input
                  id="edit-session-title"
                  value={editSessionForm.title}
                  onChange={(event) => setEditSessionForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Ex.: Revisao de planejamento"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-session-duration">Duracao (minutos)</Label>
                <Input
                  id="edit-session-duration"
                  type="number"
                  min="1"
                  value={editSessionForm.durationMinutes}
                  onChange={(event) => setEditSessionForm((current) => ({ ...current, durationMinutes: event.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-session-notes">Observacoes</Label>
                <Textarea
                  id="edit-session-notes"
                  className="min-h-24"
                  value={editSessionForm.notes}
                  onChange={(event) => setEditSessionForm((current) => ({ ...current, notes: event.target.value }))}
                  placeholder="Contexto rapido desta sessao"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditSessionDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveSessionEdit}>Salvar alteracoes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog
          open={isDeleteSessionDialogOpen}
          onOpenChange={(open) => {
            setIsDeleteSessionDialogOpen(open);
            if (!open) {
              setSessionToDelete(null);
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir sessao de tempo</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acao remove o registro de tempo permanentemente do projeto.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm text-muted-foreground space-y-1">
              <p><span className="font-medium text-foreground">Sessao:</span> {sessionToDelete?.title || 'Sessao de trabalho'}</p>
              <p><span className="font-medium text-foreground">Duracao:</span> {sessionToDelete?.durationMinutes || 0} min</p>
              <p><span className="font-medium text-foreground">Inicio:</span> {formatDateTime(sessionToDelete?.startedAt)}</p>
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDeleteSession} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Excluir sessao
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog
          open={isReopenTaskDialogOpen}
          onOpenChange={(open) => {
            setIsReopenTaskDialogOpen(open);
            if (!open) {
              setReopenTaskTarget(null);
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Deseja reabrir esta tarefa?</AlertDialogTitle>
              <AlertDialogDescription>
                A tarefa retornará para as tarefas abertas mantendo todo o histórico anterior.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm text-muted-foreground space-y-1">
              <p><span className="font-medium text-foreground">Tarefa:</span> {reopenTaskTarget?.taskTitle || '-'}</p>
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => confirmReopenTask('Hoje')}>
                Reabrir para hoje
              </AlertDialogAction>
              <AlertDialogAction onClick={() => confirmReopenTask('Esta semana')}>
                Reabrir para esta semana
              </AlertDialogAction>
              <AlertDialogAction onClick={() => confirmReopenTask('Pendente')}>
                Reabrir como pendente
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog
          open={isGenericDeleteDialogOpen}
          onOpenChange={(open) => {
            setIsGenericDeleteDialogOpen(open);
            if (!open) {
              setGenericDeleteTarget(null);
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{genericDeleteTarget?.title || 'Confirmar exclusao'}</AlertDialogTitle>
              <AlertDialogDescription>
                {genericDeleteTarget?.description || 'Esta acao remove o item selecionado permanentemente.'}
              </AlertDialogDescription>
            </AlertDialogHeader>

            {genericDeleteTarget?.label && (
              <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Item:</span> {genericDeleteTarget.label}
              </div>
            )}

            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmGenericDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Renomear projeto</AlertDialogTitle>
              <AlertDialogDescription>
                Defina o novo nome para este projeto. Todos os vinculos relacionados serao atualizados automaticamente.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="space-y-2">
              <Label htmlFor="rename-project-input">Novo nome</Label>
              <Input
                id="rename-project-input"
                value={renameTargetName}
                onChange={(event) => setRenameTargetName(event.target.value)}
                placeholder="Informe o novo nome"
                autoFocus
              />
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmRenameProject}>
                Confirmar renomeacao
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={isMergeDialogOpen} onOpenChange={setIsMergeDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Mesclar projeto</DialogTitle>
              <DialogDescription>
                Todo o conteúdo de {selectedProject} será movido para o projeto escolhido. A origem será excluída somente após a movimentação remota.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label>Projeto de destino</Label>
              <Select value={mergeTargetName} onValueChange={setMergeTargetName}>
                <SelectTrigger><SelectValue placeholder="Escolha o destino" /></SelectTrigger>
                <SelectContent>
                  {allProjects.filter((projectName) => projectName !== selectedProject).map((projectName) => (
                    <SelectItem key={projectName} value={projectName}>{projectName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsMergeDialogOpen(false)} disabled={isMergingProject}>Cancelar</Button>
              <Button onClick={confirmMergeProject} disabled={!mergeTargetName || isMergingProject}>
                <GitMerge className="mr-2 h-4 w-4" /> {isMergingProject ? 'Mesclando...' : 'Mesclar projetos'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isCreateProjectOpen} onOpenChange={setIsCreateProjectOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo projeto</DialogTitle>
              <DialogDescription>Crie o projeto agora. Os detalhes podem ser ajustados depois.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-project-name">Nome</Label>
                <Input
                  id="new-project-name"
                  value={newProjectForm.name}
                  onChange={(event) => setNewProjectForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Ex.: Monitoramento de Sites"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo de projeto</Label>
                <Select value={newProjectForm.projectType} onValueChange={(value) => setNewProjectForm((current) => ({ ...current, projectType: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROJECT_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>{option}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-project-summary">Objetivo/resumo</Label>
                <Textarea
                  id="new-project-summary"
                  value={newProjectForm.summary}
                  onChange={(event) => setNewProjectForm((current) => ({ ...current, summary: event.target.value }))}
                  placeholder="Resumo executivo do objetivo do projeto."
                  className="min-h-24"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateProjectOpen(false)} disabled={isCreatingProject}>Cancelar</Button>
              <Button onClick={handleCreateProject} disabled={isCreatingProject}>
                {isCreatingProject ? 'Criando...' : 'Criar projeto'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir projeto</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acao remove a area de trabalho (pastas, arquivos, links, acessos, notas e historico) e desvincula tarefas.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="rounded-lg border border-border bg-muted/20 p-3">
              <p className="text-sm font-medium text-foreground mb-2">Impacto desta exclusao</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <p>Tarefas desvinculadas: {deleteImpact.tasksToUnlink}</p>
                <p>Pastas removidas: {deleteImpact.foldersToDelete}</p>
                <p>Arquivos removidos: {deleteImpact.filesToDelete}</p>
                <p>Links removidos: {deleteImpact.linksToDelete}</p>
                <p>Acessos removidos: {deleteImpact.accessesToDelete}</p>
                <p>Notas removidas: {deleteImpact.notesToDelete}</p>
                <p>Historico removido: {deleteImpact.historyToDelete}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="delete-project-input">
                Digite o nome do projeto para confirmar: <span className="font-medium">{selectedProject}</span>
              </Label>
              <Input
                id="delete-project-input"
                value={deleteConfirmName}
                onChange={(event) => setDeleteConfirmName(event.target.value)}
                placeholder="Nome exato do projeto"
                autoFocus
              />
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDeleteProject} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Excluir definitivamente
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </>
  );
}
