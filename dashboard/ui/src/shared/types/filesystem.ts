export type FileTreeCallbacks = {
  onOpenFile: (filePath: string) => void;
  onPathRemoved: (removedPath: string) => void;
  onPathRenamed: (previousPath: string, nextPath: string) => void;
};
