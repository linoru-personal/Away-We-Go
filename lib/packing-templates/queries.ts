import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  PackingTemplateItemRow,
  PackingTemplateWithCount,
} from "@/lib/packing-templates/types";

export async function fetchTemplates(
  supabase: SupabaseClient
): Promise<PackingTemplateWithCount[]> {
  const { data: templates, error } = await supabase
    .from("packing_templates")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);

  const rows = (templates ?? []) as PackingTemplateWithCount[];
  if (rows.length === 0) return [];

  const { data: items, error: itemsError } = await supabase
    .from("packing_template_items")
    .select("id, template_id, name, category, assigned_to, quantity, created_at");

  if (itemsError) throw new Error(itemsError.message);

  const itemsByTemplate = new Map<string, PackingTemplateItemRow[]>();
  for (const row of (items ?? []) as PackingTemplateItemRow[]) {
    const list = itemsByTemplate.get(row.template_id) ?? [];
    list.push(row);
    itemsByTemplate.set(row.template_id, list);
  }

  for (const list of itemsByTemplate.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }

  return rows.map((t) => {
    const templateItems = itemsByTemplate.get(t.id) ?? [];
    return {
      ...t,
      item_count: templateItems.length,
      items: templateItems,
    };
  });
}
