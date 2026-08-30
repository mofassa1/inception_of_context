import { useEffect } from "react";

export function ContextMenu({
  x,
  y,
  items,
  onClose,
}: {
  x: number;
  y: number;
  items: { label: string; onClick: () => void; danger?: boolean }[];
  onClose: () => void;
}) {
  useEffect(() => {
    window.addEventListener("click", onClose);
    window.addEventListener("contextmenu", onClose);
    return () => {
      window.removeEventListener("click", onClose);
      window.removeEventListener("contextmenu", onClose);
    };
  }, [onClose]);

  return (
    <div className="context-menu" style={{ left: x, top: y }} onClick={(e) => e.stopPropagation()}>
      {items.map((item) => (
        <div
          key={item.label}
          className={"context-menu-item" + (item.danger ? " danger" : "")}
          onClick={() => {
            onClose();
            item.onClick();
          }}
        >
          {item.label}
        </div>
      ))}
    </div>
  );
}
