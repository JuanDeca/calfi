import { db, mutate } from "@/lib/db";

export interface Event {
  id: number;
  name: string;
  month: string | null;
  description: string | null;
  treatmentNote: string | null;
}

export interface EventSummary extends Event {
  transactionCount: number;
  totalAmount: number;
}

interface EventRow {
  id: number;
  name: string;
  month: string | null;
  description: string | null;
  treatment_note: string | null;
}

function toEvent(row: EventRow): Event {
  return {
    id: row.id,
    name: row.name,
    month: row.month,
    description: row.description,
    treatmentNote: row.treatment_note,
  };
}

export function getEvents(): EventSummary[] {
  const rows = db
    .prepare(
      `
      SELECT e.id, e.name, e.month, e.description, e.treatment_note,
        COUNT(t.id) AS transaction_count,
        COALESCE(SUM(ABS(t.amount)), 0) AS total_amount
      FROM events e
      LEFT JOIN transactions t ON t.event_id = e.id
      GROUP BY e.id
      ORDER BY e.id DESC
    `
    )
    .all() as (EventRow & { transaction_count: number; total_amount: number })[];

  return rows.map((row) => ({
    ...toEvent(row),
    transactionCount: row.transaction_count,
    totalAmount: row.total_amount,
  }));
}

export function getEventById(id: number): Event | null {
  const row = db.prepare("SELECT * FROM events WHERE id = ?").get(id) as EventRow | undefined;
  return row ? toEvent(row) : null;
}

export function createEvent(name: string, description: string | null): number {
  return mutate((connection) => {
    const info = connection
      .prepare("INSERT INTO events (name, description) VALUES (?, ?)")
      .run(name, description);
    return Number(info.lastInsertRowid);
  });
}

export function deleteEvent(id: number): void {
  mutate((connection) => {
    connection.prepare("UPDATE transactions SET event_id = NULL WHERE event_id = ?").run(id);
    connection.prepare("DELETE FROM events WHERE id = ?").run(id);
  });
}
