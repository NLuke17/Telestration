/**
 * Centralized Prisma client
 * Prisma client singleton with PostgreSQL adapter
 */

import { PrismaClient } from '../generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not defined');
}

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

/**
 * Get the Prisma client instance
 */
export function getPrisma(): PrismaClient {
  return prisma;
}

export default prisma;
