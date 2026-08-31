import type { ReactNode } from "react";

type Tone = "sage" | "amber" | "terracotta" | "neutral";

const TONE_CLASSES: Record<Tone, string> = {
  sage: "bg-sage-100 text-sage-700 border-sage-border",
  amber: "bg-amber-100 text-amber-700 border-amber-border",
  terracotta: "bg-terracotta-100 text-terracotta-700 border-terracotta-600",
  neutral: "bg-neutral-100 text-stone-light border-neutral-border",
};

interface BadgeProps {
  children: ReactNode;
  tone: Tone;
}

export function Badge({ children, tone }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border-[1.5px] px-2.5 py-0.5 text-[10.5px] font-semibold ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}
