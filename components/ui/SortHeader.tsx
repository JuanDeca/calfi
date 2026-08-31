"use client";

export function SortHeader<T extends string>({
  label,
  field,
  currentField,
  currentDir,
  onSort,
  align = "left",
}: {
  label: string;
  field: T;
  currentField: T;
  currentDir: "asc" | "desc";
  onSort: (field: T) => void;
  align?: "left" | "right";
}) {
  const active = field === currentField;
  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className={`flex items-center gap-0.5 font-mono text-[9.5px] font-semibold tracking-wider ${
        active ? "text-ink-soft" : "text-stone-faint hover:text-ink-soft"
      } ${align === "right" ? "justify-end" : "justify-start"}`}
    >
      {label}
      {active && <span className="text-[8px]">{currentDir === "desc" ? "▼" : "▲"}</span>}
    </button>
  );
}
