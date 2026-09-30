export function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <div
      className={
        "flex min-w-0 flex-col gap-1.5 rounded-lg border bg-chrome-bg px-[13px] py-3 " +
        (highlight ? "border-accent/55" : "border-border")
      }
    >
      <span className="text-[10px] font-bold tracking-[0.07em] text-fg-dim uppercase">{label}</span>
      <span
        className={
          "font-mono leading-[1.45] wrap-anywhere " +
          (highlight ? "text-[16px] text-info" : "text-[12.5px] text-fg-strong")
        }
      >
        {value}
      </span>
    </div>
  );
}
