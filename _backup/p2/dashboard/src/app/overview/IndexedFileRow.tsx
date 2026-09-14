import type { IndexedFile } from "@/shared/types/overview";

const BAR_BASE_WIDTH_PX = 6;
const BAR_RANGE_PX = 78;

export function IndexedFileRow({
  file,
  maxChunks,
}: {
  file: IndexedFile;
  maxChunks: number;
}) {
  const barWidth =
    BAR_BASE_WIDTH_PX + Math.round(BAR_RANGE_PX * (file.chunks / maxChunks));

  return (
    <div className="ov-file">
      <span className="ov-file-name" title={file.name}>
        {file.name}
      </span>
      <span className="ov-file-count">
        {file.chunks} chunk{file.chunks === 1 ? "" : "s"}
      </span>
      <span className="ov-file-track">
        <span className="ov-file-bar" style={{ width: barWidth }} />
      </span>
    </div>
  );
}
