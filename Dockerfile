import pg from 'pg';
import { config } from '../utils/config.js';
import { logger } from '../utils/logger.js';

const { Pool } = pg;

const poolConfig = config.db.url
  ? {
      connectionString: config.db.url,
      ssl: config.env === 'production' ? { rejectUnauthorized: false } : false,
    }
  : {
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
    };

export const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  logger.error('Postgres pool error:', err);
});

export async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const ms = Date.now() - start;
  if (ms > 250) logger.debug(`slow query (${ms}ms):`, text.slice(0, 80));
  return res;
}
