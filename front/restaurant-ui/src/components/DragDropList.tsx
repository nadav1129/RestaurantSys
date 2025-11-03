import React, { useState } from "react";
import type { ListItem } from "../types";


type Props = { items: ListItem[]; onReorder: (items: ListItem[]) => void; title?: string };


export default function DragDropList({ items, onReorder, title }: Props) {
const [dragId, setDragId] = useState<string | null>(null);


const onDragStart = (id: string, e: React.DragEvent) => {
setDragId(id);
e.dataTransfer.setData("text/plain", id);
e.dataTransfer.effectAllowed = "move";
};
const onDragOver = (_: string, e: React.DragEvent) => { e.preventDefault(); };
const onDrop = (overId: string, e: React.DragEvent) => {
e.preventDefault();
const sourceId = dragId ?? e.dataTransfer.getData("text/plain");
if (!sourceId || sourceId === overId) return;
const srcIdx = items.findIndex((i) => i.id === sourceId);
const dstIdx = items.findIndex((i) => i.id === overId);
if (srcIdx < 0 || dstIdx < 0) return;
const next = items.slice();
const [moved] = next.splice(srcIdx, 1);
next.splice(dstIdx, 0, moved);
onReorder(next);
setDragId(null);
};


return (
<div className="space-y-2">
{title && <div className="text-sm font-semibold text-gray-700">{title}</div>}
<ul className="rounded-2xl border border-dashed border-gray-300 bg-white p-2">
{items.map((it) => (
<li
key={it.id}
draggable
onDragStart={(e) => onDragStart(it.id, e)}
onDragOver={(e) => onDragOver(it.id, e)}
onDrop={(e) => onDrop(it.id, e)}
className={`mb-2 flex items-center justify-between gap-3 rounded-xl border border-gray-200 px-3 py-2 last:mb-0 ${dragId === it.id ? "opacity-60" : ""}`}
>
<span className="text-sm text-gray-800">{it.label}</span>
<span className="text-xs text-gray-500">drag me</span>
</li>
))}
</ul>
</div>
);
}