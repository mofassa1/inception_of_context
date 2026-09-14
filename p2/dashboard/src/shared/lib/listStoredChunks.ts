import type { StoredChunk } from "@/shared/types/chunk";
import type { StoredChunksDTO } from "@/shared/types/dto";

export function listStoredChunks(storedChunks: StoredChunksDTO): StoredChunk[] {
  const chunks = storedChunks.ids.map((id, index) => ({
    id,
    document: storedChunks.documents[index],
    metadata: storedChunks.metadatas[index],
  }));

  return chunks.sort(
    (first, second) =>
      first.metadata.start_line - second.metadata.start_line ||
      second.metadata.end_line - first.metadata.end_line,
  );
}
