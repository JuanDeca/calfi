import type { ExpenseClass } from "@/types/transaction";

export function ExpenseClassPill({ value }: { value: ExpenseClass }) {
  return <span className="text-[11px] font-medium text-ink-soft">{value}</span>;
}
