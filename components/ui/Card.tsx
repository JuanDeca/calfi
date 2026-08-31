import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={`overflow-hidden rounded-card border-[1.5px] border-border bg-white shadow-card ${className}`}
    >
      {children}
    </div>
  );
}
