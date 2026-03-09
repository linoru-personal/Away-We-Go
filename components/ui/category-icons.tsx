"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import {
  Ticket,
  Sparkles,
  Gift,
  ShoppingBag,
  Heart,
  Star,
  UtensilsCrossed,
  Wine,
  Camera,
  MapPin,
  Calendar,
  Compass,
  Plane,
  Car,
  Shirt,
  CircleDollarSign,
  Luggage,
  LucideIcon,
} from "lucide-react";

/** Icon keys for category icons (outline only, no bookmark). */
export const CATEGORY_ICON_KEYS = [
  "ticket",
  "sparkles",
  "gift",
  "shopping_bag",
  "heart",
  "star",
  "utensils",
  "wine",
  "camera",
  "map_pin",
  "calendar",
  "compass",
  "plane",
  "car",
  "shirt",
  "money",
  "luggage",
] as const;

export type CategoryIconKey = (typeof CATEGORY_ICON_KEYS)[number];

export const BUDGET_DEFAULT_ICON: CategoryIconKey = "money";
export const PACKING_DEFAULT_ICON: CategoryIconKey = "luggage";
export const PLACES_DEFAULT_ICON: CategoryIconKey = "map_pin";

const ICON_MAP: Record<CategoryIconKey, LucideIcon> = {
  ticket: Ticket,
  sparkles: Sparkles,
  gift: Gift,
  shopping_bag: ShoppingBag,
  heart: Heart,
  star: Star,
  utensils: UtensilsCrossed,
  wine: Wine,
  camera: Camera,
  map_pin: MapPin,
  calendar: Calendar,
  compass: Compass,
  plane: Plane,
  car: Car,
  shirt: Shirt,
  money: CircleDollarSign,
  luggage: Luggage,
};

/** Legacy budget icon keys → new key */
const LEGACY_KEY_MAP: Record<string, CategoryIconKey> = {
  home: "map_pin",
  car: "car",
  utensils: "utensils",
  compass: "compass",
  bag: "luggage",
  dots: "star",
};

/** Emoji (or stored value) → new key. Covers old DB values. */
const EMOJI_TO_KEY: Record<string, CategoryIconKey> = {
  "🍽️": "utensils",
  "🚗": "car",
  "✈️": "plane",
  "🏨": "map_pin",
  "🎟️": "ticket",
  "✨": "sparkles",
  "🛍️": "shopping_bag",
  "🎁": "gift",
  "📷": "camera",
  "🗺️": "map_pin",
  "📍": "map_pin",
  "📅": "calendar",
  "🧭": "compass",
  "❤️": "heart",
  "⭐": "star",
  "👕": "shirt",
  "🧴": "luggage",
  "💊": "star",
  "🔌": "compass",
  "📄": "ticket",
  "💰": "money",
  "🏠": "map_pin",
};

/**
 * Normalizes a stored category icon (emoji, legacy key, or already new key) to a CategoryIconKey.
 * Use for display and for saving when you want to migrate to key.
 */
export function getIconKey(
  icon: string | null | undefined,
  fallback: CategoryIconKey = "star"
): CategoryIconKey {
  if (icon == null || icon === "") return fallback;
  const trimmed = icon.trim();
  if (!trimmed) return fallback;
  const lower = trimmed.toLowerCase();
  if (LEGACY_KEY_MAP[lower] !== undefined) return LEGACY_KEY_MAP[lower];
  if (EMOJI_TO_KEY[trimmed] !== undefined) return EMOJI_TO_KEY[trimmed];
  if (CATEGORY_ICON_KEYS.includes(lower as CategoryIconKey)) return lower as CategoryIconKey;
  return fallback;
}

export interface CategoryIconProps {
  iconKey: CategoryIconKey | string | null | undefined;
  className?: string;
  /** @default 20 */
  size?: number;
}

/** Renders a single category icon (black outline, no fill). */
export function CategoryIcon({
  iconKey,
  className = "",
  size = 20,
}: CategoryIconProps) {
  const key = getIconKey(iconKey, "star");
  const Icon = ICON_MAP[key];
  if (!Icon) return null;
  return (
    <Icon
      size={size}
      className={className}
      strokeWidth={2}
      aria-hidden
    />
  );
}

export interface CategoryIconPickerProps {
  value: CategoryIconKey | string | null | undefined;
  onChange: (key: CategoryIconKey) => void;
  /** Optional class for the trigger button. */
  className?: string;
}

export function CategoryIconPicker({
  value,
  onChange,
  className = "",
}: CategoryIconPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [position, setPosition] = React.useState<{ top: number; left: number } | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  const updatePosition = () => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPosition({ top: rect.bottom + 4, left: rect.left });
  };

  React.useLayoutEffect(() => {
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

  React.useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      const portal = document.getElementById("category-icon-picker-portal");
      if (portal?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const displayKey = getIconKey(value, BUDGET_DEFAULT_ICON);
  const POPOVER_Z = 9999;

  const popover =
    open &&
    position &&
    typeof document !== "undefined" && (
      <div
        id="category-icon-picker-portal"
        className="fixed w-[max-content] max-w-[min(100vw-16px,280px)] grid grid-cols-6 gap-1 rounded-xl border border-[#ebe5df] bg-white p-2 shadow-lg"
        style={{ zIndex: POPOVER_Z, top: position.top, left: position.left }}
        role="listbox"
      >
        {CATEGORY_ICON_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            className="flex size-9 items-center justify-center rounded-lg text-[#1f1f1f] transition hover:bg-[#f6f2ed] focus:outline-none focus:ring-2 focus:ring-[#d97b5e] focus:ring-inset"
            role="option"
            aria-selected={displayKey === key}
            onClick={() => {
              onChange(key);
              setOpen(false);
            }}
          >
            <CategoryIcon iconKey={key} size={20} />
          </button>
        ))}
      </div>
    );

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        className={`flex size-9 flex-shrink-0 items-center justify-center rounded-lg border border-transparent bg-[#f6f2ed] text-[#1f1f1f] transition hover:bg-[#ebe5df] focus:outline-none focus:ring-2 focus:ring-[#d97b5e] focus:ring-offset-2 ${className}`}
        onClick={() => setOpen((o) => !o)}
        aria-label="Choose icon"
        aria-expanded={open}
      >
        <CategoryIcon iconKey={displayKey} size={20} />
      </button>
      {typeof document !== "undefined" && popover && createPortal(popover, document.body)}
    </div>
  );
}
