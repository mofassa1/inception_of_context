export type IdeMenuAction = "open-folder" | "close-folder" | "toggle-chat";

export type DesktopBridge = {
  pickFolder(): Promise<string | null>;
  minimize(): void;
  toggleMaximize(): void;
  close(): void;
  isMaximized(): Promise<boolean>;
  onMaximizeChange(callback: (maximized: boolean) => void): () => void;
  onMenu(callback: (action: IdeMenuAction) => void): () => void;
};

declare global {
  interface Window {
    ide?: DesktopBridge;
  }
}
