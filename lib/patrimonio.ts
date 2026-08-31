import type Database from "better-sqlite3";
import { db, mutate } from "@/lib/db";

type Kind = "assets" | "debts";
const HISTORY_TABLE: Record<Kind, string> = { assets: "asset_history", debts: "debt_history" };
const HISTORY_FK: Record<Kind, string> = { assets: "asset_id", debts: "debt_id" };

export interface AssetOrDebt {
  id: number;
  name: string;
  type: string;
  currentValue: number;
  includedInBalance: boolean;
  updatedAt: string;
}

interface Row {
  id: number;
  name: string;
  type: string;
  current_value: number;
  included_in_balance: number;
  updated_at: string;
}

function toEntity(row: Row): AssetOrDebt {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    currentValue: row.current_value,
    includedInBalance: Boolean(row.included_in_balance),
    updatedAt: row.updated_at,
  };
}

function getAll(kind: Kind): AssetOrDebt[] {
  const rows = db.prepare(`SELECT * FROM ${kind} ORDER BY name`).all() as Row[];
  return rows.map(toEntity);
}

export const getAssets = () => getAll("assets");
export const getDebts = () => getAll("debts");

function create(kind: Kind, name: string, type: string, currentValue: number): number {
  return mutate((connection) => {
    const info = connection
      .prepare(`INSERT INTO ${kind} (name, type, current_value) VALUES (?, ?, ?)`)
      .run(name, type, currentValue);
    const id = Number(info.lastInsertRowid);
    connection
      .prepare(`INSERT INTO ${HISTORY_TABLE[kind]} (${HISTORY_FK[kind]}, value) VALUES (?, ?)`)
      .run(id, currentValue);
    return id;
  });
}

export const createAsset = (name: string, type: string, currentValue: number) =>
  create("assets", name, type, currentValue);
export const createDebt = (name: string, type: string, currentValue: number) =>
  create("debts", name, type, currentValue);

function updateValue(kind: Kind, id: number, newValue: number): void {
  mutate((connection) => {
    connection
      .prepare(`UPDATE ${kind} SET current_value = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(newValue, id);
    connection
      .prepare(`INSERT INTO ${HISTORY_TABLE[kind]} (${HISTORY_FK[kind]}, value) VALUES (?, ?)`)
      .run(id, newValue);
  });
}

export const updateAssetValue = (id: number, newValue: number) => updateValue("assets", id, newValue);
export const updateDebtValue = (id: number, newValue: number) => updateValue("debts", id, newValue);

/**
 * Suma (o resta, con delta negativo) al valor actual de un activo y registra
 * el nuevo total en su historial — usado por las categorías vinculadas a un
 * activo (`categories.linked_asset_id`) para que Patrimonio se actualice solo
 * cuando se categoriza una transacción ahí, sin que haga falta editarlo a mano.
 * Recibe `connection` directo (no envuelve en `mutate`) para poder llamarse
 * desde adentro de otro `mutate()` ya abierto (categorizar, importar, etc.).
 */
export function bumpAssetValue(
  connection: Database.Database,
  assetId: number,
  delta: number,
  date?: string
): void {
  const row = connection.prepare("SELECT current_value FROM assets WHERE id = ?").get(assetId) as
    | { current_value: number }
    | undefined;
  if (!row) return;

  const newValue = row.current_value + delta;
  connection
    .prepare("UPDATE assets SET current_value = ?, updated_at = datetime('now') WHERE id = ?")
    .run(newValue, assetId);
  if (date) {
    connection
      .prepare("INSERT INTO asset_history (asset_id, value, recorded_at) VALUES (?, ?, ?)")
      .run(assetId, newValue, date);
  } else {
    connection.prepare("INSERT INTO asset_history (asset_id, value) VALUES (?, ?)").run(assetId, newValue);
  }
}

function toggleIncluded(kind: Kind, id: number, included: boolean): void {
  mutate((connection) => {
    connection
      .prepare(`UPDATE ${kind} SET included_in_balance = ? WHERE id = ?`)
      .run(included ? 1 : 0, id);
  });
}

export const toggleAssetIncluded = (id: number, included: boolean) =>
  toggleIncluded("assets", id, included);
export const toggleDebtIncluded = (id: number, included: boolean) =>
  toggleIncluded("debts", id, included);

function remove(kind: Kind, id: number): void {
  mutate((connection) => {
    connection.prepare(`DELETE FROM ${HISTORY_TABLE[kind]} WHERE ${HISTORY_FK[kind]} = ?`).run(id);
    connection.prepare(`DELETE FROM ${kind} WHERE id = ?`).run(id);
  });
}

export const deleteAsset = (id: number) => remove("assets", id);
export const deleteDebt = (id: number) => remove("debts", id);

export interface NetWorth {
  totalAssets: number;
  totalDebts: number;
  netWorth: number;
}

export function getNetWorth(): NetWorth {
  const { total: totalAssets } = db
    .prepare("SELECT COALESCE(SUM(current_value), 0) AS total FROM assets WHERE included_in_balance = 1")
    .get() as { total: number };
  const { total: totalDebts } = db
    .prepare("SELECT COALESCE(SUM(current_value), 0) AS total FROM debts WHERE included_in_balance = 1")
    .get() as { total: number };
  return { totalAssets, totalDebts, netWorth: totalAssets - totalDebts };
}

export interface MonthlyHistoryRow {
  id: number;
  name: string;
  valuesByMonth: Record<string, number>;
}

export interface MonthlyHistory {
  months: string[];
  assets: MonthlyHistoryRow[];
  debts: MonthlyHistoryRow[];
}

function getMonthlyHistoryFor(kind: Kind): { entries: MonthlyHistoryRow[]; months: Set<string> } {
  const entities = getAll(kind);
  const rows = db
    .prepare(
      `SELECT ${HISTORY_FK[kind]} AS entity_id, strftime('%Y-%m', recorded_at) AS month, value
       FROM ${HISTORY_TABLE[kind]} ORDER BY recorded_at ASC`
    )
    .all() as { entity_id: number; month: string; value: number }[];

  const months = new Set<string>();
  const byEntity = new Map<number, Record<string, number>>();
  for (const row of rows) {
    months.add(row.month);
    if (!byEntity.has(row.entity_id)) byEntity.set(row.entity_id, {});
    byEntity.get(row.entity_id)![row.month] = row.value;
  }

  const entries = entities.map((entity) => ({
    id: entity.id,
    name: entity.name,
    valuesByMonth: byEntity.get(entity.id) ?? {},
  }));

  return { entries, months };
}

export function getMonthlyHistory(): MonthlyHistory {
  const assetsData = getMonthlyHistoryFor("assets");
  const debtsData = getMonthlyHistoryFor("debts");
  const allMonths = Array.from(new Set([...assetsData.months, ...debtsData.months])).sort();
  const months = allMonths.slice(-6);

  return { months, assets: assetsData.entries, debts: debtsData.entries };
}
