import { useState } from "react";
import DynamicList from "../../components/DynamicList";
import DragDropList from "../../components/DragDropList";
import type { ListItem } from "../../types";
import { PageContainer, PageHeader, SectionCard } from "../../components/ui/layout";

export default function ActionsPage() {
  const [items, setItems] = useState<ListItem[]>([
    { id: "1", label: "Prep tables", group: "Opening", checked: false },
    { id: "2", label: "Stock bar", group: "Opening", checked: true },
    {
      id: "3",
      label: "Assign waiter",
      group: "Staffing",
      selectable: true,
      options: ["Waiter 1", "Waiter 2", "Waiter 3"],
      value: "",
    },
    { id: "4", label: "Print menu", group: "Admin", checked: false },
  ]);

  const [dragItems, setDragItems] = useState<ListItem[]>([
    { id: "d1", label: "Table #1" },
    { id: "d2", label: "Table #2" },
    { id: "d3", label: "Table #3" },
    { id: "d4", label: "VIP Table" },
  ]);

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        eyebrow="Actions"
        title="Shift Utilities"
        description="A lighter wrapper for the temporary task and drag-drop tools already in the frontend."
      />

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <SectionCard title="Shift To-Do" description="Operational tasks stay exactly the same, with a cleaner presentation.">
          <DynamicList items={items} onChange={setItems} />
        </SectionCard>

        <SectionCard title="Reorder Tables" description="Quick drag-and-drop sandbox for service utilities.">
          <DragDropList title="Reorder tables" items={dragItems} onReorder={setDragItems} />
        </SectionCard>
      </div>
    </PageContainer>
  );
}
