import type { PackingCategory, PackingItem, PackingParticipant } from "@/components/packing/packing-list";
import { normalizePackingKey } from "@/lib/packing-templates/normalize";

export function categoryNameForId(
  categoryId: string,
  categories: PackingCategory[]
): string {
  return categories.find((c) => c.id === categoryId)?.name ?? "";
}

export function assigneeNameForParticipantId(
  participantId: string | null,
  participants: PackingParticipant[]
): string {
  if (!participantId) return "";
  return participants.find((p) => p.id === participantId)?.name ?? "";
}

export function packingItemToKeyFields(
  item: PackingItem,
  categories: PackingCategory[],
  participants: PackingParticipant[]
) {
  return {
    name: item.title,
    category: categoryNameForId(item.category_id, categories),
    assignedTo: assigneeNameForParticipantId(
      item.assigned_to_participant_id,
      participants
    ),
  };
}

export function packingItemToKey(
  item: PackingItem,
  categories: PackingCategory[],
  participants: PackingParticipant[]
): string {
  return normalizePackingKey(packingItemToKeyFields(item, categories, participants));
}

export function resolveParticipantId(
  assignedToName: string | null | undefined,
  participants: PackingParticipant[]
): string | null {
  const norm = (assignedToName ?? "").trim().toLowerCase();
  if (!norm || norm === "everyone") return null;
  const match = participants.find(
    (p) => p.name.trim().toLowerCase() === norm
  );
  return match?.id ?? null;
}
