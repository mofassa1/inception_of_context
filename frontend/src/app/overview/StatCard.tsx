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
    <div className={"ov-stat" + (highlight ? " hl" : "")}>
      <span className="ov-stat-label">{label}</span>
      <span className="ov-stat-value">{value}</span>
    </div>
  );
}
