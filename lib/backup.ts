import fs from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";

const DB_PATH = path.join(process.cwd(), "data", "calfi.db");
const BACKUP_DIR =
  process.env.CALFI_BACKUP_DIR ?? path.join(process.cwd(), "backups");
const BACKUP_PATH = path.join(BACKUP_DIR, "calfi.db");
const HISTORY_DIR = path.join(BACKUP_DIR, "history");
const HISTORY_RETENTION_DAYS = 90;

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

/**
 * Antes de pisar el backup "último" con el estado nuevo, guarda una copia del
 * estado previo con fecha (una por día). Así, si alguna escritura rompe algo,
 * hay puntos de restauración anteriores en vez de un solo archivo que siempre
 * se sobreescribe.
 */
function rotateHistory(): void {
  if (!fs.existsSync(BACKUP_PATH)) return;
  fs.mkdirSync(HISTORY_DIR, { recursive: true });
  const historyPath = path.join(HISTORY_DIR, `calfi-${todayStamp()}.db`);
  if (!fs.existsSync(historyPath)) {
    fs.copyFileSync(BACKUP_PATH, historyPath);
  }
  pruneOldHistory();
}

function pruneOldHistory(): void {
  const cutoff = Date.now() - HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  for (const file of fs.readdirSync(HISTORY_DIR)) {
    const filePath = path.join(HISTORY_DIR, file);
    if (fs.statSync(filePath).mtimeMs < cutoff) fs.unlinkSync(filePath);
  }
}

/**
 * La DB corre en modo WAL: las escrituras recientes pueden vivir solo en
 * calfi.db-wal hasta que se hace checkpoint. Copiar calfi.db a mano sin
 * forzar el checkpoint puede backupear una versión desactualizada.
 */
export function backupDatabase(connection: Database.Database): void {
  if (!fs.existsSync(DB_PATH)) return;
  connection.pragma("wal_checkpoint(TRUNCATE)");
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  rotateHistory();
  fs.copyFileSync(DB_PATH, BACKUP_PATH);
}
