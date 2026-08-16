import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { runQuery } from '../db/postgres.js';
import { pocketbaseAuth } from '../middleware/pocketbase-auth.js';
import { signAuthToken } from '../utils/jwt.js';

const router = Router();

function normalizeText(value) {
  return String(value || '').trim();
}

function sanitizeUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name || '',
    currentAccountId: row.current_account_id || '',
    created: row.created_at,
    updated: row.updated_at,
  };
}

router.post('/signup', async (req, res) => {
  const email = normalizeText(req.body?.email).toLowerCase();
  const password = String(req.body?.password || '');
  const passwordConfirm = String(req.body?.passwordConfirm || '');
  const name = normalizeText(req.body?.name);

  if (!email || !password || !passwordConfirm) {
    return res.status(400).json({ message: 'Email e senha sao obrigatorios.' });
  }

  if (password !== passwordConfirm) {
    return res.status(400).json({ message: 'As senhas nao conferem.' });
  }

  if (password.length < 8) {
    return res.status(400).json({ message: 'A senha precisa ter ao menos 8 caracteres.' });
  }

  const existing = await runQuery('SELECT id FROM users WHERE email = $1 LIMIT 1', [email]);
  if (existing.rows.length > 0) {
    return res.status(409).json({ message: 'Este e-mail ja esta cadastrado.' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const created = await runQuery(
    `INSERT INTO users (email, password_hash, name)
     VALUES ($1, $2, $3)
     RETURNING id, email, name, current_account_id, created_at, updated_at`,
    [email, passwordHash, name]
  );

  const user = sanitizeUser(created.rows[0]);
  const token = signAuthToken({
    sub: user.id,
    email: user.email,
    accountId: user.currentAccountId || '',
  });

  res.status(201).json({ token, user });
});

router.post('/login', async (req, res) => {
  const email = normalizeText(req.body?.email).toLowerCase();
  const password = String(req.body?.password || '');

  if (!email || !password) {
    return res.status(400).json({ message: 'Email e senha sao obrigatorios.' });
  }

  const found = await runQuery(
    `SELECT id, email, name, current_account_id, created_at, updated_at, password_hash
     FROM users WHERE email = $1 LIMIT 1`,
    [email]
  );

  const row = found.rows[0];
  if (!row) {
    return res.status(401).json({ message: 'E-mail ou senha incorretos.' });
  }

  const passwordOk = await bcrypt.compare(password, row.password_hash);
  if (!passwordOk) {
    return res.status(401).json({ message: 'E-mail ou senha incorretos.' });
  }

  const user = sanitizeUser(row);
  const token = signAuthToken({
    sub: user.id,
    email: user.email,
    accountId: user.currentAccountId || '',
  });

  res.json({ token, user });
});

router.use(pocketbaseAuth);

router.get('/me', async (req, res) => {
  const found = await runQuery(
    `SELECT id, email, name, current_account_id, created_at, updated_at
     FROM users WHERE id = $1 LIMIT 1`,
    [req.pocketbaseUserId]
  );

  const user = sanitizeUser(found.rows[0]);
  if (!user) {
    return res.status(404).json({ message: 'Usuario nao encontrado.' });
  }

  res.json({ user });
});

router.post('/change-password', async (req, res) => {
  const currentPassword = String(req.body?.currentPassword || '');
  const newPassword = String(req.body?.newPassword || '');
  const newPasswordConfirm = String(req.body?.newPasswordConfirm || '');

  if (!currentPassword || !newPassword || !newPasswordConfirm) {
    return res.status(400).json({ message: 'Preencha todos os campos de senha.' });
  }

  if (newPassword !== newPasswordConfirm) {
    return res.status(400).json({ message: 'A nova senha e a confirmacao nao conferem.' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ message: 'A nova senha precisa ter ao menos 8 caracteres.' });
  }

  const found = await runQuery('SELECT password_hash FROM users WHERE id = $1 LIMIT 1', [req.pocketbaseUserId]);
  const row = found.rows[0];
  if (!row) {
    return res.status(404).json({ message: 'Usuario nao encontrado.' });
  }

  const currentOk = await bcrypt.compare(currentPassword, row.password_hash);
  if (!currentOk) {
    return res.status(400).json({ message: 'Senha atual invalida.' });
  }

  const nextHash = await bcrypt.hash(newPassword, 10);
  await runQuery(
    'UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2',
    [nextHash, req.pocketbaseUserId]
  );

  res.json({ success: true });
});

export default router;
