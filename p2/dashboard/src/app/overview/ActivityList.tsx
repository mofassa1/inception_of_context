import type { IndexEventDTO } from "@/shared/types/dto";

const EVENT_DOT_COLORS: Record<IndexEventDTO["kind"], string> = {
  indexed: "bg-info",
  modified: "bg-info",
  patched: "bg-info",
  deleted: "bg-danger",
  error: "bg-danger",
  ignored: "bg-fg-dim",
};

export function ActivityList({ events }: { events: IndexEventDTO[] }) {
  if (events.length === 0) {
    return (
      <p className="m-0 text-[12.5px] text-fg-dim italic">
        no file activity yet. edit a file in this folder to see live updates.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      {events.map((event) => (
        <div key={event.id} className="flex items-center gap-2.5 px-0.5 py-[5px] text-[12px]">
          <span className={"size-[7px] shrink-0 rounded-full " + EVENT_DOT_COLORS[event.kind]} />
          <span className="w-[62px] shrink-0 text-fg-dim">{event.kind}</span>
          <span className="min-w-0 truncate font-mono text-fg" title={event.path}>
            {event.path}
          </span>
          <span className="ml-auto text-[11px] text-fg-dim">
            {event.chunk_count > 0 ? `${event.chunk_count} chunks` : ""}
          </span>
        </div>
      ))}
    </div>
  );
}
