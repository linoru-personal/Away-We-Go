import type { PackingParticipant } from "@/components/packing/packing-list";
import { sameName } from "@/lib/usual-stuff/queries";

/**
 * What the user decided for one person label in the picker.
 * "unset" means nothing is chosen yet: it blocks adding and is never treated as Everyone.
 */
export type WhoChoice =
  | { kind: "participant"; id: string }
  | { kind: "everyone" }
  | { kind: "skip" }
  | { kind: "unset" };

/** The id of the trip participant whose name matches the label (case and whitespace insensitive), or null. */
export function suggestParticipantId(
  label: string,
  participants: PackingParticipant[]
): string | null {
  const matches = participants.filter((p) => sameName(p.name, label));
  return matches.length === 1 ? matches[0].id : null;
}

/** Key of a person label in the who's-who record. */
export function whoKey(label: string): string {
  return label.trim().toLowerCase();
}
