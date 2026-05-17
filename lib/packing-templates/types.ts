export type PackingTemplateRow = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

export type PackingTemplateItemRow = {
  id: string;
  template_id: string;
  name: string;
  category: string | null;
  assigned_to: string | null;
  quantity: number;
  created_at: string;
};

export type PackingTemplateWithCount = PackingTemplateRow & {
  item_count: number;
  items: PackingTemplateItemRow[];
};

export type TemplateMutationResult = {
  added: number;
  skipped: number;
};
