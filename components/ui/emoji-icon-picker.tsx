"use client";

import { useEffect, useRef, useState } from "react";
import { CATEGORY_ICON_CHOICES } from "@/components/ui/category-icon-choices";

const PLACEHOLDER = "⭐";

export interface EmojiIconPickerProps {
  value: string | null;
  onChange: (emoji: string) => void;
}

export function EmojiIconPicker({ value, onChange }: EmojiIconPickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const display = value && value.trim() !== "" ? value : PLACEHOLDER;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        className="flex size-9 flex-shrink-0 items-center justify-center rounded-lg bg-[#f6f2ed] text-lg text-[#1f1f1f] transition hover:bg-[#ebe5df] focus:outline-none focus:ring-2 focus:ring-[#d97b5e] focus:ring-offset-2"
        onClick={() => setOpen((o) => !o)}
        aria-label="Choose icon"
        aria-expanded={open}
      >
        <span role="img" aria-hidden>
          {display}
        </span>
      </button>
      {open && (
        <div
          className="absolute left-0 top-full z-10 mt-1 grid grid-cols-5 gap-1 rounded-xl border border-[#ebe5df] bg-white p-2 shadow-lg"
          role="listbox"
        >
          {CATEGORY_ICON_CHOICES.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="flex size-9 items-center justify-center rounded-lg text-lg transition hover:bg-[#f6f2ed] focus:outline-none focus:ring-2 focus:ring-[#d97b5e] focus:ring-inset"
              role="option"
              aria-selected={value === emoji}
              onClick={() => {
                onChange(emoji);
                setOpen(false);
              }}
            >
              <span role="img" aria-hidden>
                {emoji}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
