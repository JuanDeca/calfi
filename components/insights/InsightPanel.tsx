import type { ReactNode } from "react";

export function InsightPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-control border-[1.5px] border-border-dashed p-4">
      <div className="mb-3 text-[11.5px] font-semibold text-ink-muted">{title}</div>
      {children}
    </div>
  );
}
