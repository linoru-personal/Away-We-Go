"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CATEGORY_ICON_CHOICES } from "@/components/ui/category-icon-choices";

const PLACEHOLDER = "⭐";
const POPOVER_Z = 9999;

export interface EmojiIconPickerProps {
  value: string | null;
  onChange: (emoji: string) => void;
}

export function EmojiIconPicker({ value, onChange }: EmojiIconPickerProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const updatePosition = () => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPosition({ top: rect.bottom + 4, left: rect.left });
  };

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    updatePosition();
    const trigger = triggerRef.current;
    const scrollParents: Element[] = [];
    let node: Element | null = trigger.parentElement;
    while (node) {
      const style = getComputedStyle(node);
      const overflow = style.overflowY ?? style.overflow;
      if (overflow === "auto" || overflow === "scroll" || overflow === "overlay") {
        scrollParents.push(node);
      }
      node = node.parentElement;
    }
    const onScroll = () => updatePosition();
    scrollParents.forEach((el) => el.addEventListener("scroll", onScroll, true));
    window.addEventListener("scroll", onScroll, true);
    return () => {
      scrollParents.forEach((el) => el.removeEventListener("scroll", onScroll, true));
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      const portal = document.getElementById("emoji-icon-picker-portal");
      if (portal?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const display = value && value.trim() !== "" ? value : PLACEHOLDER;

  const popover = open && position && typeof document !== "undefined" && (
    <div
      id="emoji-icon-picker-portal"
      className="fixed w-[max-content] max-w-[min(100vw-16px,220px)] grid grid-cols-5 gap-1 rounded-xl border border-[#ebe5df] bg-white p-2 shadow-lg"
      style={{
        zIndex: POPOVER_Z,
        top: position.top,
        left: position.left,
      }}
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
  );

  return (
    <div className="relative">
      <button
        ref={triggerRef}
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
      {typeof document !== "undefined" && popover && createPortal(popover, document.body)}
    </div>
  );
}
