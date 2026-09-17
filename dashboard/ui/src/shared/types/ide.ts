export type LaunchPath = { path: string; isDir: boolean };

export type IdeMenuAction = "open-folder" | "close-folder" | "toggle-chat";

export type DesktopBridge = {
  pickFolder(): Promise<string | null>;
  realPath(rawPath: string): Promise<string | null>;
  minimize(): void;
  toggleMaximize(): void;
  close(): void;
  isMaximized(): Promise<boolean>;
  onMaximizeChange(callback: (maximized: boolean) => void): () => void;
  onMenu(callback: (action: IdeMenuAction) => void): () => void;
  getLaunchPaths(): Promise<LaunchPath[]>;
  onOpenPaths(callback: (paths: LaunchPath[]) => void): () => void;
};

declare global {
  interface Window {
    ide?: DesktopBridge;
  }
}
