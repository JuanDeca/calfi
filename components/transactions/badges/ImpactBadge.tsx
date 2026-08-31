import { Badge } from "@/components/ui/Badge";
import type { ImpactsAnalysis } from "@/types/transaction";

const TONE: Record<ImpactsAnalysis, "sage" | "neutral" | "amber"> = {
  Sí: "sage",
  No: "neutral",
  Pendiente: "amber",
};

export function ImpactBadge({ value }: { value: ImpactsAnalysis }) {
  return <Badge tone={TONE[value]}>{value}</Badge>;
}
