import Link from "next/link";

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  searchParams: Record<string, string | undefined>;
  basePath?: string;
}

function buildHref(
  searchParams: Record<string, string | undefined>,
  page: number,
  basePath: string
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value && key !== "page") params.set(key, value);
  }
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return `${basePath}${query ? `?${query}` : ""}`;
}

export function Pagination({
  page,
  pageSize,
  total,
  searchParams,
  basePath = "/transacciones",
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between border-t border-hairline px-4 py-3 text-[11px] text-stone-faint">
      <span>
        {from} – {to} de {total} movimientos
      </span>
      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          {page > 1 ? (
            <Link
              href={buildHref(searchParams, page - 1, basePath)}
              className="rounded-control border-[1.5px] border-border px-2.5 py-1 font-medium text-ink-soft"
            >
              ← Anterior
            </Link>
          ) : (
            <span className="rounded-control border-[1.5px] border-border px-2.5 py-1 font-medium opacity-40">
              ← Anterior
            </span>
          )}
          <span className="font-mono">
            Página {page} de {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={buildHref(searchParams, page + 1, basePath)}
              className="rounded-control border-[1.5px] border-border px-2.5 py-1 font-medium text-ink-soft"
            >
              Siguiente →
            </Link>
          ) : (
            <span className="rounded-control border-[1.5px] border-border px-2.5 py-1 font-medium opacity-40">
              Siguiente →
            </span>
          )}
        </div>
      )}
    </div>
  );
}
