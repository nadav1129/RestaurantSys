// File: src/pages/FloorPage.tsx
import React from "react";
import StationServicePage from "./StationServicePage";
import type { InventoryItem, TableInfo } from "../types";

const mockTables: TableInfo[] = [
  { id: "10", owner: "Lior", total: 230 },
  { id: "11", owner: "Shir", total: 42 },
  { id: "12", owner: "Tal", total: 0 },
];
const mockInv: InventoryItem[] = [
  { id: "napkins", name: "Napkins", qty: 120 },
  { id: "straws", name: "Straws", qty: 80 },
  { id: "glasses", name: "Glasses", qty: 35 },
];

export default function FloorPage({ onOpenOrderForTable }: { onOpenOrderForTable: (tableId: string) => void }) {
  return (
    <StationServicePage
      station="Floor"
      tables={mockTables}
      inventory={mockInv}
      onOpenOrderForTable={onOpenOrderForTable}
    />
  );
}
