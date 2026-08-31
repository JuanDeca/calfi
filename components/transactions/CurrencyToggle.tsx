"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Pill } from "@/components/ui/Pill";
import type { UsdRate } from "@/lib/exchangeRate";

export function CurrencyToggle({
  usdRate,
  basePath = "/transacciones",
}: {
  usdRate: UsdRate | null;
  basePath?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currency = searchParams.get("currency") === "usd" ? "USD" : "ARS";

  function handleSelect(option: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (option === "USD") params.set("currency", "usd");
    else params.delete("currency");
    router.push(`${basePath}${params.toString() ? `?${params.toString()}` : ""}`);
  }

  return (
    <div className="flex items-center gap-1.5">
      <Pill options={["ARS", "USD"]} active={currency} onSelect={handleSelect} />
      {currency === "USD" && (
        <span className="text-[9.5px] text-stone-faint">
          {usdRate ? `blue $${usdRate.rate}` : "sin conexión"}
        </span>
      )}
    </div>
  );
}
