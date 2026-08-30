import { X } from "lucide-react";
import type { Tab } from "../../useTabs.js";
import { FileIcon } from "../fileIcons.js";

export function Tabs({
  tabs,
  activePath,
  onSelect,
  onClose,
}: {
  tabs: Tab[];
  activePath: string | null;
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
}) {
  return (
    <div className="tabbar">
      {tabs.map((tab) => {
        const name = tab.path.split("/").pop() ?? tab.path;
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
              onClick={(e) => {
                e.stopPropagation();
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
