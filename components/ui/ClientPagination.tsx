"use client";

interface ClientPaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  itemLabel?: string;
}

export function ClientPagination({
  page,
  pageSize,
  total,
  onPageChange,
  itemLabel = "resultados",
}: ClientPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between border-t border-hairline px-4 py-3 text-[11px] text-stone-faint">
      <span>
        {from} – {to} de {total} {itemLabel}
      </span>
      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="rounded-control border-[1.5px] border-border px-2.5 py-1 font-medium text-ink-soft disabled:opacity-40"
          >
            ← Anterior
          </button>
          <span className="font-mono">
            Página {page} de {totalPages}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="rounded-control border-[1.5px] border-border px-2.5 py-1 font-medium text-ink-soft disabled:opacity-40"
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  );
}
