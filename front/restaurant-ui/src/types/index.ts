export type Page =
| "home"
| "service"
| "actions"
| "login"
| "management"
| "settings"
| "order";


export type TableInfo = {
  id: string;          // e.g., "12"
  owner?: string;      // e.g., "Nadav"
  total?: number;      // e.g., 128
};

export type InventoryItem = {
  id: string;
  name: string;
  qty: number;
};

export type Station = "Bar" | "Floor" | "Hostess" | "Kitchen";

export type Meal = {
  id: string;
  name: string;
  qty: number;
  tableId: string;
};

export type SimpleEntry = {
  id: string;
  name: string;
  note?: string;
};

export type TableBlacklist = {
  id: string;
  name: string;
  note?: string;
  min?: number;       // minimum order / cover?
  tableId?: string;   // for hostess tables list
};

export type ListItem = {
id: string;
label: string;
checked?: boolean;
group?: string; // for separators
selectable?: boolean; // shows a select instead of checkbox
options?: string[]; // select options
value?: string; // selected value
};