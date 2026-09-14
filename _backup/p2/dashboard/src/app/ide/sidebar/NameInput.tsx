import { useEffect, useRef, useState } from "react";

export function NameInput({
  initialValue = "",
  placeholder,
  onSubmit,
  onCancel,
}: {
  initialValue?: string;
  placeholder?: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const settledRef = useRef(false);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <input
      ref={inputRef}
      className="tree-name-input"
      value={value}
      placeholder={placeholder}
      onChange={(event) => setValue(event.target.value)}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation();

        if (event.key === "Enter") {
          settledRef.current = true;
          onSubmit(value.trim());
        } else if (event.key === "Escape") {
          settledRef.current = true;
          onCancel();
        }
      }}
      onBlur={() => {
        if (!settledRef.current) onCancel();
      }}
    />
  );
}
