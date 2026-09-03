export type OverviewStatus = {
  chunksIndexed: number;
  targetProject: string;
  chromaPath: string;
  askModel: string;
  codeModel: string;
  ollamaBackend: string;
};

export type IndexedFile = {
  name: string;
  chunks: number;
};

export type ActivityKind = "modified" | "created" | "deleted";

export type ActivityEvent = {
  id: string;
  kind: ActivityKind;
  path: string;
  at: number;
};

export type OverviewData = {
  status: OverviewStatus;
  files: IndexedFile[];
  activity: ActivityEvent[];
};
