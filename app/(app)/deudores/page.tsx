import { Topbar } from "@/components/layout/Topbar";
import { DebtorsPanel } from "@/components/debtors/DebtorsPanel";
import { getDebtors } from "@/lib/debtors";

export default function DeudoresPage() {
  const debtors = getDebtors();

  return (
    <>
      <Topbar title="Deudores" />
      <div className="flex flex-1 overflow-auto">
        <DebtorsPanel debtors={debtors} />
      </div>
    </>
  );
}
