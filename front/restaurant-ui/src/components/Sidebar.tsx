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
        "hidden h-full shrink-0 border-r border-[var(--border)] bg-[var(--card)]/85 backdrop-blur-2xl",
        "transition-[width] duration-300 ease-out xl:flex xl:flex-col",
        open ? "w-[320px]" : "w-[92px]"
      )}
    >
      <div className="flex h-[80px] items-center justify-between gap-3 border-b border-[var(--border)] px-4">
        <div className={cn("flex items-center gap-3 overflow-hidden", !open && "justify-center")}>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-label={open ? "Collapse sidebar" : "Expand sidebar"}
            title={open ? "Collapse sidebar" : "Expand sidebar"}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent)] text-[var(--accent-foreground)] transition hover:scale-[0.98] hover:opacity-90"
          >
            <SparklesIcon className="h-5 w-5" />
          </button>
          {open ? (
            <div className="min-w-0">
              <div className="font-display text-base font-semibold text-[var(--foreground)]">
                RestaurantSys
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        <div className="space-y-2">
          {open ? (
            <div className="px-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
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
                    ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
                    : "border-transparent bg-transparent text-[var(--muted-foreground)] hover:border-[var(--border)] hover:bg-[var(--card-muted)] hover:text-[var(--foreground)]",
                  !open && "justify-center px-0"
                )}
              >
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
                    active ? "bg-white/55 text-[var(--accent-foreground)]" : "bg-[var(--card-muted)]"
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

        <div className={cn("rounded-[28px] border border-[var(--border)] bg-[var(--card-muted)] p-3", !open && "px-2")}>
          {open ? (
            <div className="mb-3 px-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
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
                    "flex w-full items-center gap-3 rounded-2xl border border-transparent bg-[var(--card)] px-3 py-3 text-left shadow-[var(--shadow-soft)] transition hover:-translate-y-px hover:border-[var(--border)] hover:shadow-[var(--shadow-strong)]",
                    !open && "justify-center px-0"
                  )}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent)] text-[var(--accent-foreground)]">
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  {open ? (
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[var(--foreground)]">
                        {item.label}
                      </div>
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="border-t border-[var(--border)] p-3">
        <Button
          variant="ghost"
          className={cn("w-full justify-center", open && "justify-start")}
          onClick={() => setPage("settings")}
        >
          {open ? "Appearance & Preferences" : "Prefs"}
        </Button>
      </div>
    </aside>
  );
}
