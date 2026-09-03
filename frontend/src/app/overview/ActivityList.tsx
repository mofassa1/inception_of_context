import type { ActivityEvent } from "@/shared/types/overview";

export function ActivityList({ activity }: { activity: ActivityEvent[] }) {
  if (activity.length === 0) {
    return (
      <p className="ov-empty">
        no file activity yet. edit a file in the target to see live updates.
      </p>
    );
  }

  return (
    <div className="ov-events">
      {activity.map((event) => (
        <div key={event.id} className="ov-event">
          <span className={"ov-event-dot ov-" + event.kind} />
          <span className="ov-event-kind">{event.kind}</span>
          <span className="ov-event-path" title={event.path}>
            {event.path}
          </span>
        </div>
      ))}
    </div>
  );
}
