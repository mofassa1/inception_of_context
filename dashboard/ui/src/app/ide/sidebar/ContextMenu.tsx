import { useEffect } from "react";

export type ContextMenuItem = {
  label: string;
  onClick: () => void;
  danger?: boolean;
};

export function ContextMenu({
  x,
  y,
  items,
  onClose,
}: {
  x: number;
  y: number;
  items: ContextMenuItem[];
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
    <div
      className="fixed z-1000 min-w-[160px] rounded-[5px] border border-border bg-chrome-bg p-1 text-[13px] shadow-menu"
      style={{ left: x, top: y }}
      onClick={(event) => event.stopPropagation()}
    >
      {items.map((item) => (
        <div
          key={item.label}
          className={
            "cursor-pointer rounded-[3px] px-2.5 py-1.5 whitespace-nowrap hover:text-white " +
            (item.danger ? "text-danger hover:bg-danger" : "text-fg hover:bg-accent")
          }
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
