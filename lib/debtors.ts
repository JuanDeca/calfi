import { db, mutate } from "@/lib/db";

export interface DebtorDebt {
  id: number;
  debtorId: number;
  concept: string;
  amount: number;
  status: "Pendiente" | "Pagado";
  createdAt: string;
  paidAt: string | null;
}

export interface Debtor {
  id: number;
  name: string;
  notes: string | null;
  createdAt: string;
  debts: DebtorDebt[];
}

interface DebtorRow {
  id: number;
  name: string;
  notes: string | null;
  created_at: string;
}

interface DebtRow {
  id: number;
  debtor_id: number;
  concept: string;
  amount: number;
  status: "Pendiente" | "Pagado";
  created_at: string;
  paid_at: string | null;
}

function toDebt(row: DebtRow): DebtorDebt {
  return {
    id: row.id,
    debtorId: row.debtor_id,
    concept: row.concept,
    amount: row.amount,
    status: row.status,
    createdAt: row.created_at,
    paidAt: row.paid_at,
  };
}

export function getDebtors(): Debtor[] {
  const debtorRows = db
    .prepare("SELECT id, name, notes, created_at FROM debtors ORDER BY name")
    .all() as DebtorRow[];
  const debtRows = db
    .prepare("SELECT id, debtor_id, concept, amount, status, created_at, paid_at FROM debtor_debts ORDER BY created_at")
    .all() as DebtRow[];

  return debtorRows.map((row) => ({
    id: row.id,
    name: row.name,
    notes: row.notes,
    createdAt: row.created_at,
    debts: debtRows.filter((debt) => debt.debtor_id === row.id).map(toDebt),
  }));
}

export function createDebtor(name: string, notes: string | null): number {
  return mutate((connection) => {
    const info = connection
      .prepare("INSERT INTO debtors (name, notes) VALUES (?, ?)")
      .run(name, notes);
    return Number(info.lastInsertRowid);
  });
}

export function deleteDebtor(id: number): void {
  mutate((connection) => {
    connection.prepare("DELETE FROM debtor_debts WHERE debtor_id = ?").run(id);
    connection.prepare("DELETE FROM debtors WHERE id = ?").run(id);
  });
}

export function createDebtorDebt(debtorId: number, concept: string, amount: number): number {
  return mutate((connection) => {
    const info = connection
      .prepare("INSERT INTO debtor_debts (debtor_id, concept, amount) VALUES (?, ?, ?)")
      .run(debtorId, concept, amount);
    return Number(info.lastInsertRowid);
  });
}

export function setDebtorDebtStatus(id: number, status: "Pendiente" | "Pagado"): void {
  mutate((connection) => {
    connection
      .prepare(
        "UPDATE debtor_debts SET status = ?, paid_at = CASE WHEN ? = 'Pagado' THEN datetime('now') ELSE NULL END WHERE id = ?"
      )
      .run(status, status, id);
  });
}

export function deleteDebtorDebt(id: number): void {
  mutate((connection) => {
    connection.prepare("DELETE FROM debtor_debts WHERE id = ?").run(id);
  });
}
