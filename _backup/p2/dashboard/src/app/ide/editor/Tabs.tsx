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
    <div className="tabbar">
      {tabs.map((tab) => {
        const name = getBaseName(tab.path);

        return (
          <div
            key={tab.path}
            className={"tab" + (tab.path === activePath ? " active" : "")}
            onClick={() => onSelect(tab.path)}
          >
            <FileIcon name={name} />
            <span className="tab-name">{name}</span>
            <span
              className="tab-close"
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
