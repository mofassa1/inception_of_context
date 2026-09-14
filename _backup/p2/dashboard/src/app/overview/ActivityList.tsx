import type { IndexEvent } from "@/shared/types/agent";

export function ActivityList({ events }: { events: IndexEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="ov-empty">
        no file activity yet. edit a file in this folder to see live updates.
      </p>
    );
  }

  return (
    <div className="ov-events">
      {events.map((event) => (
        <div key={event.id} className="ov-event">
          <span className={"ov-event-dot ov-" + event.kind} />
          <span className="ov-event-kind">{event.kind}</span>
          <span className="ov-event-path" title={event.path}>
            {event.path}
          </span>
          <span className="ov-event-chunks">
            {event.chunkCount > 0 ? `${event.chunkCount} chunks` : ""}
          </span>
        </div>
      ))}
    </div>
  );
}
