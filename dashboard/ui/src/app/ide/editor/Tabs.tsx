import { X } from "lucide-react";
import { FileIcon } from "@/shared/components/FileIcons";
import { getBaseName } from "@/shared/lib/path";
import type { EditorTab } from "@/shared/types/editor";

export function Tabs({
  tabs,
  activePath,
  onSelect,
  onClose,
}: {
  tabs: EditorTab[];
  activePath: string | null;
  onSelect: (filePath: string) => void;
  onClose: (filePath: string) => void;
}) {
  return (
    <div className="flex shrink-0 overflow-x-auto border-b border-border bg-chrome-bg">
      {tabs.map((tab) => {
        const name = getBaseName(tab.path);

        return (
          <div
            key={tab.path}
            className={
              "group flex h-[35px] max-w-[200px] shrink-0 cursor-pointer items-center gap-1.5 border-t border-r border-r-border pr-2.5 pl-3 font-ui text-[13px] " +
              (tab.path === activePath
                ? "border-t-tab-active-top bg-editor-bg text-fg-strong"
                : "border-t-transparent bg-chrome-bg text-fg hover:text-fg")
            }
            onClick={() => onSelect(tab.path)}
          >
            <FileIcon name={name} />
            <span className="truncate">{name}</span>
            <span
              className={
                "flex size-5 shrink-0 items-center justify-center rounded hover:bg-white/10 hover:text-fg-strong " +
                (tab.path === activePath ? "text-fg" : "text-fg-dim")
              }
              onClick={(event) => {
                event.stopPropagation();
                onClose(tab.path);
              }}
            >
              <X size={14} strokeWidth={2.5} />
            </span>
          </div>
        );
      })}
    </div>
  );
}
