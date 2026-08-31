"use client";

import { useMemo, useState } from "react";
import type { Category } from "@/lib/categories";

interface CategoryPickerProps {
  categories: Category[];
  value: number | "";
  onChange: (categoryId: number | "", category: Category | null) => void;
  emptyLabel?: string;
  allowEmpty?: boolean;
  className?: string;
}

function CategoryGrid({
  title,
  titleClassName,
  items,
  value,
  onSelect,
}: {
  title: string;
  titleClassName: string;
  items: Category[];
  value: number | "";
  onSelect: (category: Category) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mb-3">
      <div className={`mb-1.5 text-[10px] font-semibold uppercase tracking-wider ${titleClassName}`}>
        {title}
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {items.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => onSelect(category)}
            className={`flex flex-col items-center gap-1 rounded-control border-[1.5px] px-2 py-2.5 text-center ${
              value === category.id
                ? "border-sage-600 bg-sage-100"
                : "border-border hover:bg-cream-soft"
            }`}
          >
            <span className="text-xl leading-none">{category.icon}</span>
            <span className="w-full truncate text-[10.5px] font-medium text-ink">
              {category.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function CategoryPicker({
  categories,
  value,
  onChange,
  emptyLabel = "Elegir categoría…",
  allowEmpty = false,
  className,
}: CategoryPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selected = categories.find((category) => category.id === value) ?? null;

  const filtered = useMemo(
    () =>
      categories.filter((category) =>
        category.name.toLowerCase().includes(search.trim().toLowerCase())
      ),
    [categories, search]
  );
  const gastos = filtered.filter((category) => category.type === "gasto");
  const ingresos = filtered.filter((category) => category.type === "ingreso");

  function select(id: number | "", category: Category | null) {
    onChange(id, category);
    setOpen(false);
    setSearch("");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          "flex w-full items-center gap-1.5 rounded-control border-[1.5px] border-border px-2.5 py-1.5 text-left text-xs text-ink-muted"
        }
      >
        {selected ? (
          <>
            <span>{selected.icon}</span>
            <span className="truncate">{selected.name}</span>
          </>
        ) : (
          <span className="text-stone-faint">{emptyLabel}</span>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex max-h-[80vh] w-[420px] min-w-0 max-w-full flex-col overflow-hidden rounded-card border-[1.5px] border-border bg-white shadow-card"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b-[1.5px] border-dashed border-border-dashed p-3">
              <input
                autoFocus
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar categoría…"
                className="w-full rounded-control border-[1.5px] border-border px-3 py-2 text-xs text-ink-muted"
              />
            </div>
            <div className="flex-1 overflow-auto p-3">
              {allowEmpty && (
                <button
                  type="button"
                  onClick={() => select("", null)}
                  className="mb-3 w-full rounded-control border-[1.5px] border-dashed border-border px-3 py-2 text-left text-xs text-stone-light hover:bg-cream-soft"
                >
                  {emptyLabel}
                </button>
              )}
              <CategoryGrid
                title="Gastos"
                titleClassName="text-terracotta-700"
                items={gastos}
                value={value}
                onSelect={(category) => select(category.id, category)}
              />
              <CategoryGrid
                title="Ingresos"
                titleClassName="text-sage-700"
                items={ingresos}
                value={value}
                onSelect={(category) => select(category.id, category)}
              />
              {filtered.length === 0 && (
                <div className="py-6 text-center text-[11px] text-stone-faint">Sin resultados.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
