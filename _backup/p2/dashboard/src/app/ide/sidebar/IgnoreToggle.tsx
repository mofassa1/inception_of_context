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
      className={"tree-ignore" + (ignored ? " ignored" : "")}
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
