import { Topbar } from "@/components/layout/Topbar";
import { PlannedPurchasesPanel } from "@/components/compras/PlannedPurchasesPanel";
import { getPlannedPurchases } from "@/lib/plannedPurchases";
import { getCategories } from "@/lib/categories";
import { getNow } from "@/lib/now";

export default function ComprasPage() {
  const items = getPlannedPurchases();
  const categories = getCategories();
  // Calculado una sola vez acá (servidor) y pasado como prop: si el cliente
  // calculara su propio Date.now() para "días desde", podría no coincidir
  // exacto con el valor que ya viajó en el HTML del server, rompiendo la
  // hidratación (mismatch de atributos).
  const now = getNow();

  return (
    <>
      <Topbar title="Compras planeadas" />
      <div className="flex flex-1 overflow-auto">
        <PlannedPurchasesPanel items={items} categories={categories} now={now} />
      </div>
    </>
  );
}
