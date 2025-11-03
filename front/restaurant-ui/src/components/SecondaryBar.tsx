import React from "react";
import Button from "./Button";

type Item = { id: string; label: string };

export default function SecondaryBar({
  title,
  items,
  activeId,
  onChange,
  topOffsetClass = "top-0", // below TopBar (h-14 ~ 56px)
}: {
  title?: string;
  items: Item[];
  activeId?: string;
  onChange: (id: string) => void;
  /** Tailwind class to control sticky offset from top (e.g., 'top-0', 'top-14') */
  topOffsetClass?: string;
}) {
  return (
  <div
    className={[
      "sticky",           // <-- keeps it anchored within scroll area
      topOffsetClass,     // e.g. "top-0" or "top-14"
      "z-20",
      "border-b border-gray-200 bg-white/80 backdrop-blur-md",
      "mb-4",             //  add this line for spacing below the bar
    ].join(" ")}
  >
    <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-2">
      {title && <div className="text-sm font-semibold">{title}</div>}
      <div className="flex min-w-0 gap-2 overflow-x-auto py-1">
        {items.map((it) => (
          <Button
            key={it.id}
            variant={activeId === it.id ? "primary" : "secondary"}
            onClick={() => onChange(it.id)}
            className="whitespace-nowrap"
          >
            {it.label}
          </Button>
        ))}
      </div>
    </div>
  </div>
);
}
