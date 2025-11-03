import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export type QuickAction = {
  id: string;
  label: string;
  onClick: () => void;
};

type QuickActionsProps = {
  items: QuickAction[];
  openWidth?: number;
  collapsedWidth?: number;
  title?: string;
  defaultOpen?: boolean;
};

const ChevronIcon: React.FC<{
  direction: "left" | "right";
  className?: string;
}> = ({ direction, className }) => (
  <svg
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden
    className={className}
  >
    {direction === "left" ? (
      <path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
    ) : (
      <path d="M8.59 16.59 10 18l6-6-6-6-1.41 1.41L13.17 12z" />
    )}
  </svg>
);

export const QuickActions: React.FC<QuickActionsProps> = ({
  items,
  openWidth = 280,
  collapsedWidth = 48,
  title = "Quick actions",
  defaultOpen = false,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const widths = useMemo(
    () => ({ open: openWidth, closed: collapsedWidth }),
    [openWidth, collapsedWidth]
  );

  return (
    <div className="fixed left-0 top-0 h-screen z-40 select-none">
      <motion.aside
        role="complementary"
        aria-label="Quick actions panel"
        initial={false}
        animate={{ width: open ? widths.open : widths.closed }}
        transition={{ type: "spring", stiffness: 260, damping: 28 }}
        className="h-full bg-neutral-900/90 backdrop-blur-md text-neutral-100 shadow-2xl border-r border-neutral-800 overflow-hidden"
      >
        <div className="h-12 flex items-center justify-between px-3 border-b border-neutral-800">
          <div
            className="text-sm font-medium truncate pr-2"
            aria-hidden={!open}
          >
            {open ? title : ""}
          </div>
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label={
              open ? "Collapse quick actions" : "Expand quick actions"
            }
            className="group inline-flex items-center justify-center w-8 h-8 rounded-xl border border-neutral-700/60 bg-neutral-800/60 hover:bg-neutral-700/60"
          >
            {open ? (
              <ChevronIcon direction="left" className="w-4 h-4 fill-current" />
            ) : (
              <ChevronIcon direction="right" className="w-4 h-4 fill-current" />
            )}
          </button>
        </div>

        <div className="p-2">
          <ul className="space-y-1">
            {items.map((it) => (
              <li key={it.id}>
                <button
                  onClick={it.onClick}
                  className="w-full text-left text-sm px-3 py-2 rounded-xl hover:bg-neutral-800/70 border border-transparent hover:border-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  {it.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </motion.aside>

      <AnimatePresence>
        {!open && (
          <motion.button
            key="gutter"
            onClick={() => setOpen(true)}
            aria-label="Open quick actions"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute left-0 top-12 -translate-x-1/2 w-6 h-24 rounded-r-xl bg-neutral-900/70 border border-neutral-800 flex items-center justify-center"
          >
            <ChevronIcon direction="right" className="w-4 h-4 fill-current" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};

export default QuickActions;
