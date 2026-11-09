import type {
  PackingCategory,
  PackingItem,
  PackingParticipant,
} from "@/components/packing/packing-list";

/** Same values as the `viewMode` / `assigneeFilter` state in packing-list.tsx. */
export type ShareScope = {
  viewMode: "category" | "participant";
  assigneeFilter: string;
};

const LRM = "\u200E";
const RLM = "\u200F";

/** Direction of the first strong character; null when there is none. */
function strongDirection(s: string): "rtl" | "ltr" | null {
  for (const ch of s) {
    if (/[\u0590-\u05FF\u0600-\u06FF\uFB1D-\uFDFF\uFE70-\uFEFF]/.test(ch)) return "rtl";
    if (/\p{L}/u.test(ch)) return "ltr";
  }
  return null;
}

/**
 * "(Name)" tag. When the name runs the opposite way to the line it sits in, the
 * brackets would take the line's direction and render mirrored; a direction mark
 * on both sides pins them to the name.
 */
function personTag(name: string, lineText: string): string {
  const nameDir = strongDirection(name);
  const lineDir = strongDirection(lineText);
  const tag = `(${name})`;
  if (!nameDir || !lineDir || nameDir === lineDir) return tag;
  const mark = nameDir === "rtl" ? RLM : LRM;
  return `${mark}${tag}${mark}`;
}

function itemLine(item: PackingItem, personName: string | null): string {
  let line = `• ${item.title}`;
  if (item.quantity > 1) line += ` ×${item.quantity}`;
  if (personName) line += ` ${personTag(personName, item.title)}`;
  return line;
}

export function buildPackingShareText(args: {
  tripTitle: string;
  scope: ShareScope;
  categories: PackingCategory[];
  participants: PackingParticipant[];
  items: PackingItem[];
}): { text: string; summary: string } {
  const { tripTitle, scope, categories, participants, items } = args;
  const { viewMode, assigneeFilter } = scope;

  const filtered =
    assigneeFilter === "all"
      ? items
      : items.filter((i) => {
          const aid = i.assigned_to_participant_id;
          if (assigneeFilter === "everyone") return !aid;
          return aid === assigneeFilter;
        });

  const sorted = [...filtered].sort((a, b) => a.sort_order - b.sort_order);

  const filterPerson =
    assigneeFilter !== "all" && assigneeFilter !== "everyone"
      ? participants.find((p) => p.id === assigneeFilter) ?? null
      : null;

  const nameOf = (item: PackingItem): string | null => {
    const aid = item.assigned_to_participant_id;
    if (!aid) return null;
    return participants.find((p) => p.id === aid)?.name ?? null;
  };

  const orderedCategories = [...categories].sort(
    (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)
  );

  const blocks: string[] = [];

  if (viewMode === "category") {
    const showPerson = assigneeFilter === "all";
    for (const c of orderedCategories) {
      const list = sorted.filter((i) => i.category_id === c.id);
      if (list.length === 0) continue;
      blocks.push(
        [`*${c.name}*`, ...list.map((i) => itemLine(i, showPerson ? nameOf(i) : null))].join("\n")
      );
    }
  } else {
    const people: { label: string; participantId: string | null }[] = [
      { label: "Everyone", participantId: null },
      ...participants.map((p) => ({ label: p.name, participantId: p.id })),
    ];
    for (const person of people) {
      const mine = sorted.filter(
        (i) => (i.assigned_to_participant_id ?? null) === person.participantId
      );
      if (mine.length === 0) continue;
      const lines = [`*${person.label}*`];
      for (const c of orderedCategories) {
        const inCat = mine.filter((i) => i.category_id === c.id);
        if (inCat.length === 0) continue;
        lines.push(`_${c.name}_`, ...inCat.map((i) => itemLine(i, null)));
      }
      blocks.push(lines.join("\n"));
    }
  }

  const title = filterPerson
    ? `*${tripTitle} – ${filterPerson.name}'s packing list*`
    : `*${tripTitle} – packing list*`;
  const text = [title, ...blocks].join("\n\n");

  const by = viewMode === "category" ? "by category" : "by person";
  const what =
    assigneeFilter === "all"
      ? "the full list"
      : assigneeFilter === "everyone"
        ? "shared items"
        : `${filterPerson?.name ?? "their"}'s items`;
  return { text, summary: `Copied ${what}, ${by}` };
}

/** Share sheet only on touch devices that have it; desktop always copies. */
export function shouldUseShareSheet(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  return (
    window.matchMedia("(pointer: coarse)").matches && typeof navigator.share === "function"
  );
}

/** Throws when neither the share sheet nor the clipboard worked. */
export async function sharePackingText(
  text: string
): Promise<"shared" | "copied" | "cancelled"> {
  if (shouldUseShareSheet()) {
    try {
      await navigator.share({ text });
      return "shared";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
      // Any other share failure: fall through to the clipboard.
    }
  }
  await navigator.clipboard.writeText(text);
  return "copied";
}
