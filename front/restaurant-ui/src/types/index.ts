export type Page =
| "home"
| "assistant"
| "service"
| "actions"
| "login"
| "management"
| "settings"
| "orders"
| "order";


export type TableInfo = {
  id: string;          // e.g., "12"
  owner: string;      // e.g., "Nadav"
  total: number;      // e.g., 128
  tableNum: number; // e.g., 12
};

export type InventoryItem = {
  id: string;
  name: string;
  qty: number;
};

// src/types/index.ts

/* Fixed set of station TYPES (not unique names) */
export const STATION_TYPES = [
  "Bar",
  "Floor",
  "Kitchen",
  "Checker",
  "Hostes",
  "selector",
  "Storage",
  "Managment",
] as const;

export type StationType = (typeof STATION_TYPES)[number];

export type Station = {
  stationId: string;
  stationName: string;
  stationType: StationType;
  revenueCenterId?: string | null;
  revenueCenterName?: string | null;
  checkerRevenueCenterId?: string | null;
  checkerRevenueCenterName?: string | null;
  checkerPrintEnabled?: boolean;
};

export type RevenueCenterStation = {
  stationId: string;
  stationName: string;
  stationType: Extract<StationType, "Bar" | "Floor">;
};

export type CheckerRevenueCenterStation = {
  stationId: string;
  stationName: string;
  productScope: "food" | "drinks" | "both";
};

export type RevenueCenter = {
  revenueCenterId: string;
  name: string;
  checkerStations: CheckerRevenueCenterStation[];
  stations: RevenueCenterStation[];
};

export type CheckerStationSettings = {
  stationId: string;
  revenueCenterId?: string | null;
  revenueCenterName?: string | null;
  printEnabled: boolean;
  productScope: "food" | "drinks" | "both";
};

export type Printer = {
  printerId: string;
  printerName: string;
};

export type DeviceGroup = {
  deviceGroupId: string;
  name: string;
  stationId?: string | null;
  stationName?: string | null;
  stationType?: StationType | null;
  deviceCount: number;
};

export type ManagedDevice = {
  deviceId: string;
  deviceName: string;
  printerId?: string | null;
  printerName?: string | null;
  deviceGroupId?: string | null;
  deviceGroupName?: string | null;
  stationId?: string | null;
  stationName?: string | null;
  stationType?: StationType | null;
};

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
