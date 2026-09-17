import { X } from "lucide-react";

export function IgnoreToggle({
  ignored,
  label,
  onToggle,
}: {
  ignored: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <span
      className={
        "mr-[5px] inline-flex size-[11px] flex-none cursor-pointer items-center justify-center rounded-xs border text-danger " +
        (ignored ? "border-danger/55 bg-danger/12" : "border-focus hover:border-fg-dim")
      }
      role="checkbox"
      aria-checked={ignored}
      aria-label={ignored ? `Include ${label} in the index` : `Ignore ${label}`}
      title={ignored ? "Ignored — click to index" : "Indexed — click to ignore"}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
    >
      {ignored && <X size={9} strokeWidth={3.5} />}
    </span>
  );
}
