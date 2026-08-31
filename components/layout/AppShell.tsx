import type { ReactNode } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Card } from "@/components/ui/Card";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex flex-1 flex-col items-center p-6">
      <Card className="flex w-full max-w-[1240px] flex-1">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </Card>
    </div>
  );
}
