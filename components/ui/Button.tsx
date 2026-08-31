import type { ReactNode } from "react";

interface ButtonProps {
  children: ReactNode;
  variant?: "primary" | "secondary";
}

export function Button({ children, variant = "primary" }: ButtonProps) {
  if (variant === "secondary") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-control border-[1.5px] border-border px-3.5 py-1.5 text-[11.5px] font-semibold text-ink-soft">
        {children}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-control bg-sage-600 px-3.5 py-1.5 text-[11.5px] font-semibold text-white">
      {children}
    </span>
  );
}
