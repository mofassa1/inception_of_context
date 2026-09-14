import type { ChunkMetadataDTO } from "./dto";

export type StoredChunk = {
  id: string;
  document: string;
  metadata: ChunkMetadataDTO;
};
