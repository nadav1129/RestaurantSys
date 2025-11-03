import React, { useMemo } from "react";
import Button from "./Button";
import type { ListItem } from "../types";


type Props = { items: ListItem[]; onChange: (items: ListItem[]) => void };


export default function DynamicList({ items, onChange }: Props) {
const groups = useMemo(() => {
const map = new Map<string, ListItem[]>();
for (const it of items) {
const g = it.group ?? "";
if (!map.has(g)) map.set(g, []);
map.get(g)!.push(it);
}
return Array.from(map.entries());
}, [items]);


const setItem = (id: string, patch: Partial<ListItem>) => {
const next = items.map((it) => (it.id === id ? { ...it, ...patch } : it));
onChange(next);
};


return (
<ul className="divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white">
{groups.map(([group, groupItems], gi) => (
<li key={group + gi}>
{group && (
<div className="sticky top-[97px] z-10 bg-gray-50 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
{group}
</div>
)}
<ul>
{groupItems.map((it) => (
<li key={it.id} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50">
<div className="flex items-center gap-3">
{!it.selectable ? (
<input
type="checkbox"
className="h-4 w-4 rounded border-gray-300"
checked={!!it.checked}
onChange={(e) => setItem(it.id, { checked: e.target.checked })}
/>
) : (
<div className="text-xs text-gray-500">Select</div>
)}
<span className="text-sm text-gray-800">{it.label}</span>
</div>
{it.selectable ? (
<select
className="rounded-xl border border-gray-300 px-2 py-1 text-sm"
value={it.value ?? ""}
onChange={(e) => setItem(it.id, { value: e.target.value })}
>
<option value="" disabled>Choose</option>
{(it.options ?? []).map((opt) => (
<option key={opt} value={opt}>{opt}</option>
))}
</select>
) : (
<Button type={it.checked ? "success" : "ghost"} onClick={() => setItem(it.id, { checked: !it.checked })}>
{it.checked ? "Done" : "Mark"}
</Button>
)}
</li>
))}
</ul>
</li>
))}
</ul>
);
}