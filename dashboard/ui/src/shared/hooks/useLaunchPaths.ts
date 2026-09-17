import { useEffect, useRef } from "react";
import { getLaunchPaths, onOpenPaths } from "@/shared/api/desktopBridge";
import type { LaunchPath } from "@/shared/types/ide";

export function useLaunchPaths(onPaths: (paths: LaunchPath[]) => void) {
  const handlerRef = useRef(onPaths);
  handlerRef.current = onPaths;

  useEffect(() => {
    getLaunchPaths().then((paths) => {
      if (paths.length > 0) handlerRef.current(paths);
    });

    return onOpenPaths((paths) => handlerRef.current(paths));
  }, []);
}
