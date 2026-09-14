export type DirectoryEntry = {
  name: string;
  path: string;
  is_dir: boolean;
};

export type DirectoryListing = {
  path: string;
  entries: DirectoryEntry[];
};

export type FileContent = {
  path: string;
  content: string;
};

export type WriteResult = {
  ok: true;
};

export type CreateEntryInput = {
  entryPath: string;
  isDirectory: boolean;
};

export type RenameEntryInput = {
  currentPath: string;
  nextPath: string;
};

export type WriteFileInput = {
  filePath: string;
  content: string;
};

export type FileTreeCallbacks = {
  onOpenFile: (filePath: string) => void;
  onPathRemoved: (removedPath: string) => void;
  onPathRenamed: (previousPath: string, nextPath: string) => void;
};
