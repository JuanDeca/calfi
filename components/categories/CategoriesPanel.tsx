"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Category } from "@/lib/categories";
import { ClientPagination } from "@/components/ui/ClientPagination";
import { SortHeader } from "@/components/ui/SortHeader";
import { useConfirm } from "@/components/ui/ConfirmProvider";

const CATEGORIES_GRID = "grid-cols-[40px_1.6fr_100px_90px_110px_28px]";
const PAGE_SIZE = 12;

type SortField = "name" | "type" | "count" | "excluded";

export function CategoriesPanel({
  categories,
  transactionCounts,
}: {
  categories: Category[];
  transactionCounts: Record<number, number>;
}) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("🏷️");
  const [type, setType] = useState<"gasto" | "ingreso">("gasto");
  const [excludedFromAnalysis, setExcludedFromAnalysis] = useState(false);
  const [creating, setCreating] = useState(false);
  const router = useRouter();
  const confirm = useConfirm();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"" | "gasto" | "ingreso">("");
  const [onlyExcluded, setOnlyExcluded] = useState(false);
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>("count");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function handleSort(field: SortField) {
    if (field === sortField) {
      setSortDir((current) => (current === "desc" ? "asc" : "desc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }

  const filtered = useMemo(() => {
    return categories.filter((category) => {
      if (search && !category.name.toLowerCase().includes(search.trim().toLowerCase())) return false;
      if (typeFilter && category.type !== typeFilter) return false;
      if (onlyExcluded && !category.excludedFromAnalysis) return false;
      return true;
    });
  }, [categories, search, typeFilter, onlyExcluded]);

  const sorted = useMemo(() => {
    const withDir = (result: number) => (sortDir === "asc" ? result : -result);
    return [...filtered].sort((a, b) => {
      switch (sortField) {
        case "name":
          return withDir(a.name.localeCompare(b.name));
        case "type":
          return withDir(a.type.localeCompare(b.type));
        case "excluded":
          return withDir(Number(a.excludedFromAnalysis) - Number(b.excludedFromAnalysis));
        case "count":
        default:
          return withDir((transactionCounts[a.id] ?? 0) - (transactionCounts[b.id] ?? 0));
      }
    });
  }, [filtered, sortField, sortDir, transactionCounts]);

  // Clamp en vez de resetear con un efecto: si un filtro deja la página actual
  // fuera de rango, cae a la última página válida sin necesitar setState en un efecto.
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const hasFilters = search !== "" || typeFilter !== "" || onlyExcluded;

  async function handleCreate() {
    if (!name.trim()) return;
    setCreating(true);
    await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), type, excludedFromAnalysis, icon: icon.trim() || undefined }),
    });
    setName("");
    setIcon("🏷️");
    setExcludedFromAnalysis(false);
    setCreating(false);
    setShowCreateModal(false);
    router.refresh();
  }

  async function handleIconChange(id: number, newIcon: string) {
    if (!newIcon.trim()) return;
    await fetch(`/api/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ icon: newIcon.trim() }),
    });
    router.refresh();
  }

  async function handleDelete(id: number, name: string) {
    if (
      !(await confirm({
        description: `¿Eliminar la categoría "${name}"? Las transacciones que la usan quedan sin categoría.`,
        danger: true,
      }))
    ) {
      return;
    }
    await fetch(`/api/categories/${id}`, { method: "DELETE" });
    router.refresh();
  }

  async function handleToggleExcluded(id: number, current: boolean) {
    await fetch(`/api/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ excludedFromAnalysis: !current }),
    });
    router.refresh();
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-dashed border-border-dashed p-4">
        <span className="text-[11px] font-semibold text-ink-soft">Categorías</span>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="rounded-control bg-sage-600 px-3 py-1.5 text-xs font-semibold text-white"
        >
          ＋ Crear categoría
        </button>
      </div>

      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="w-[380px] min-w-0 max-w-full overflow-hidden rounded-card border-[1.5px] border-border bg-white shadow-card"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b-[1.5px] border-dashed border-border-dashed bg-cream-soft px-4 py-3">
              <div className="h-[9px] w-[9px] rounded-full bg-sage-600" />
              <span className="font-kalam text-sm font-bold text-ink">Nueva categoría</span>
            </div>
            <div className="flex flex-col gap-2.5 px-[18px] py-4">
              <div className="flex gap-1.5">
                <input
                  value={icon}
                  onChange={(event) => setIcon(event.target.value)}
                  placeholder="🏷️"
                  title="Ícono (emoji)"
                  className="w-[46px] rounded-control border-[1.5px] border-border px-2 py-2 text-center text-sm"
                />
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Nombre de la categoría…"
                  autoFocus
                  className="flex-1 rounded-control border-[1.5px] border-border px-2.5 py-2 text-xs text-ink-muted"
                />
              </div>
              <select
                value={type}
                onChange={(event) => setType(event.target.value as "gasto" | "ingreso")}
                className="rounded-control border-[1.5px] border-border px-2 py-2 text-xs text-ink-muted"
              >
                <option value="gasto">Gasto</option>
                <option value="ingreso">Ingreso</option>
              </select>
              <label className="flex items-center gap-1.5 text-[10.5px] text-stone-light">
                <input
                  type="checkbox"
                  checked={excludedFromAnalysis}
                  onChange={(event) => setExcludedFromAnalysis(event.target.checked)}
                />
                No impacta el análisis
              </label>
              <div className="mt-1.5 flex gap-2">
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
            placeholder="Buscar categoría…"
            className="flex-1 outline-none placeholder:text-stone-faint"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value as "" | "gasto" | "ingreso")}
          className="rounded-control border-[1.5px] border-border bg-white px-3 py-1.5 text-xs font-medium text-ink-muted"
        >
          <option value="">Tipo</option>
          <option value="gasto">Gasto</option>
          <option value="ingreso">Ingreso</option>
        </select>
        <label className="flex items-center gap-1.5 text-xs text-stone">
          <input
            type="checkbox"
            checked={onlyExcluded}
            onChange={(event) => setOnlyExcluded(event.target.checked)}
          />
          Solo no impacta
        </label>
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setTypeFilter("");
              setOnlyExcluded(false);
            }}
            className="text-[11px] font-medium text-terracotta-700"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto px-1.5">
        <div
          className={`grid ${CATEGORIES_GRID} gap-2 border-b-[1.5px] border-border-dashed px-4 py-2.5`}
        >
          <span />
          <SortHeader label="NOMBRE" field="name" currentField={sortField} currentDir={sortDir} onSort={handleSort} />
          <SortHeader label="TIPO" field="type" currentField={sortField} currentDir={sortDir} onSort={handleSort} />
          <SortHeader
            label="MOVIMIENTOS"
            field="count"
            currentField={sortField}
            currentDir={sortDir}
            onSort={handleSort}
            align="right"
          />
          <SortHeader label="IMPACTA" field="excluded" currentField={sortField} currentDir={sortDir} onSort={handleSort} />
          <span />
        </div>
        {paginated.map((category) => (
          <div
            key={category.id}
            className={`grid ${CATEGORIES_GRID} items-center gap-2 border-b border-hairline px-4 py-2.5`}
          >
            <input
              defaultValue={category.icon}
              onBlur={(event) => {
                if (event.target.value.trim() && event.target.value !== category.icon) {
                  handleIconChange(category.id, event.target.value);
                }
              }}
              title="Ícono (emoji) — clickeá para cambiarlo"
              className="w-full rounded-control border-[1.5px] border-transparent px-1 py-1 text-center text-sm hover:border-border"
            />
            <Link
              href={`/insights/categoria/${category.id}?from=categorias`}
              className="truncate text-xs font-medium text-ink hover:underline"
            >
              {category.name}
            </Link>
            <span className="text-[11px] text-stone-light">
              {category.type === "ingreso" ? "Ingreso" : "Gasto"}
            </span>
            <span className="text-right font-mono text-xs text-ink-muted">
              {transactionCounts[category.id] ?? 0}
            </span>
            <button
              type="button"
              onClick={() => handleToggleExcluded(category.id, category.excludedFromAnalysis)}
              title="No impacta el análisis"
              className={`justify-self-start rounded-full border-[1.5px] px-2 py-0.5 text-[9.5px] font-semibold ${
                category.excludedFromAnalysis
                  ? "border-amber-border bg-amber-100 text-amber-700"
                  : "border-neutral-border bg-neutral-100 text-stone-faint"
              }`}
            >
              {category.excludedFromAnalysis ? "No impacta" : "Impacta"}
            </button>
            <button
              type="button"
              onClick={() => handleDelete(category.id, category.name)}
              className="text-xs text-stone-faint hover:text-terracotta-700"
              title="Eliminar categoría"
            >
              ✕
            </button>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="py-8 text-center text-[11px] text-stone-faint">
            {categories.length === 0
              ? "Todavía no cargaste ninguna categoría."
              : "Ninguna categoría coincide con el filtro."}
          </div>
        )}
      </div>
      {filtered.length > 0 && (
        <ClientPagination
          page={safePage}
          pageSize={PAGE_SIZE}
          total={filtered.length}
          onPageChange={setPage}
          itemLabel="categorías"
        />
      )}
    </div>
  );
}
