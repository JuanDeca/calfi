import Link from "next/link";
import { Topbar } from "@/components/layout/Topbar";
import { MaintenanceActions } from "@/components/auditoria/MaintenanceActions";
import { ImpactDonutChart } from "@/components/auditoria/ImpactDonutChart";
import { DataQualityTrendChart } from "@/components/auditoria/DataQualityTrendChart";
import { InsightPanel } from "@/components/insights/InsightPanel";
import { getAuditCounts, getMonthlyDataQuality } from "@/lib/auditoria";
import { getBudgetStatuses } from "@/lib/budgets";

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("es-AR").format(amount);
}

export default function AuditoriaPage() {
  const counts = getAuditCounts();
  const monthlyQuality = getMonthlyDataQuality();
  const budgetStatuses = getBudgetStatuses().filter((status) => status.overBudget);
  const balances = counts.impactaSi + counts.impactaNo + counts.pendiente === counts.total;

  return (
    <>
      <Topbar title="Auditoría" />
      <div className="flex-1 overflow-auto p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-control border-[1.5px] border-border-dashed p-3.5">
            <div className="font-mono text-2xl font-bold text-ink">
              {formatAmount(counts.total)}
            </div>
            <div className="mt-0.5 text-[10.5px] font-medium text-stone-light">
              Total movimientos
            </div>
          </div>
          <div className="rounded-control border-[1.5px] border-sage-border bg-sage-100 p-3.5">
            <div className="font-mono text-2xl font-bold text-sage-700">
              {formatAmount(counts.impactaSi)}
            </div>
            <div className="mt-0.5 text-[10.5px] font-medium text-sage-600">Impactan análisis</div>
          </div>
          <div className="rounded-control border-[1.5px] border-border-dashed p-3.5">
            <div className="font-mono text-2xl font-bold text-stone-light">
              {formatAmount(counts.impactaNo)}
            </div>
            <div className="mt-0.5 text-[10.5px] font-medium text-stone-light">No impactan</div>
          </div>
          <div className="rounded-control border-[1.5px] border-amber-border bg-amber-100 p-3.5">
            <div className="font-mono text-2xl font-bold text-amber-700">
              {formatAmount(counts.pendiente)}
            </div>
            <div className="mt-0.5 text-[10.5px] font-medium text-amber-700">Pendientes</div>
          </div>
          <div className="rounded-control border-[1.5px] border-border-dashed p-3.5">
            <div className="font-mono text-2xl font-bold text-ink">
              {formatAmount(counts.sinCategoria)}
            </div>
            <div className="mt-0.5 text-[10.5px] font-medium text-stone-light">Sin categoría</div>
          </div>
          <div className="rounded-control border-[1.5px] border-border-dashed p-3.5">
            <div className="font-mono text-2xl font-bold text-ink">
              {formatAmount(counts.desglosadas)}
            </div>
            <div className="mt-0.5 text-[10.5px] font-medium text-stone-light">
              Transacciones desglosadas
            </div>
          </div>
          <div
            className={`col-span-full flex items-center gap-2 rounded-control border-[1.5px] border-dashed p-3 ${
              balances ? "border-sage-dash bg-sage-50" : "border-terracotta-600 bg-terracotta-100"
            }`}
          >
            <span className={balances ? "text-sage-600" : "text-terracotta-700"}>
              {balances ? "✓" : "✕"}
            </span>
            <span
              className={`text-[11px] font-medium ${balances ? "text-sage-700" : "text-terracotta-700"}`}
            >
              Suma cuadra: {formatAmount(counts.impactaSi)} + {formatAmount(counts.impactaNo)} +{" "}
              {formatAmount(counts.pendiente)} = {formatAmount(counts.total)}
            </span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <InsightPanel title="Impacta análisis">
            <ImpactDonutChart counts={counts} />
          </InsightPanel>
          <InsightPanel title="Evolución de pendientes / sin categoría">
            <DataQualityTrendChart data={monthlyQuality} />
          </InsightPanel>
          {budgetStatuses.length > 0 && (
            <InsightPanel title="Categorías pasadas de presupuesto este mes">
              <div className="flex flex-col gap-1.5">
                {budgetStatuses.map((status) => (
                  <Link
                    key={status.categoryId}
                    href={`/insights/categoria/${status.categoryId}?from=auditoria`}
                    className="flex items-center justify-between rounded-control border border-dashed border-terracotta-600 bg-terracotta-100 px-3 py-2 text-[11px] hover:bg-terracotta-100/70"
                  >
                    <span className="font-medium text-terracotta-700">{status.categoryName}</span>
                    <span className="font-mono text-terracotta-700">
                      ${formatAmount(status.spentThisMonth)} / ${formatAmount(status.monthlyLimit)}
                    </span>
                  </Link>
                ))}
              </div>
            </InsightPanel>
          )}
        </div>

        <MaintenanceActions />
      </div>
    </>
  );
}
