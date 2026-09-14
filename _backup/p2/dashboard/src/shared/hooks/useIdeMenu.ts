import { useEffect, useRef } from "react";
import { onMenuAction } from "@/shared/api/desktopBridge";
import type { IdeMenuAction } from "@/shared/types/ide";

export function useIdeMenu(handler: (action: IdeMenuAction) => void) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    return onMenuAction((action) => handlerRef.current(action));
  }, []);
}
