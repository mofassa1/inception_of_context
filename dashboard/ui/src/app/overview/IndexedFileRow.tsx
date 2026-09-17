import type { IndexedFileDTO } from "@/shared/types/dto";

const BAR_BASE_WIDTH_PX = 6;
const BAR_RANGE_PX = 78;

export function IndexedFileRow({
  file,
  maxChunks,
}: {
  file: IndexedFileDTO;
  maxChunks: number;
}) {
  const barWidth =
    BAR_BASE_WIDTH_PX + Math.round(BAR_RANGE_PX * (file.chunks / maxChunks));

  return (
    <div className="flex items-center gap-3.5 border-b border-white/3 px-0.5 py-1.5 last:border-b-0">
      <span className="min-w-0 flex-1 truncate text-[12.5px] text-fg italic" title={file.name}>
        {file.name}
      </span>
      <span className="shrink-0 text-[11px] text-fg-dim">
        {file.chunks} chunk{file.chunks === 1 ? "" : "s"}
      </span>
      <span className="h-[3px] w-24 shrink-0 overflow-hidden rounded-xs bg-white/5">
        <span className="block h-full rounded-xs bg-info" style={{ width: barWidth }} />
      </span>
    </div>
  );
}
