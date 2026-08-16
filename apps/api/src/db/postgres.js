import { Pool } from 'pg';
import logger from '../utils/logger.js';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  logger.error('DATABASE_URL e obrigatoria para inicializar o PostgreSQL.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.PGSSL === '1' ? { rejectUnauthorized: false } : undefined,
});

pool.on('error', (error) => {
  logger.error('Erro inesperado no pool PostgreSQL:', error);
});

export async function runQuery(text, params = []) {
  return pool.query(text, params);
}

export async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export { pool };
