// File: src/pages/BarPage.tsx
import React from "react";
import StationServicePage from "./StationServicePage";
import type { InventoryItem, TableInfo } from "../types";

const mockTables: TableInfo[] = [
  { id: "1", owner: "Dana", total: 86 },
  { id: "2", owner: "Noa", total: 0 },
  { id: "7", owner: "Avi", total: 154 },
];
const mockInv: InventoryItem[] = [
  { id: "gin", name: "Gin", qty: 4 },
  { id: "vodka", name: "Vodka", qty: 6 },
  { id: "rum", name: "Rum", qty: 5 },
  { id: "tonic", name: "Tonic", qty: 12 },
];

export default function BarPage({ onOpenOrderForTable }: { onOpenOrderForTable: (tableId: string) => void }) {
  return (
    <StationServicePage
      station="Bar"
      tables={mockTables}
      inventory={mockInv}
      onOpenOrderForTable={onOpenOrderForTable}
    />
  );
}
