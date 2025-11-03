import React from "react";
import Button from "./Button";
import type { Page } from "../types";


type Props = { current: Page; onNavigate: (p: Page) => void };


export default function TopBar({ current, onNavigate }: Props) {
const tabs: { key: Page; label: string }[] = [
{ key: "home", label: "Home" },
{ key: "service", label: "Service" },
{ key: "actions", label: "Actions" },
{ key: "login", label: "Login" },
{ key: "management", label: "Management" },
{ key: "settings", label: "Settings" },
];
return (
<header className="sticky top-0 z-30 w-full border-b border-gray-200 bg-white/70 backdrop-blur">
<div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
<div className="flex items-center gap-3">
<div className="h-8 w-8 rounded-xl bg-indigo-600" />
<h1 className="text-lg font-semibold">RestaurantSys</h1>
</div>
<nav className="flex items-center gap-1 rounded-2xl bg-gray-100 p-1">
{tabs.map((t) => (
<button
key={t.key}
className={`rounded-xl px-3 py-1.5 text-sm font-medium transition ${
current === t.key ? "bg-white shadow text-gray-900" : "text-gray-600 hover:text-gray-900"
}`}
onClick={() => onNavigate(t.key)}
>
{t.label}
</button>
))}
</nav>
<div className="flex items-center gap-2">
<Button type="ghost" className="hidden sm:inline-flex">Help</Button>
</div>
</div>
</header>
);
}