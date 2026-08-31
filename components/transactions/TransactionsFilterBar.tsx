"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Category } from "@/lib/categories";
import { CategoryPicker } from "@/components/ui/CategoryPicker";

const EXPENSE_CLASSES = ["Fijo", "Variable", "Extraordinario", "No aplica"];
const IMPACT_OPTIONS = ["Sí", "No", "Pendiente"];

function updateParam(params: URLSearchParams, key: string, value: string) {
  if (value) params.set(key, value);
  else params.delete(key);
}

export function TransactionsFilterBar({
  categories,
  basePath = "/transacciones",
  hideImpactsFilter = false,
  hideCategoryFilter = false,
  subcategories,
}: {
  categories: Category[];
  basePath?: string;
  hideImpactsFilter?: boolean;
  hideCategoryFilter?: boolean;
  subcategories?: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function navigate(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    updateParam(params, key, value);
    router.push(`${basePath}${params.toString() ? `?${params.toString()}` : ""}`);
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (search !== (searchParams.get("search") ?? "")) navigate("search", search);
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const hasFilters = Array.from(searchParams.keys()).length > 0;
  const categoryIdParam = searchParams.get("categoryId");
  const categoryFilterValue: number | "" = categoryIdParam ? Number(categoryIdParam) : "";

  return (
    <div className="flex flex-wrap items-center gap-2.5 border-b border-dashed border-border-dashed bg-cream-faint px-5 py-3">
      <div className="flex min-w-[150px] flex-1 items-center gap-2 rounded-control border-[1.5px] border-border bg-white px-2.5 py-1.5 text-xs text-ink-muted">
        <span className="text-stone-faint">⌕</span>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar descripción o contraparte…"
          className="flex-1 outline-none placeholder:text-stone-faint"
        />
      </div>
      {!hideCategoryFilter && (
        <div className="w-[160px]">
          <CategoryPicker
            categories={categories}
            value={categoryFilterValue}
            emptyLabel="Categoría"
            allowEmpty
            className="flex w-full items-center gap-1.5 rounded-control border-[1.5px] border-border bg-white px-3 py-1.5 text-left text-xs font-medium text-ink-muted"
            onChange={(id) => navigate("categoryId", id === "" ? "" : String(id))}
          />
        </div>
      )}
      {subcategories && subcategories.length > 0 && (
        <select
          defaultValue={searchParams.get("subcategory") ?? ""}
          onChange={(event) => navigate("subcategory", event.target.value)}
          className="rounded-control border-[1.5px] border-border bg-white px-3 py-1.5 text-xs font-medium text-ink-muted"
        >
          <option value="">Subcategoría</option>
          <option value="__none__">Sin subcategoría</option>
          {subcategories.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      )}
      <select
        defaultValue={searchParams.get("expenseClass") ?? ""}
        onChange={(event) => navigate("expenseClass", event.target.value)}
        className="rounded-control border-[1.5px] border-border bg-white px-3 py-1.5 text-xs font-medium text-ink-muted"
      >
        <option value="">Clase</option>
        {EXPENSE_CLASSES.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      {!hideImpactsFilter && (
        <select
          defaultValue={searchParams.get("impactsAnalysis") ?? ""}
          onChange={(event) => navigate("impactsAnalysis", event.target.value)}
          className="rounded-control border-[1.5px] border-border bg-white px-3 py-1.5 text-xs font-medium text-ink-muted"
        >
          <option value="">Impacta</option>
          {IMPACT_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      )}
      <label className="flex items-center gap-1.5 text-xs text-stone">
        Desde
        <input
          type="date"
          value={searchParams.get("dateFrom") ?? ""}
          onChange={(event) => navigate("dateFrom", event.target.value)}
          className="rounded-control border-[1.5px] border-border bg-white px-2.5 py-1.5 text-xs text-ink-muted"
        />
      </label>
      <label className="flex items-center gap-1.5 text-xs text-stone">
        Hasta
        <input
          type="date"
          value={searchParams.get("dateTo") ?? ""}
          onChange={(event) => navigate("dateTo", event.target.value)}
          className="rounded-control border-[1.5px] border-border bg-white px-2.5 py-1.5 text-xs text-ink-muted"
        />
      </label>
      {hasFilters && (
        <button
          type="button"
          onClick={() => {
            setSearch("");
            router.push(basePath);
          }}
          className="text-[11px] font-medium text-terracotta-700"
        >
          Limpiar filtros
        </button>
      )}
    </div>
  );
}
