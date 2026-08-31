import Link from "next/link";

export interface BreadcrumbItem {
  href: string;
  label: string;
}

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  if (items.length === 0) return null;

  return (
    <div className="border-b-[1.5px] border-dashed border-border-dashed px-5 pt-3 pb-2 text-[11px] text-stone-faint">
      ←{" "}
      {items.map((item, index) => (
        <span key={item.href}>
          {index > 0 && <span className="mx-1">/</span>}
          <Link href={item.href} className="hover:text-ink-soft hover:underline">
            {item.label}
          </Link>
        </span>
      ))}
    </div>
  );
}
