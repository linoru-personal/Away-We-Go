/** Fields used for duplicate detection (name + category + assignee). */
export type PackingKeyFields = {
  name: string;
  category: string;
  assignedTo: string;
};

export function normalizePackingPart(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

/** Duplicate key: normalized name + category + assigned person label. */
export function normalizePackingKey(fields: PackingKeyFields): string {
  return [
    normalizePackingPart(fields.name),
    normalizePackingPart(fields.category),
    normalizePackingPart(fields.assignedTo),
  ].join("\0");
}

export function packingKeyFromTemplateItem(row: {
  name: string;
  category: string | null;
  assigned_to: string | null;
}): string {
  return normalizePackingKey({
    name: row.name,
    category: row.category ?? "",
    assignedTo: row.assigned_to ?? "",
  });
}
