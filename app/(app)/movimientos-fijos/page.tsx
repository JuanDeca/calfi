import { Topbar } from "@/components/layout/Topbar";
import { RecurringMovementsPanel } from "@/components/recurring/RecurringMovementsPanel";
import { getRecurringMovements, getPendingRecurringMovements } from "@/lib/recurringMovements";
import { getCategories } from "@/lib/categories";

export default function MovimientosFijosPage() {
  const movements = getRecurringMovements();
  const pending = getPendingRecurringMovements();
  const categories = getCategories();

  return (
    <>
      <Topbar title="Movimientos fijos" />
      <div className="flex flex-1 overflow-auto">
        <RecurringMovementsPanel movements={movements} pending={pending} categories={categories} />
      </div>
    </>
  );
}
