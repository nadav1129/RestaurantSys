import React, { useState } from "react";
import DynamicList from "../../components/DynamicList";
import DragDropList from "../../components/DragDropList";
import type { ListItem } from "../../types";


export default function ActionsPage() {
const [items, setItems] = useState<ListItem[]>([
{ id: "1", label: "Prep tables", group: "Opening", checked: false },
{ id: "2", label: "Stock bar", group: "Opening", checked: true },
{ id: "3", label: "Assign waiter", group: "Staffing", selectable: true, options: ["Waiter 1", "Waiter 2", "Waiter 3"], value: "" },
{ id: "4", label: "Print menu", group: "Admin", checked: false },
]);


const [dragItems, setDragItems] = useState<ListItem[]>([
{ id: "d1", label: "Table #1" },
{ id: "d2", label: "Table #2" },
{ id: "d3", label: "Table #3" },
{ id: "d4", label: "VIP Table" },
]);


return (
<div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-6 md:grid-cols-3">
<div className="md:col-span-2">
<div className="mb-3 text-sm font-semibold text-gray-700">Shift To‑Do</div>
<DynamicList items={items} onChange={setItems} />
</div>
<div className="md:col-span-1">
<DragDropList title="Reorder tables" items={dragItems} onReorder={setDragItems} />
</div>
</div>
);
}