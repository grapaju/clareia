import React, { useEffect, useState } from 'react';
import { Check, ChevronsUpDown, FolderPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { createProjectProfileApi, listProjectProfilesApi } from '@/services/projectProfilesApiService.js';
import { cn } from '@/lib/utils.js';

export default function ProjectSelect({ value = '', onChange, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState([]);
  const [creating, setCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const loadProjects = async () => {
    try {
      const items = await listProjectProfilesApi();
      setProjects(Array.isArray(items) ? items : []);
      setError('');
    } catch {
      setError('Não foi possível carregar os projetos.');
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const selectProject = (projectName) => {
    onChange(projectName);
    setOpen(false);
    setCreating(false);
    setError('');
  };

  const selectPersonal = async () => {
    const existing = projects.find((project) => project.name.toLocaleLowerCase('pt-BR') === 'pessoal');
    if (!existing) {
      try {
        const created = await createProjectProfileApi({
          name: 'Pessoal',
          summary: 'Projeto pessoal padrão do Clareia.',
          projectType: 'Pessoal',
        });
        setProjects((current) => [...current, created]);
      } catch (requestError) {
        if (requestError?.status !== 409) {
          setError('Não foi possível preparar o projeto Pessoal.');
          return;
        }
      }
    }
    selectProject('Pessoal');
  };

  const createProject = async () => {
    const name = newProjectName.trim();
    if (!name) return;
    setIsSaving(true);
    setError('');
    try {
      const created = await createProjectProfileApi({ name, projectType: 'Administrativo' });
      setProjects((current) => [...current, created]);
      setNewProjectName('');
      selectProject(created.name);
    } catch (requestError) {
      setError(requestError?.status === 409
        ? 'Já existe um projeto com esse nome. Selecione-o na lista.'
        : 'Não foi possível criar o projeto.');
      await loadProjects();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={(nextOpen) => {
      setOpen(nextOpen);
      if (nextOpen) loadProjects();
      if (!nextOpen) setCreating(false);
    }}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between bg-background font-normal"
          disabled={disabled}
        >
          <span className="truncate">{value || 'Sem projeto / decidir depois'}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
        {creating ? (
          <div className="space-y-3 p-3">
            <p className="text-sm font-medium">Criar novo projeto</p>
            <Input
              autoFocus
              value={newProjectName}
              onChange={(event) => setNewProjectName(event.target.value)}
              placeholder="Nome do projeto"
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  createProject();
                }
              }}
            />
            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setCreating(false)}>Voltar</Button>
              <Button type="button" size="sm" onClick={createProject} disabled={!newProjectName.trim() || isSaving}>
                {isSaving ? 'Criando...' : 'Criar projeto'}
              </Button>
            </div>
          </div>
        ) : (
          <Command>
            <CommandInput placeholder="Buscar projeto..." />
            <CommandList>
              <CommandEmpty>Nenhum projeto encontrado.</CommandEmpty>
              <CommandGroup>
                <CommandItem value="sem projeto decidir depois" onSelect={() => selectProject('')}>
                  <Check className={cn('h-4 w-4', value ? 'opacity-0' : 'opacity-100')} />
                  Sem projeto / decidir depois
                </CommandItem>
                <CommandItem value="projeto pessoal" onSelect={selectPersonal}>
                  <Check className={cn('h-4 w-4', value === 'Pessoal' ? 'opacity-100' : 'opacity-0')} />
                  Projeto pessoal
                </CommandItem>
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup heading="Projetos existentes">
                {projects
                  .filter((project) => project.name !== 'Pessoal')
                  .map((project) => (
                    <CommandItem key={project.name} value={project.name} onSelect={() => selectProject(project.name)}>
                      <Check className={cn('h-4 w-4', value === project.name ? 'opacity-100' : 'opacity-0')} />
                      {project.name}
                    </CommandItem>
                  ))}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup>
                <CommandItem value="criar novo projeto" onSelect={() => setCreating(true)}>
                  <FolderPlus className="h-4 w-4" />
                  Criar novo projeto
                </CommandItem>
              </CommandGroup>
              {error && <p className="px-3 pb-3 text-sm text-destructive" role="alert">{error}</p>}
            </CommandList>
          </Command>
        )}
      </PopoverContent>
    </Popover>
  );
}
