"use client";

import { useRef, useState } from "react";

interface SubcategoryInputProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
}

export function SubcategoryInput({
  value,
  onChange,
  options,
  placeholder,
  className = "",
}: SubcategoryInputProps) {
  const [open, setOpen] = useState(false);
  const blurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filtered = options.filter((option) =>
    option.toLowerCase().includes(value.trim().toLowerCase())
  );

  function handleFocus() {
    if (blurTimeout.current) clearTimeout(blurTimeout.current);
    setOpen(true);
  }

  function handleBlur() {
    // Delay para que el click en una opción llegue antes de que se cierre el dropdown.
    blurTimeout.current = setTimeout(() => setOpen(false), 150);
  }

  function handleSelect(option: string) {
    if (blurTimeout.current) clearTimeout(blurTimeout.current);
    onChange(option);
    setOpen(false);
  }

  return (
    <div className="relative">
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={className}
      />
      {open && filtered.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-40 overflow-auto rounded-control border-[1.5px] border-border bg-white shadow-card">
          {filtered.map((option) => (
            <button
              key={option}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => handleSelect(option)}
              className="block w-full px-3 py-1.5 text-left text-xs text-ink-soft hover:bg-cream-soft"
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
