export function formatMoney(amount: number, currency: "ARS" | "USD" = "ARS"): string {
  const abs = Math.abs(amount);
  const formatted =
    currency === "USD"
      ? new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(abs)
      : new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(abs);
  const prefix = currency === "USD" ? "US$" : "$";
  return amount < 0 ? `– ${prefix}${formatted}` : `${prefix}${formatted}`;
}
