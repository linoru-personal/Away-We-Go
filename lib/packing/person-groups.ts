import type { PackingItem, PackingParticipant } from "@/components/packing/packing-list";

export type PersonBlock = {
  participantId: string | null;
  label: string;
  items: PackingItem[];
};

/** True when the items have two or more distinct assignees ("no assignee" counts as one). */
export function hasMultipleAssignees(items: PackingItem[]): boolean {
  const seen = new Set<string | null>();
  for (const item of items) {
    seen.add(item.assigned_to_participant_id ?? null);
    if (seen.size > 1) return true;
  }
  return false;
}

/**
 * Splits items into person blocks: Everyone first, then participants in order,
 * then one "Unknown" block per assignee id that is not a participant.
 * Empty blocks are omitted; items keep their input order inside a block.
 */
export function splitByPerson(
  items: PackingItem[],
  participants: PackingParticipant[]
): PersonBlock[] {
  const known = new Set(participants.map((p) => p.id));
  const blocks: PersonBlock[] = [
    { participantId: null, label: "Everyone", items: [] },
    ...participants.map((p) => ({ participantId: p.id, label: p.name, items: [] as PackingItem[] })),
  ];
  const unknown = new Map<string, PersonBlock>();
  for (const item of items) {
    const aid = item.assigned_to_participant_id ?? null;
    if (aid === null || known.has(aid)) {
      blocks.find((b) => b.participantId === aid)!.items.push(item);
    } else {
      let block = unknown.get(aid);
      if (!block) {
        block = { participantId: aid, label: "Unknown", items: [] };
        unknown.set(aid, block);
      }
      block.items.push(item);
    }
  }
  return [...blocks, ...unknown.values()].filter((b) => b.items.length > 0);
}
