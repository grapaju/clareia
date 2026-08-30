import { runQuery, withTransaction } from './postgres.js';

const schemaSql = `
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT DEFAULT '',
  current_account_id TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id TEXT DEFAULT '',
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_user_created ON tasks(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS task_notes (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id TEXT DEFAULT '',
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_notes_task_user ON task_notes(task_id, user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS focus_sessions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id TEXT DEFAULT '',
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_focus_sessions_task_user ON focus_sessions(task_id, user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS app_records (
  id TEXT PRIMARY KEY,
  collection_name TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id TEXT DEFAULT '',
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_records_collection_user_created
  ON app_records(collection_name, user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS integrated_ai_messages (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID,
  role TEXT NOT NULL,
  content JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integrated_ai_messages_user_created
  ON integrated_ai_messages(user_id, created_at ASC);

CREATE TABLE IF NOT EXISTS google_drive_connections (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email TEXT DEFAULT '',
  scope TEXT DEFAULT '',
  encrypted_refresh_token TEXT DEFAULT '',
  default_parent_folder_id TEXT,
  default_parent_folder_url TEXT,
  default_parent_folder_name TEXT,
  connected_at TIMESTAMPTZ,
  status TEXT DEFAULT 'connected',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS google_drive_project_folders (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL,
  project_name TEXT DEFAULT '',
  project_type TEXT DEFAULT '',
  root_folder_id TEXT DEFAULT '',
  root_folder_url TEXT DEFAULT '',
  subfolders_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_synced_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, project_id)
);

CREATE TABLE IF NOT EXISTS project_profiles (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  summary TEXT DEFAULT '',
  project_type TEXT DEFAULT 'Administrativo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_project_profiles_user_name_ci
  ON project_profiles(user_id, lower(name));

CREATE TABLE IF NOT EXISTS project_aliases (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id TEXT DEFAULT '',
  alias TEXT NOT NULL,
  alias_normalized TEXT NOT NULL,
  project_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, account_id, alias_normalized)
);

CREATE INDEX IF NOT EXISTS idx_project_aliases_user_project
  ON project_aliases(user_id, account_id, project_name);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';

ALTER TABLE google_drive_connections
  ADD COLUMN IF NOT EXISTS default_parent_folder_id TEXT;

ALTER TABLE google_drive_connections
  ADD COLUMN IF NOT EXISTS default_parent_folder_url TEXT;

ALTER TABLE google_drive_connections
  ADD COLUMN IF NOT EXISTS default_parent_folder_name TEXT;
`;

const lifecycleRepairSql = `
WITH normalized AS (
  SELECT
    id,
    CASE
      WHEN lower(data->>'status') IN ('concluída', 'concluida', 'concluido', 'completed', 'done') THEN 'concluida'
      WHEN lower(data->>'status') IN ('fazendo', 'em andamento', 'em_andamento') THEN 'em_andamento'
      WHEN lower(data->>'status') IN ('pausada', 'pausado') THEN 'pausada'
      WHEN lower(data->>'status') IN ('aguardando retorno', 'aguardando_retorno') THEN 'aguardando_retorno'
      WHEN lower(data->>'status') IN ('arquivada', 'arquivado', 'backlog') THEN 'arquivada'
      WHEN lower(data->>'status') IN ('hoje', 'esta semana', 'próxima semana', 'proxima semana', 'pendente', 'adiado') THEN 'pendente'
      ELSE NULL
    END AS canonical_status,
    data,
    updated_at
  FROM tasks
)
UPDATE tasks AS task
SET data = CASE
  WHEN normalized.canonical_status = 'concluida' THEN
    jsonb_set(
      jsonb_set(normalized.data, '{status}', to_jsonb(normalized.canonical_status), true),
      '{completedAt}',
      to_jsonb(COALESCE(NULLIF(normalized.data->>'completedAt', ''), normalized.updated_at::text)),
      true
    )
  ELSE jsonb_set(normalized.data, '{status}', to_jsonb(normalized.canonical_status), true)
END
FROM normalized
WHERE task.id = normalized.id
  AND normalized.canonical_status IS NOT NULL
  AND (
    task.data->>'status' IS DISTINCT FROM normalized.canonical_status
    OR (normalized.canonical_status = 'concluida' AND COALESCE(task.data->>'completedAt', '') = '')
  );

DELETE FROM focus_sessions AS duplicate
USING focus_sessions AS original
WHERE duplicate.user_id = original.user_id
  AND duplicate.task_id = original.task_id
  AND COALESCE(duplicate.data->>'idempotencyKey', '') <> ''
  AND duplicate.data->>'idempotencyKey' = original.data->>'idempotencyKey'
  AND (duplicate.created_at, duplicate.id) > (original.created_at, original.id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_focus_sessions_user_task_idempotency
  ON focus_sessions(user_id, task_id, (data->>'idempotencyKey'))
  WHERE COALESCE(data->>'idempotencyKey', '') <> '';
`;

export async function ensurePostgresSchema() {
  await runQuery(schemaSql);
  await withTransaction((client) => client.query(lifecycleRepairSql));
}
