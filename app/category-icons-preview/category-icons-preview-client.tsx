"use client";

import {
  CategoryIcon,
  CATEGORY_ICON_KEYS,
  type CategoryIconKey,
} from "@/components/ui/category-icons";

/** Friendlier labels for picker preview (falls back to key with underscores as spaces). */
const LABELS: Partial<Record<CategoryIconKey, string>> = {
  ticket: "Ticket / event",
  sparkles: "Sparkles",
  gift: "Gift",
  shopping_bag: "Shopping",
  heart: "Heart",
  star: "Star",
  utensils: "Food & dining",
  wine: "Drinks",
  camera: "Camera",
  map_pin: "Map pin",
  calendar: "Calendar",
  compass: "Compass",
  plane: "Flight",
  car: "Car",
  shirt: "Clothes",
  money: "Money",
  luggage: "Luggage",
  tent: "Camping",
  hotel: "Hotels",
  house: "Apartments / rental",
  building_2: "Buildings / condos",
  landmark: "Attractions / museums",
  ferris_wheel: "Theme parks",
  mountain: "Mountains / hiking",
  trees: "Parks / nature",
  tree_palm: "Tropical / beach",
  train_front: "Trains / rail",
  bus: "Bus / shuttle",
  ship: "Cruise / ferry",
  waves: "Water / beach",
  umbrella: "Beach / outdoor",
  telescope: "Sightseeing",
};

function labelFor(key: CategoryIconKey) {
  return LABELS[key] ?? key.replace(/_/g, " ");
}

export function CategoryIconsPreview() {
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-2 text-2xl font-bold text-neutral-900">
        Category icons (all picker options)
      </h1>
      <p className="mb-8 text-sm text-neutral-600">
        Same set as budget, packing, and places category pickers (
        {CATEGORY_ICON_KEYS.length} icons). Run{" "}
        <code className="rounded bg-neutral-200 px-1 py-0.5 text-xs">
          npm run dev
        </code>{" "}
        and open{" "}
        <code className="rounded bg-neutral-200 px-1 py-0.5 text-xs">
          /category-icons-preview
        </code>
        .
      </p>
      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5 md:grid-cols-6">
        {CATEGORY_ICON_KEYS.map((key) => (
          <li
            key={key}
            className="flex flex-col items-center gap-1 rounded-xl border border-neutral-200 bg-white p-3 text-center shadow-sm"
          >
            <CategoryIcon iconKey={key} size={32} />
            <span className="text-[11px] font-medium leading-tight text-neutral-800">
              {labelFor(key)}
            </span>
            <span className="font-mono text-[9px] text-neutral-500">{key}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
