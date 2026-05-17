import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  PackingCategory,
  PackingItem,
  PackingParticipant,
} from "@/components/packing/packing-list";
import {
  categoryNameForId,
  packingItemToKey,
  packingItemToKeyFields,
  resolveParticipantId,
} from "@/lib/packing-templates/trip-fields";
import { packingKeyFromTemplateItem } from "@/lib/packing-templates/normalize";
import type {
  PackingTemplateItemRow,
  PackingTemplateWithCount,
  TemplateMutationResult,
} from "@/lib/packing-templates/types";

function templateItemInsertRow(
  templateId: string,
  fields: { name: string; category: string; assignedTo: string; quantity: number }
) {
  return {
    template_id: templateId,
    name: fields.name.trim(),
    category: fields.category.trim() || null,
    assigned_to: fields.assignedTo.trim() || null,
    quantity: fields.quantity >= 1 ? fields.quantity : 1,
  };
}

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

export async function createTemplateFromTrip(
  supabase: SupabaseClient,
  userId: string,
  tripId: string,
  templateName: string,
  items: PackingItem[],
  categories: PackingCategory[],
  participants: PackingParticipant[]
): Promise<{ templateId: string; itemCount: number }> {
  const name = templateName.trim();
  if (!name) throw new Error("Template name is required.");

  const { data: template, error: templateError } = await supabase
    .from("packing_templates")
    .insert({ user_id: userId, name })
    .select("id")
    .single();

  if (templateError || !template) {
    throw new Error(templateError?.message ?? "Could not create template.");
  }

  const templateId = (template as { id: string }).id;
  const seen = new Set<string>();
  const toInsert: ReturnType<typeof templateItemInsertRow>[] = [];

  for (const item of items) {
    const fields = packingItemToKeyFields(item, categories, participants);
    const key = packingKeyFromTemplateItem({
      name: fields.name,
      category: fields.category,
      assigned_to: fields.assignedTo,
    });
    if (seen.has(key)) continue;
    seen.add(key);
    toInsert.push(
      templateItemInsertRow(templateId, {
        name: fields.name,
        category: fields.category,
        assignedTo: fields.assignedTo,
        quantity: item.quantity,
      })
    );
  }

  if (toInsert.length > 0) {
    const { error: itemsError } = await supabase
      .from("packing_template_items")
      .insert(toInsert);
    if (itemsError) throw new Error(itemsError.message);
  }

  return { templateId, itemCount: toInsert.length };
}

export async function addTripItemsToTemplate(
  supabase: SupabaseClient,
  templateId: string,
  items: PackingItem[],
  categories: PackingCategory[],
  participants: PackingParticipant[]
): Promise<TemplateMutationResult> {
  const { data: existing, error: loadError } = await supabase
    .from("packing_template_items")
    .select("name, category, assigned_to")
    .eq("template_id", templateId);

  if (loadError) throw new Error(loadError.message);

  const existingKeys = new Set(
    ((existing ?? []) as Pick<
      PackingTemplateItemRow,
      "name" | "category" | "assigned_to"
    >[]).map((row) => packingKeyFromTemplateItem(row))
  );

  const toInsert: ReturnType<typeof templateItemInsertRow>[] = [];
  let skipped = 0;

  for (const item of items) {
    const fields = packingItemToKeyFields(item, categories, participants);
    const key = packingKeyFromTemplateItem({
      name: fields.name,
      category: fields.category,
      assigned_to: fields.assignedTo,
    });
    if (existingKeys.has(key)) {
      skipped += 1;
      continue;
    }
    existingKeys.add(key);
    toInsert.push(
      templateItemInsertRow(templateId, {
        name: fields.name,
        category: fields.category,
        assignedTo: fields.assignedTo,
        quantity: item.quantity,
      })
    );
  }

  if (toInsert.length > 0) {
    const { error: insertError } = await supabase
      .from("packing_template_items")
      .insert(toInsert);
    if (insertError) throw new Error(insertError.message);

    await supabase
      .from("packing_templates")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", templateId);
  }

  return { added: toInsert.length, skipped };
}

async function findOrCreateCategoryId(
  supabase: SupabaseClient,
  tripId: string,
  categoryName: string,
  categories: PackingCategory[]
): Promise<{ categoryId: string; categories: PackingCategory[] }> {
  const trimmed = categoryName.trim();
  const norm = trimmed.toLowerCase();
  const existing = categories.find((c) => c.name.trim().toLowerCase() === norm);
  if (existing) return { categoryId: existing.id, categories };

  const sortOrder =
    categories.length > 0
      ? Math.max(...categories.map((c) => c.sort_order)) + 1
      : 0;

  const { data, error } = await supabase
    .from("packing_categories")
    .insert({
      trip_id: tripId,
      name: trimmed || "Other",
      sort_order: sortOrder,
    })
    .select("id, trip_id, name, icon, sort_order")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Could not create category.");
  }

  const created = data as PackingCategory;
  return {
    categoryId: created.id,
    categories: [...categories, created],
  };
}

export async function importTemplateToTrip(
  supabase: SupabaseClient,
  templateId: string,
  tripId: string,
  tripItems: PackingItem[],
  categories: PackingCategory[],
  participants: PackingParticipant[]
): Promise<TemplateMutationResult & { categories: PackingCategory[] }> {
  const { data: templateItems, error: loadError } = await supabase
    .from("packing_template_items")
    .select("*")
    .eq("template_id", templateId)
    .order("created_at", { ascending: true });

  if (loadError) throw new Error(loadError.message);

  const existingKeys = new Set(
    tripItems.map((item) => packingItemToKey(item, categories, participants))
  );

  let cats = [...categories];
  const maxSort =
    tripItems.length > 0
      ? Math.max(...tripItems.map((i) => i.sort_order))
      : -1;
  let nextSort = maxSort + 1;

  const inserts: {
    trip_id: string;
    category_id: string;
    title: string;
    quantity: number;
    is_packed: boolean;
    assigned_to_participant_id: string | null;
    sort_order: number;
  }[] = [];

  let skipped = 0;

  for (const row of (templateItems ?? []) as PackingTemplateItemRow[]) {
    const key = packingKeyFromTemplateItem(row);
    if (existingKeys.has(key)) {
      skipped += 1;
      continue;
    }
    existingKeys.add(key);

    const categoryName = row.category?.trim() || "Other";
    const resolved = await findOrCreateCategoryId(
      supabase,
      tripId,
      categoryName,
      cats
    );
    cats = resolved.categories;

    inserts.push({
      trip_id: tripId,
      category_id: resolved.categoryId,
      title: row.name.trim(),
      quantity: row.quantity >= 1 ? row.quantity : 1,
      is_packed: false,
      assigned_to_participant_id: resolveParticipantId(
        row.assigned_to,
        participants
      ),
      sort_order: nextSort++,
    });
  }

  if (inserts.length > 0) {
    console.log("[packing_items.insert]", { context: "template-import", count: inserts.length, sample: inserts[0] });
    const { error: insertError } = await supabase
      .from("packing_items")
      .insert(inserts);
    if (insertError) throw new Error(insertError.message);
  }

  return { added: inserts.length, skipped, categories: cats };
}

export async function renameTemplate(
  supabase: SupabaseClient,
  templateId: string,
  name: string
): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Template name is required.");

  const { error } = await supabase
    .from("packing_templates")
    .update({ name: trimmed })
    .eq("id", templateId);

  if (error) throw new Error(error.message);
}

export async function deleteTemplate(
  supabase: SupabaseClient,
  templateId: string
): Promise<void> {
  const { error } = await supabase
    .from("packing_templates")
    .delete()
    .eq("id", templateId);

  if (error) throw new Error(error.message);
}
