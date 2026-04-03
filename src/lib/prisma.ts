import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

// [SSL-STABILIZATION] UNIVERSAL ADAPTER PATTERN
// This handles both Local and Cloud connections using the pg pool adapter
// which is the most stable path in Prisma 7 for dynamic URLs.
const getPrismaClient = () => {
    const connectionURL = process.env.DATABASE_URL || "postgresql://postgres:hms2035@localhost:5432/hms_db";
    
    // Configure Pool based on connection type
    const isCloud = connectionURL.includes('neon.tech');
    
    console.log(`\x1b[36m[PRISMA]\x1b[0m INITIALIZING ${isCloud ? 'NEON CLOUD' : 'LOCAL'} ADAPTER...`);

    const pool = new Pool({
        connectionString: connectionURL,
        max: 10,
        connectionTimeoutMillis: 15000,
        ssl: isCloud ? { rejectUnauthorized: false } : false
    });

    const adapter = new PrismaPg(pool);
    
    // We pass the adapter instead of the URL to the constructor
    // This bypasses 'Unknown property' validation errors in Prisma 7
    return new PrismaClient({ 
        adapter, 
        log: ['error'] 
    });
};

declare global {
  var prismaGlobal: undefined | ReturnType<typeof getPrismaClient>
}

export const prisma = globalThis.prismaGlobal ?? getPrismaClient();

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma;
