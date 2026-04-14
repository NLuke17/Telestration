/**
 * Centralized Prisma client
 * Prisma client singleton with PostgreSQL adapter
 */

import { PrismaClient } from '../generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import pgConnectionString from 'pg-connection-string';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not defined');
}

type PgUrlParse = (str: string, options?: { useLibpqCompat?: boolean }) => pg.PoolConfig & { schema?: string };

// RDS URLs use sslmode=require. node-postgres parses that into ssl: {} unless libpq-compat mode is used,
// which leaves TLS misconfigured and every query fails (500s on any DB-backed route).
const parseConnectionString = pgConnectionString as unknown as PgUrlParse;
const poolConfig = parseConnectionString(connectionString, { useLibpqCompat: true });
delete poolConfig.schema;

/** RDS / require-TLS URLs: Node still rejects the Amazon CA chain unless rejectUnauthorized is false. */
function applyRdsTlsWorkaround(config: pg.PoolConfig, url: string): void {
    const isRds = /\.rds\.amazonaws\.com/i.test(url);
    const requiresSsl = /sslmode=require/i.test(url) || /sslmode=verify-ca/i.test(url);
    if (!isRds && !requiresSsl) return;

    const prev = config.ssl;
    if (prev && typeof prev === 'object' && !Array.isArray(prev)) {
        config.ssl = { ...prev, rejectUnauthorized: false };
    } else if (prev === true) {
        config.ssl = { rejectUnauthorized: false };
    } else {
        config.ssl = { rejectUnauthorized: false };
    }
}

applyRdsTlsWorkaround(poolConfig, connectionString);

const pool = new pg.Pool(poolConfig);
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

/**
 * Get the Prisma client instance
 */
export function getPrisma(): PrismaClient {
  return prisma;
}

export default prisma;
