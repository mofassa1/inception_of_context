import { useEffect, useRef, useState } from "react";

export function NameInput({
  initial = "",
  placeholder,
  onSubmit,
  onCancel,
}: {
  initial?: string;
  placeholder?: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  return (
    <input
      ref={ref}
      className="tree-name-input"
      value={value}
      placeholder={placeholder}
      onChange={(e) => setValue(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") {
          doneRef.current = true;
          onSubmit(value.trim());
        } else if (e.key === "Escape") {
          doneRef.current = true;
          onCancel();
        }
      }}
      onBlur={() => {
        if (!doneRef.current) onCancel();
      }}
    />
  );
}
