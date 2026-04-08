import React, { useState } from "react";
import type { Page } from "../types";
import Button from "./Button";
import { pageMeta, primaryNav } from "./appMeta";
import {
  QuickOrderIcon,
  SparklesIcon,
} from "./icons";
import { cn } from "../lib/utils";

export default function Sidebar({
  page,
  setPage,
  onQuickOrder,
}: {
  page: Page;
  setPage: (page: Page) => void;
  onQuickOrder: () => void;
}) {
  const [open, setOpen] = useState(true);

  const quickLinks = [
    {
      id: "quick-order",
      label: "Quick Order",
      description: "Start a fresh order.",
      action: () => {
        try {
          sessionStorage.removeItem("lastTableNum");
          sessionStorage.removeItem("lastTableId");
        } catch {
          // no-op
        }
        onQuickOrder();
      },
      icon: QuickOrderIcon,
    },
    {
      id: "service",
      label: "Live Service",
      description: "Open station tools.",
      action: () => setPage("service"),
      icon: pageMeta.service.icon,
    },
    {
      id: "management",
      label: "Management",
      description: "Open control tools.",
      action: () => setPage("management"),
      icon: pageMeta.management.icon,
    },
  ];

  return (
    <aside
      className={cn(
        "hidden h-full shrink-0 border-r border-white/8 bg-[var(--surface-rail)] text-white backdrop-blur-2xl",
        "transition-[width] duration-300 ease-out xl:flex xl:flex-col",
        open ? "w-[320px]" : "w-[92px]"
      )}
    >
      <div className="flex h-[92px] items-center justify-between gap-3 border-b border-white/8 px-4">
        <div className={cn("flex items-center gap-3 overflow-hidden", !open && "justify-center")}>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-label={open ? "Collapse sidebar" : "Expand sidebar"}
            title={open ? "Collapse sidebar" : "Expand sidebar"}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[1rem] bg-[var(--highlight)] text-[var(--accent-foreground)] transition hover:scale-[0.98] hover:opacity-90"
          >
            <SparklesIcon className="h-5 w-5" />
          </button>
          {open ? (
            <div className="min-w-0">
              <div className="font-display text-base font-semibold text-white">
                RestaurantSys
              </div>
              <div className="mt-1 text-[11px] uppercase tracking-[0.22em] text-white/45">
                Control tablet
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        <div className="space-y-2">
          {open ? (
            <div className="px-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/42">
              Navigation
            </div>
          ) : null}
          {primaryNav.map((item) => {
            const Icon = item.icon;
            const active = page === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setPage(item.key)}
                className={cn(
                  "group flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition",
                  active
                    ? "border-white/12 bg-white/10 text-[var(--highlight)]"
                    : "border-transparent bg-transparent text-white/72 hover:border-white/8 hover:bg-white/8 hover:text-white",
                  !open && "justify-center px-0"
                )}
              >
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
                    active ? "bg-white/18 text-[var(--highlight)]" : "bg-white/8 text-current"
                  )}
                >
                  <Icon className="h-4.5 w-4.5" />
                </div>
                {open ? (
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{item.label}</div>
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className={cn("rounded-[24px] border border-white/8 bg-white/6 p-3", !open && "px-2")}>
          {open ? (
            <div className="mb-3 px-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/42">
                Quick Actions
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            {quickLinks.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={item.action}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl border border-white/6 bg-white/10 px-3 py-3 text-left shadow-[var(--shadow-soft)] transition hover:-translate-y-px hover:border-white/10 hover:bg-white/14 hover:shadow-[var(--shadow-strong)]",
                    !open && "justify-center px-0"
                  )}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--highlight)] text-[var(--accent-foreground)]">
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  {open ? (
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white">
                        {item.label}
                      </div>
                      <div className="mt-1 text-xs text-white/50">
                        {item.description}
                      </div>
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="border-t border-white/8 p-3">
        <Button
          variant="ghost"
          className={cn("w-full justify-center border-white/8 text-white/72 hover:text-white", open && "justify-start")}
          onClick={() => setPage("settings")}
        >
          {open ? "Appearance & Preferences" : "Prefs"}
        </Button>
      </div>
    </aside>
  );
}
