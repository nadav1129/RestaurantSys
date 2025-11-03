// File: src/components/Sidebar.tsx
import React, { useState } from "react";
import Chevron from "./Chevron";

/**
 * Collapsible Sidebar that "pushes" layout (no overlay).
 * - Open width: 18rem (w-72)
 * - Collapsed width: 3.5rem (w-14)
 */
export default function Sidebar({
  children,
  title = "Quick Actions",
  collapsible = true,
  defaultOpen = true,
  openWidthClass = "w-72",      // 288px
  collapsedWidthClass = "w-14", // 56px
}: {
  children?: React.ReactNode;
  title?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
  openWidthClass?: string;
  collapsedWidthClass?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <aside
      className={[
        "hidden md:block shrink-0 border-r border-gray-200 bg-white/60",
        "transition-all duration-200 ease-out", // smooth width change
        open ? openWidthClass : collapsedWidthClass,
      ].join(" ")}
    >
      {/* Header / Toggle */}
      <button
        className="m-3 mb-2 flex w-[calc(100%-1.5rem)] items-center justify-between rounded-xl border border-gray-200 bg-white px-3 py-2 text-left text-sm font-medium"
        onClick={() => collapsible && setOpen((o) => !o)}
        aria-label={open ? "Collapse sidebar" : "Expand sidebar"}
        title={open ? "Collapse" : "Expand"}
      >
        {/* When collapsed, hide the title to keep it slim */}
        <span className={open ? "block" : "sr-only"}>{title}</span>
        <Chevron open={open} />
      </button>

      {/* Body */}
      <div className="px-3 pb-3">
        {/* Hide children entirely when collapsed */}
        {open ? (
          <div className="space-y-2">{children}</div>
        ) : (
          // Optional: compact rail content could go here (icons-only)
          <div className="flex flex-col items-center gap-2">
            {/* Example: place small icon buttons if you have them */}
          </div>
        )}
      </div>
    </aside>
  );
}
