import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Client } = pg;
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is required to run migrations.");
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(__dirname, "..", "db", "schema.sql");
const schema = await readFile(schemaPath, "utf8");
const client = new Client({
  connectionString: databaseUrl,
  ssl: process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: false }
});

try {
  await client.connect();
  await client.query(schema);
  console.log("Database schema applied.");
} finally {
  await client.end();
}

