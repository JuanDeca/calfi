import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { seedCategories } from "./seed";
import { backupDatabase } from "./backup";

const DB_PATH = path.join(process.cwd(), "data", "calfi.db");
const MIGRATIONS_DIR = path.join(process.cwd(), "migrations");

function runMigrations(connection: Database.Database): void {
  connection.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime('now')))"
  );
  const applied = new Set(
    (connection.prepare("SELECT name FROM schema_migrations").all() as { name: string }[]).map(
      (row) => row.name
    )
  );
  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
  const markApplied = connection.prepare(
    "INSERT INTO schema_migrations (name) VALUES (?)"
  );

  for (const file of files) {
    if (applied.has(file)) continue;
    const runMigration = connection.transaction(() => {
      connection.exec(fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8"));
      markApplied.run(file);
    });
    runMigration();
  }
}

function createConnection(): Database.Database {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const connection = new Database(DB_PATH);
  connection.pragma("journal_mode = WAL");
  runMigrations(connection);
  seedCategories(connection);
  return connection;
}

declare global {
  var __calfiDb: Database.Database | undefined;
}

export const db = globalThis.__calfiDb ?? createConnection();

if (process.env.NODE_ENV !== "production") {
  globalThis.__calfiDb = db;
}

/**
 * Envuelve cualquier escritura en la DB para que dispare el backup
 * automático a Cerebro sin que cada endpoint tenga que acordarse.
 */
export function mutate<T>(fn: (connection: Database.Database) => T): T {
  const result = fn(db);
  backupDatabase(db);
  return result;
}
