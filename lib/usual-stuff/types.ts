export type UsualCategory = {
  id: string;
  list_id: string;
  name: string;
  icon: string | null;
  sort_order: number;
};

export type UsualItem = {
  id: string;
  list_id: string;
  category_id: string;
  title: string;
  quantity: number;
  person_label: string | null;
  is_always: boolean;
  sort_order: number;
  created_at: string;
};

export type UsualRowInput = {
  title: string;
  quantity: number;
  category_name: string;
  category_icon: string | null;
  person_label: string | null;
};
