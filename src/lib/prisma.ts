import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const prismaClientSingleton = () => {
  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:hms2035@localhost:5432/hms_db';
  const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');

  // [PERFORMANCE] Serverless-optimized pool settings for Vercel + Neon
  // max: 3 is correct for serverless (each lambda gets its own pool)
  // keepAlive prevents TCP timeout on idle connections, reducing Neon cold-starts
  const pool = new Pool({
    connectionString,
    connectionTimeoutMillis: 5000,  // Reduced from 10s — fail fast, don't hang the user
    idleTimeoutMillis: 10000,       // Release idle connections quickly
    max: isLocal ? 10 : 3,                         // Increased for local dev to avoid exhaustion
    keepAlive: true,                // Keeps TCP connection warm to reduce Neon wake-up time
    ssl: isLocal ? false : { rejectUnauthorized: false }
  });

  pool.on('error', (err: any) => console.error('\x1b[31m[PRISMA] Pool Error:\x1b[0m', err.message));

  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log: ['error'],
  });
};

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>
}

// Ensure we reuse the same client in development to avoid pool exhaustion
export const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma;
