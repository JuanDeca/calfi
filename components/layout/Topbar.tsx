import type { ReactNode } from "react";

interface TopbarProps {
  title: string;
  children?: ReactNode;
}

export function Topbar({ title, children }: TopbarProps) {
  return (
    <div className="flex items-center gap-3.5 border-b-[1.5px] border-dashed border-border-dashed px-5 py-3.5">
      <h1 className="font-kalam text-base font-bold text-ink">{title}</h1>
      <div className="flex-1" />
      {children}
    </div>
  );
}
