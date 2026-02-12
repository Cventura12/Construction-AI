import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

// Required for Neon WebSocket transport in Node.js runtime (local dev/server).
neonConfig.webSocketConstructor = ws;

const createPrismaClient = (): PrismaClient => {
  const pooledUrl = process.env.DATABASE_URL;
  const directUrl = process.env.DIRECT_URL;
  const connectionString = pooledUrl ?? directUrl;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required to initialize Prisma (DIRECT_URL can be fallback).");
  }

  const pool = new Pool({ connectionString });
  const adapter = new PrismaNeon(pool);
  return new PrismaClient({ adapter });
};

export const prisma = globalThis.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.prisma = prisma;
}

export const getPrisma = (): PrismaClient => prisma;
