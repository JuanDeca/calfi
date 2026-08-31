"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  label: string;
  href: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "MOVIMIENTOS",
    items: [
      { label: "Transacciones", href: "/transacciones" },
      { label: "Dudosos", href: "/dudosos" },
    ],
  },
  {
    label: "ORGANIZACIÓN",
    items: [
      { label: "Categorías", href: "/categorias" },
      { label: "Reglas", href: "/reglas" },
      { label: "Eventos", href: "/eventos" },
      { label: "Movimientos fijos", href: "/movimientos-fijos" },
      { label: "Reparto de sueldo", href: "/reparto-sueldo" },
    ],
  },
  {
    label: "PANORAMA",
    items: [
      { label: "Patrimonio", href: "/patrimonio" },
      { label: "Deudores", href: "/deudores" },
      { label: "Compras planeadas", href: "/compras" },
      { label: "Insights", href: "/insights" },
      { label: "Auditoría", href: "/auditoria" },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="flex w-[210px] flex-none flex-col gap-5 border-r-[1.5px] border-dashed border-border-dashed bg-cream-soft p-3.5">
      <div className="flex items-center gap-2 px-1 pb-2 pt-0.5">
        <div className="flex h-[26px] w-[26px] items-center justify-center rounded-lg bg-sage-600 font-kalam text-sm font-bold text-white">
          C
        </div>
        <span className="font-kalam text-lg font-bold text-ink">Calfi</span>
      </div>

      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="flex flex-col gap-0.5">
          <div className="px-2 pb-1 font-mono text-[9.5px] font-semibold tracking-wider text-stone-faint">
            {group.label}
          </div>
          {group.items.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between rounded-control px-2.5 py-1.5 text-[12.5px] font-medium ${
                  isActive
                    ? "bg-sage-100 text-sage-700"
                    : "text-ink-soft hover:bg-white"
                }`}
              >
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </div>
  );
}
