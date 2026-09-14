export type OverviewStatus = {
  chunksIndexed: number;
  targetProject: string;
  chromaPath: string;
  askModel: string;
  codeModel: string;
  embedModel: string;
  ollamaBackend: string;
  watching: boolean;
};

export type IndexedFile = {
  name: string;
  chunks: number;
};

export type OverviewData = {
  status: OverviewStatus;
  files: IndexedFile[];
  filesIndexed: number;
};
