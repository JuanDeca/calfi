import { Topbar } from "@/components/layout/Topbar";
import { SalaryAllocationPanel } from "@/components/salaryAllocation/SalaryAllocationPanel";
import {
  getBucketsWithBalances,
  getLastAllocationRun,
  getPreviousMonthUsdReplenishment,
} from "@/lib/salaryAllocation";
import { getAssets } from "@/lib/patrimonio";
import { getPendingRecurringMovements } from "@/lib/recurringMovements";

export default function RepartoSueldoPage() {
  const buckets = getBucketsWithBalances();
  const assets = getAssets();
  const bancoUsd = assets.find((asset) => asset.name === "Banco (USD)") ?? null;
  const inversionesUsd = assets.find((asset) => asset.name === "Inversiones (USD)") ?? null;
  const deudasUsd = assets.find((asset) => asset.name === "Deudas (reserva USD en MP)") ?? null;
  const lastRun = getLastAllocationRun();
  const usdReplenishment = getPreviousMonthUsdReplenishment();
  const pendingRecurring = getPendingRecurringMovements();

  return (
    <>
      <Topbar title="Reparto de sueldo" />
      <div className="flex flex-1 overflow-auto">
        <SalaryAllocationPanel
          buckets={buckets}
          bancoUsd={bancoUsd}
          inversionesUsd={inversionesUsd}
          deudasUsd={deudasUsd}
          lastRun={lastRun}
          usdReplenishment={usdReplenishment}
          pendingRecurring={pendingRecurring}
        />
      </div>
    </>
  );
}
