import { notFound } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { EventDetailList } from "@/components/events/EventDetailList";
import { getEventById } from "@/lib/events";
import { getTransactionsByEvent } from "@/lib/transactions";

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(amount);
}

export default async function EventoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = getEventById(Number(id));
  if (!event) notFound();

  const transactions = getTransactionsByEvent(event.id);
  const total = transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);

  return (
    <>
      <Breadcrumb items={[{ href: "/eventos", label: "Eventos" }]} />
      <Topbar title={event.name}>
        <span className="font-mono text-[13px] font-bold text-terracotta-700">
          ${formatAmount(total)}
        </span>
      </Topbar>
      <EventDetailList transactions={transactions} />
    </>
  );
}
