import { Topbar } from "@/components/layout/Topbar";
import { EventsList } from "@/components/events/EventsList";
import { getEvents } from "@/lib/events";

export default function EventosPage() {
  const events = getEvents();

  return (
    <>
      <Topbar title="Eventos" />
      <EventsList events={events} />
    </>
  );
}
