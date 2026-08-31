import { db, mutate } from "@/lib/db";

export type PlannedPurchaseStatus = "Pendiente" | "Comprado";

export interface PlannedPurchase {
  id: number;
  name: string;
  notes: string | null;
  estimatedAmount: number | null;
  categoryId: number | null;
  categoryName: string | null;
  categoryIcon: string | null;
  status: PlannedPurchaseStatus;
  priority: number;
  targetMonth: string | null;
  createdAt: string;
  purchasedAt: string | null;
}

interface Row {
  id: number;
  name: string;
  notes: string | null;
  estimated_amount: number | null;
  category_id: number | null;
  category_name: string | null;
  category_icon: string | null;
  status: PlannedPurchaseStatus;
  priority: number;
  target_month: string | null;
  created_at: string;
  purchased_at: string | null;
}

function toPlannedPurchase(row: Row): PlannedPurchase {
  return {
    id: row.id,
    name: row.name,
    notes: row.notes,
    estimatedAmount: row.estimated_amount,
    categoryId: row.category_id,
    categoryName: row.category_name,
    categoryIcon: row.category_icon,
    status: row.status,
    priority: row.priority,
    targetMonth: row.target_month,
    createdAt: row.created_at,
    purchasedAt: row.purchased_at,
  };
}

const SELECT = `
  SELECT p.id, p.name, p.notes, p.estimated_amount, p.category_id, c.name AS category_name,
    c.icon AS category_icon, p.status, p.priority, p.target_month, p.created_at, p.purchased_at
  FROM planned_purchases p
  LEFT JOIN categories c ON c.id = p.category_id
  ORDER BY p.status ASC, p.priority ASC
`;

export function getPlannedPurchases(): PlannedPurchase[] {
  return (db.prepare(SELECT).all() as Row[]).map(toPlannedPurchase);
}

export function createPlannedPurchase(input: {
  name: string;
  notes: string | null;
  estimatedAmount: number | null;
  categoryId: number | null;
  targetMonth: string | null;
}): number {
  return mutate((connection) => {
    const { maxPriority } = connection
      .prepare("SELECT COALESCE(MAX(priority), 0) AS maxPriority FROM planned_purchases WHERE status = 'Pendiente'")
      .get() as { maxPriority: number };
    const info = connection
      .prepare(
        `
        INSERT INTO planned_purchases (name, notes, estimated_amount, category_id, target_month, priority)
        VALUES (@name, @notes, @estimatedAmount, @categoryId, @targetMonth, @priority)
      `
      )
      .run({ ...input, priority: maxPriority + 1 });
    return Number(info.lastInsertRowid);
  });
}

export function updatePlannedPurchase(
  id: number,
  input: {
    name: string;
    notes: string | null;
    estimatedAmount: number | null;
    categoryId: number | null;
    targetMonth: string | null;
  }
): void {
  mutate((connection) => {
    connection
      .prepare(
        `
        UPDATE planned_purchases SET
          name = @name, notes = @notes, estimated_amount = @estimatedAmount, category_id = @categoryId,
          target_month = @targetMonth
        WHERE id = @id
      `
      )
      .run({ ...input, id });
  });
}

export function setPlannedPurchaseStatus(id: number, status: PlannedPurchaseStatus): void {
  mutate((connection) => {
    connection
      .prepare(
        `
        UPDATE planned_purchases SET
          status = ?, purchased_at = CASE WHEN ? = 'Comprado' THEN datetime('now') ELSE NULL END
        WHERE id = ?
      `
      )
      .run(status, status, id);
  });
}

export function deletePlannedPurchase(id: number): void {
  mutate((connection) => {
    connection.prepare("DELETE FROM planned_purchases WHERE id = ?").run(id);
  });
}

/** Intercambia la prioridad con el vecino más cercano en esa dirección, dentro del mismo estado (Pendiente/Comprado no se mezclan). */
export function movePlannedPurchase(id: number, direction: "up" | "down"): void {
  mutate((connection) => {
    const current = connection
      .prepare("SELECT status, priority FROM planned_purchases WHERE id = ?")
      .get(id) as { status: PlannedPurchaseStatus; priority: number } | undefined;
    if (!current) return;

    const neighbor = connection
      .prepare(
        direction === "up"
          ? "SELECT id, priority FROM planned_purchases WHERE status = ? AND priority < ? ORDER BY priority DESC LIMIT 1"
          : "SELECT id, priority FROM planned_purchases WHERE status = ? AND priority > ? ORDER BY priority ASC LIMIT 1"
      )
      .get(current.status, current.priority) as { id: number; priority: number } | undefined;
    if (!neighbor) return;

    const update = connection.prepare("UPDATE planned_purchases SET priority = ? WHERE id = ?");
    update.run(neighbor.priority, id);
    update.run(current.priority, neighbor.id);
  });
}
