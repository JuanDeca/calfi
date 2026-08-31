"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Category, CategorizationRuleSummary } from "@/lib/categories";
import { SubcategoryInput } from "@/components/ui/SubcategoryInput";
import { CategoryPicker } from "@/components/ui/CategoryPicker";
import { ClientPagination } from "@/components/ui/ClientPagination";
import { SortHeader } from "@/components/ui/SortHeader";
import { useConfirm } from "@/components/ui/ConfirmProvider";

const RULES_GRID = "grid-cols-[1.3fr_1fr_1fr_80px_90px_28px]";
const PAGE_SIZE = 20;

type SortField = "counterparty" | "category" | "impacts" | "occurrences";

export function RulesPanel({
  rules,
  categories,
  occurrenceCounts,
  initialCategoryId,
}: {
  rules: CategorizationRuleSummary[];
  categories: Category[];
  occurrenceCounts: Record<string, number>;
  initialCategoryId?: number;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [counterpartyKey, setCounterpartyKey] = useState("");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [subcategory, setSubcategory] = useState("");
  const [subcategoryOptions, setSubcategoryOptions] = useState<string[]>([]);
  const [impactsAnalysis, setImpactsAnalysis] = useState<"Sí" | "No">("Sí");
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<number | "">(initialCategoryId ?? "");
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>("occurrences");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function handleSort(field: SortField) {
    if (field === sortField) {
      setSortDir((current) => (current === "desc" ? "asc" : "desc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }

  useEffect(() => {
    if (categoryId === "") return;
    fetch(`/api/categories/${categoryId}/subcategories`)
      .then((response) => response.json())
      .then((data) => setSubcategoryOptions(data.subcategories ?? []))
      .catch(() => setSubcategoryOptions([]));
  }, [categoryId]);

  const filteredRules = useMemo(() => {
    return rules.filter((rule) => {
      if (search && !rule.counterpartyKey.toLowerCase().includes(search.trim().toLowerCase())) {
        return false;
      }
      if (categoryFilter !== "" && rule.categoryId !== categoryFilter) return false;
      return true;
    });
  }, [rules, search, categoryFilter]);

  const sortedRules = useMemo(() => {
    const withDir = (result: number) => (sortDir === "asc" ? result : -result);
    return [...filteredRules].sort((a, b) => {
      switch (sortField) {
        case "counterparty":
          return withDir(a.counterpartyKey.localeCompare(b.counterpartyKey));
        case "category":
          return withDir((a.categoryName ?? "").localeCompare(b.categoryName ?? ""));
        case "impacts":
          return withDir(a.impactsAnalysis.localeCompare(b.impactsAnalysis));
        case "occurrences":
        default:
          return withDir(
            (occurrenceCounts[a.counterpartyKey] ?? 0) - (occurrenceCounts[b.counterpartyKey] ?? 0)
          );
      }
    });
  }, [filteredRules, sortField, sortDir, occurrenceCounts]);

  // Clamp en vez de resetear con un efecto: si un filtro deja la página actual
  // fuera de rango, cae a la última página válida sin necesitar setState en un efecto.
  const totalPages = Math.max(1, Math.ceil(sortedRules.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedRules = sortedRules.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const hasFilters = search !== "" || categoryFilter !== "";

  async function handleDelete(counterpartyKeyToDelete: string) {
    if (
      !(await confirm({
        description: `¿Eliminar la regla de "${counterpartyKeyToDelete}"? Las próximas transacciones de esa contraparte van a volver a pedir categorización.`,
        danger: true,
      }))
    ) {
      return;
    }
    await fetch(`/api/categorization-rules/${encodeURIComponent(counterpartyKeyToDelete)}`, {
      method: "DELETE",
    });
    router.refresh();
  }

  async function handleCreate() {
    if (!counterpartyKey.trim()) return;
    if (categoryId === "" && impactsAnalysis === "Sí") {
      setMessage("Elegí una categoría (o marcá que no impacta el análisis).");
      return;
    }
    setCreating(true);
    setMessage(null);

    const response = await fetch("/api/categorization-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        counterpartyKey: counterpartyKey.trim(),
        categoryId: categoryId === "" ? null : categoryId,
        subcategory: subcategory.trim() || null,
        expenseClass: "No aplica",
        impactsAnalysis,
      }),
    });

    const data = await response.json();
    setCreating(false);

    if (!response.ok) {
      setMessage(data.error ?? "No se pudo crear la regla.");
      return;
    }

    setMessage(
      data.appliedRetroactively > 0
        ? `Regla creada. Se aplicó a ${data.appliedRetroactively} transacción(es) pendiente(s).`
        : "Regla creada."
    );
    setCounterpartyKey("");
    setCategoryId("");
    setSubcategory("");
    setShowCreateModal(false);
    router.refresh();
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-dashed border-border-dashed p-4">
        <span className="text-[11px] font-semibold text-ink-soft">Reglas aprendidas</span>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="rounded-control bg-sage-600 px-3 py-1.5 text-xs font-semibold text-white"
        >
          ＋ Crear regla
        </button>
      </div>

      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="w-[400px] min-w-0 max-w-full overflow-hidden rounded-card border-[1.5px] border-border bg-white shadow-card"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b-[1.5px] border-dashed border-border-dashed bg-cream-soft px-4 py-3">
              <div className="h-[9px] w-[9px] rounded-full bg-sage-600" />
              <span className="font-kalam text-sm font-bold text-ink">Nueva regla</span>
            </div>
            <div className="flex flex-col gap-2.5 px-[18px] py-4">
              <input
                value={counterpartyKey}
                onChange={(event) => setCounterpartyKey(event.target.value)}
                placeholder="Contraparte exacta (ej: Juan Pérez)"
                autoFocus
                className="rounded-control border-[1.5px] border-border px-2.5 py-2 text-xs text-ink-muted"
              />
              <CategoryPicker
                categories={categories}
                value={categoryId}
                emptyLabel="Categoría…"
                allowEmpty
                className="flex w-full items-center gap-1.5 rounded-control border-[1.5px] border-border px-2 py-2 text-left text-xs text-ink-muted"
                onChange={(id) => setCategoryId(id)}
              />
              <SubcategoryInput
                value={subcategory}
                onChange={setSubcategory}
                options={subcategoryOptions}
                placeholder="Subcategoría (opcional)…"
                className="w-full rounded-control border-[1.5px] border-dashed border-border px-2.5 py-2 text-xs text-ink-muted"
              />
              <div className="flex items-center justify-between rounded-control bg-cream-soft px-3 py-2.5">
                <span className="text-xs font-medium text-ink-muted">¿Impacta el análisis?</span>
                <div className="flex overflow-hidden rounded-control border-[1.5px] border-border text-[10.5px] font-semibold">
                  <button
                    type="button"
                    onClick={() => setImpactsAnalysis("Sí")}
                    className={`px-2.5 py-1.5 ${
                      impactsAnalysis === "Sí" ? "bg-sage-600 text-white" : "text-stone-light"
                    }`}
                  >
                    Sí
                  </button>
                  <button
                    type="button"
                    onClick={() => setImpactsAnalysis("No")}
                    className={`px-2.5 py-1.5 ${
                      impactsAnalysis === "No" ? "bg-sage-600 text-white" : "text-stone-light"
                    }`}
                  >
                    No
                  </button>
                </div>
              </div>
              {message && <div className="text-[10.5px] text-stone-light">{message}</div>}
              <div className="mt-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 rounded-control border-[1.5px] border-border py-2.5 text-xs font-semibold text-ink-soft"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={creating}
                  className="flex-[1.4] rounded-control bg-sage-600 py-2.5 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {creating ? "Creando…" : "Crear"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2.5 border-b border-dashed border-border-dashed bg-cream-faint px-5 py-3">
        <div className="flex min-w-[150px] flex-1 items-center gap-2 rounded-control border-[1.5px] border-border bg-white px-2.5 py-1.5 text-xs text-ink-muted">
          <span className="text-stone-faint">⌕</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar contraparte…"
            className="flex-1 outline-none placeholder:text-stone-faint"
          />
        </div>
        <div className="w-[160px]">
          <CategoryPicker
            categories={categories}
            value={categoryFilter}
            emptyLabel="Categoría"
            allowEmpty
            className="flex w-full items-center gap-1.5 rounded-control border-[1.5px] border-border bg-white px-3 py-1.5 text-left text-xs font-medium text-ink-muted"
            onChange={(id) => setCategoryFilter(id)}
          />
        </div>
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setCategoryFilter("");
            }}
            className="text-[11px] font-medium text-terracotta-700"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto px-1.5">
        <div
          className={`grid ${RULES_GRID} gap-2 border-b-[1.5px] border-border-dashed px-4 py-2.5`}
        >
          <SortHeader
            label="CONTRAPARTE"
            field="counterparty"
            currentField={sortField}
            currentDir={sortDir}
            onSort={handleSort}
          />
          <SortHeader
            label="CATEGORÍA"
            field="category"
            currentField={sortField}
            currentDir={sortDir}
            onSort={handleSort}
          />
          <span className="font-mono text-[9.5px] font-semibold tracking-wider text-stone-faint">
            SUBCATEGORÍA
          </span>
          <SortHeader
            label="IMPACTA"
            field="impacts"
            currentField={sortField}
            currentDir={sortDir}
            onSort={handleSort}
          />
          <SortHeader
            label="APARICIONES"
            field="occurrences"
            currentField={sortField}
            currentDir={sortDir}
            onSort={handleSort}
            align="right"
          />
          <span />
        </div>
        {paginatedRules.map((rule) => (
          <div
            key={rule.counterpartyKey}
            className={`grid ${RULES_GRID} items-center gap-2 border-b border-hairline px-4 py-2.5`}
          >
            <Link
              href={`/transacciones?search=${encodeURIComponent(rule.counterpartyKey)}`}
              className="truncate text-[12px] font-medium text-ink hover:underline"
              title={`Ver transacciones de ${rule.counterpartyKey}`}
            >
              {rule.counterpartyKey}
            </Link>
            <span className="truncate text-xs text-ink-soft">{rule.categoryName ?? "Sin categoría"}</span>
            <span className="truncate text-xs text-stone-light">{rule.subcategory ?? "—"}</span>
            <span className="text-[11px] text-stone-light">{rule.impactsAnalysis}</span>
            <span className="text-right font-mono text-xs text-ink-muted">
              {occurrenceCounts[rule.counterpartyKey] ?? 0}
            </span>
            <button
              type="button"
              onClick={() => handleDelete(rule.counterpartyKey)}
              className="text-xs text-stone-faint hover:text-terracotta-700"
              title="Eliminar regla"
            >
              ✕
            </button>
          </div>
        ))}
        {filteredRules.length === 0 && (
          <div className="py-8 text-center text-[11px] text-stone-faint">
            {rules.length === 0
              ? "Todavía no hay reglas aprendidas — se crean automáticamente al categorizar."
              : "Ninguna regla coincide con el filtro."}
          </div>
        )}
      </div>
      {filteredRules.length > 0 && (
        <ClientPagination
          page={safePage}
          pageSize={PAGE_SIZE}
          total={filteredRules.length}
          onPageChange={setPage}
          itemLabel="reglas"
        />
      )}
    </div>
  );
}
