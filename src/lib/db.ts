import { Pool, type PoolClient, type QueryResultRow } from "pg";

declare global {
  var __lacuevitaPool: Pool | undefined;
}

export type DbClient = Pool | PoolClient;

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

export async function query<T extends QueryResultRow>(
  text: string,
  params: unknown[] = [],
  client?: DbClient
) {
  return (client || getPool()).query<T>(text, params);
}

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();

  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
