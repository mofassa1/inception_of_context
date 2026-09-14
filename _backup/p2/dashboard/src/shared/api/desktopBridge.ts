import type {
  DesktopBridge,
  IdeMenuAction,
  LaunchPath,
} from "@/shared/types/ide";

function getBridge(): DesktopBridge | undefined {
  return window.ide;
}

export function hasDesktopBridge(): boolean {
  return getBridge() !== undefined;
}

export function pickFolder(): Promise<string | null> {
  return getBridge()?.pickFolder() ?? Promise.resolve(null);
}

export function resolveRealPath(rawPath: string): Promise<string | null> {
  return getBridge()?.realPath(rawPath) ?? Promise.resolve(rawPath);
}

export function minimizeWindow(): void {
  getBridge()?.minimize();
}

export function toggleMaximizeWindow(): void {
  getBridge()?.toggleMaximize();
}

export function closeWindow(): void {
  getBridge()?.close();
}

export function isWindowMaximized(): Promise<boolean> {
  return getBridge()?.isMaximized() ?? Promise.resolve(false);
}

export function onMaximizeChange(
  callback: (maximized: boolean) => void,
): (() => void) | undefined {
  return getBridge()?.onMaximizeChange(callback);
}

export function onMenuAction(
  callback: (action: IdeMenuAction) => void,
): (() => void) | undefined {
  return getBridge()?.onMenu(callback);
}

export function getLaunchPaths(): Promise<LaunchPath[]> {
  return getBridge()?.getLaunchPaths() ?? Promise.resolve([]);
}

export function onOpenPaths(
  callback: (paths: LaunchPath[]) => void,
): (() => void) | undefined {
  return getBridge()?.onOpenPaths(callback);
}
