import { Pool, type QueryResultRow } from "pg";

declare global {
  var __lacuevitaPool: Pool | undefined;
}

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  return new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000
  });
}

export function getPool(): Pool {
  if (!globalThis.__lacuevitaPool) {
    globalThis.__lacuevitaPool = createPool();
  }

  return globalThis.__lacuevitaPool;
}

export async function query<T extends QueryResultRow>(text: string, params: unknown[] = []) {
  return getPool().query<T>(text, params);
}
