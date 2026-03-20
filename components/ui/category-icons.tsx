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
  Tent,
  BedDouble,
  House,
  Building2,
  Castle,
  FerrisWheel,
  Mountain,
  LeafyGreen,
  TreePalm,
  TramFront,
  Bus,
  Ship,
  Waves,
  Umbrella,
  Telescope,
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
  /* travel & places */
  "tent",
  "hotel",
  "house",
  "building_2",
  "landmark",
  "ferris_wheel",
  "mountain",
  "trees",
  "tree_palm",
  "train_front",
  "bus",
  "ship",
  "waves",
  "umbrella",
  "telescope",
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
  tent: Tent,
  hotel: BedDouble,
  house: House,
  building_2: Building2,
  landmark: Castle,
  ferris_wheel: FerrisWheel,
  mountain: Mountain,
  trees: LeafyGreen,
  tree_palm: TreePalm,
  train_front: TramFront,
  bus: Bus,
  ship: Ship,
  waves: Waves,
  umbrella: Umbrella,
  telescope: Telescope,
};

/** Legacy budget icon keys → new key */
const LEGACY_KEY_MAP: Record<string, CategoryIconKey> = {
  home: "map_pin",
  car: "car",
  utensils: "utensils",
  compass: "compass",
  bag: "luggage",
  dots: "star",
  building2: "building_2",
  binoculars: "telescope",
};

/** Emoji (or stored value) → new key. Covers old DB values. */
const EMOJI_TO_KEY: Record<string, CategoryIconKey> = {
  "🍽️": "utensils",
  "🚗": "car",
  "✈️": "plane",
  "🏨": "hotel",
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
  "🏠": "house",
  "🏕️": "tent",
  "🏰": "landmark",
  "🎡": "ferris_wheel",
  "⛰️": "mountain",
  "🌲": "trees",
  "🌴": "tree_palm",
  "🚆": "train_front",
  "🚇": "train_front",
  "🚌": "bus",
  "🚢": "ship",
  "🌊": "waves",
  "☂️": "umbrella",
  "🏖️": "waves",
  "🔭": "telescope",
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
  const [position, setPosition] = React.useState<{
    left: number;
    maxHeight: number;
    top?: number;
    bottom?: number;
  } | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  /**
   * Keep the popover anchored to the trigger (never `top: 8px` alone).
   * Prefer opening below; if not enough room, open above using `bottom`.
   */
  const updatePosition = React.useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const margin = 8;
    const gap = 4;
    const designMax = Math.min(window.innerHeight * 0.55, 400);
    const minNice = 120;
    const popoverW = Math.min(360, window.innerWidth - 2 * margin);

    const spaceBelow = window.innerHeight - rect.bottom - gap - margin;
    const spaceAbove = rect.top - margin - gap;

    const maxBelow = Math.min(designMax, Math.max(0, spaceBelow));
    const maxAbove = Math.min(designMax, Math.max(0, spaceAbove));

    let placement: "below" | "above";
    let maxHeight: number;

    if (maxBelow >= minNice) {
      placement = "below";
      maxHeight = maxBelow;
    } else if (maxAbove >= minNice) {
      placement = "above";
      maxHeight = maxAbove;
    } else if (maxAbove > maxBelow) {
      placement = "above";
      maxHeight = maxAbove;
    } else {
      placement = "below";
      maxHeight = maxBelow;
    }

    let left = rect.left;
    if (left + popoverW > window.innerWidth - margin) {
      left = window.innerWidth - margin - popoverW;
    }
    if (left < margin) left = margin;

    if (placement === "below") {
      setPosition({
        left,
        maxHeight,
        top: rect.bottom + gap,
      });
    } else {
      setPosition({
        left,
        maxHeight,
        bottom: window.innerHeight - rect.top + gap,
      });
    }
  }, []);

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
    window.addEventListener("resize", updatePosition);
    return () => {
      scrollParents.forEach((el) => el.removeEventListener("scroll", onScroll, true));
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, updatePosition]);

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
        className="fixed box-border w-[min(100vw-16px,360px)] overflow-y-auto overscroll-contain grid grid-cols-8 gap-1 rounded-xl border border-[#ebe5df] bg-white p-2 shadow-lg [-webkit-overflow-scrolling:touch]"
        style={{
          zIndex: POPOVER_Z,
          left: position.left,
          maxHeight: position.maxHeight,
          ...(position.top !== undefined
            ? { top: position.top, bottom: "auto" as const }
            : { bottom: position.bottom ?? 0, top: "auto" as const }),
        }}
        role="listbox"
        aria-label="Choose category icon"
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
