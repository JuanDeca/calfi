import { Topbar } from "@/components/layout/Topbar";
import { AccountsPanel } from "@/components/patrimonio/AccountsPanel";
import { MonthlyHistoryTable } from "@/components/patrimonio/MonthlyHistoryTable";
import { CurrencyToggle } from "@/components/transactions/CurrencyToggle";
import { getAssets, getDebts, getNetWorth, getMonthlyHistory } from "@/lib/patrimonio";
import { getUsdRate } from "@/lib/exchangeRate";
import { formatMoney } from "@/lib/formatMoney";

export default async function PatrimonioPage({
  searchParams,
}: {
  searchParams: Promise<{ currency?: string }>;
}) {
  const params = await searchParams;
  const usdRate = await getUsdRate();
  const showUsd = params.currency === "usd" && usdRate !== null;
  const currency = showUsd ? "USD" : "ARS";
  const usdFactor = showUsd && usdRate ? 1 / usdRate.rate : 1;

  const assets = getAssets();
  const debts = getDebts();
  const netWorth = getNetWorth();
  const history = getMonthlyHistory();

  return (
    <>
      <Topbar title="Patrimonio">
        <CurrencyToggle usdRate={usdRate} basePath="/patrimonio" />
      </Topbar>
      <div className="flex-1 overflow-auto p-4">
        <div className="mb-4 flex flex-wrap gap-3.5">
          <div className="flex-[1.4] min-w-[190px] rounded-control border-[1.5px] border-sage-border bg-sage-100 p-4">
            <div className="font-mono text-[10px] font-semibold text-sage-600">
              PATRIMONIO NETO
            </div>
            <div className="mt-1 font-mono text-2xl font-bold text-ink">
              {formatMoney(netWorth.netWorth * usdFactor, currency)}
            </div>
          </div>
          <div className="min-w-[150px] flex-1 rounded-control border-[1.5px] border-border-dashed p-4">
            <div className="text-[10px] font-semibold text-stone-light">ACTIVOS</div>
            <div className="mt-1 font-mono text-lg font-bold text-sage-700">
              {formatMoney(netWorth.totalAssets * usdFactor, currency)}
            </div>
          </div>
          <div className="min-w-[150px] flex-1 rounded-control border-[1.5px] border-border-dashed p-4">
            <div className="text-[10px] font-semibold text-stone-light">DEUDAS</div>
            <div className="mt-1 font-mono text-lg font-bold text-terracotta-700">
              – {formatMoney(netWorth.totalDebts * usdFactor, currency)}
            </div>
          </div>
        </div>

        <div className="mb-4 flex flex-col rounded-control border-[1.5px] border-border-dashed sm:flex-row">
          <AccountsPanel kind="assets" title="Activos" accounts={assets} currency={currency} usdFactor={usdFactor} />
          <AccountsPanel kind="debts" title="Deudas" accounts={debts} currency={currency} usdFactor={usdFactor} />
        </div>

        <div className="mb-2 text-[11px] font-semibold text-ink-soft">
          Histórico mensual por cuenta
        </div>
        <MonthlyHistoryTable history={history} currency={currency} usdFactor={usdFactor} />
      </div>
    </>
  );
}
