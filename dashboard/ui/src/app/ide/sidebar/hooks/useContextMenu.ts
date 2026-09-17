import { useState } from "react";

type MenuPosition = { x: number; y: number };

export function useContextMenu() {
  const [position, setPosition] = useState<MenuPosition | null>(null);

  function openMenu(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    setPosition({ x: event.clientX, y: event.clientY });
  }

  function openMenuOnSelf(event: React.MouseEvent) {
    if (event.target !== event.currentTarget) return;
    event.preventDefault();
    setPosition({ x: event.clientX, y: event.clientY });
  }

  function closeMenu() {
    setPosition(null);
  }

  return { position, openMenu, openMenuOnSelf, closeMenu };
}
