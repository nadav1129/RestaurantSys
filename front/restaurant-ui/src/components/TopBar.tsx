import React, { useState } from "react";
import type { Page } from "../types";
import UserLoginPanel from "../pages/Users/UserLoginPanel";
import { pageMeta, primaryNav } from "./appMeta";
import { BellIcon, HelpIcon } from "./icons";
import { cn } from "../lib/utils";

type Props = { current: Page; onNavigate: (p: Page) => void };

export default function TopBar({ current, onNavigate }: Props) {
  const [showUserPanel, setShowUserPanel] = useState(false);
  const meta = pageMeta[current];
  const dateLabel = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date());
  const PageIcon = meta.icon;

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--card)]/80 backdrop-blur-2xl">
        <div className="flex flex-col gap-4 px-4 lg:px-6">
          <div className="flex h-[80px] items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent)] text-[var(--accent-foreground)]">
                <PageIcon className="h-5 w-5" />
              </div>
              <div className="truncate font-display text-base font-semibold text-[var(--foreground)]">
                {meta.title}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden rounded-full border border-[var(--border)] bg-[var(--card-muted)] px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] md:flex">
                {dateLabel}
              </div>
              <button
                type="button"
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--card-muted)] text-[var(--muted-foreground)] transition hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
                aria-label="Notifications"
              >
                <BellIcon className="h-4.5 w-4.5" />
              </button>
              <button
                type="button"
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--card-muted)] text-[var(--muted-foreground)] transition hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
                aria-label="Help"
              >
                <HelpIcon className="h-4.5 w-4.5" />
              </button>
              <button
                type="button"
                onClick={() => setShowUserPanel(true)}
                className="flex min-w-[116px] items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--card-muted)] px-4 py-3 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--muted)]"
              >
                Staff Access
              </button>
            </div>
          </div>

          <nav className="flex items-center gap-2 overflow-x-auto pb-4 xl:hidden">
            {primaryNav.map((t) => (
              <button
                key={t.key}
                className={cn(
                  "whitespace-nowrap rounded-full border px-3 py-2 text-sm font-medium transition",
                  current === t.key
                    ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
                    : "border-[var(--border)] bg-[var(--card-muted)] text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
                )}
                onClick={() => onNavigate(t.key)}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {showUserPanel && (
        <UserLoginPanel
          onLoginSuccess={() => {
            setShowUserPanel(false);
          }}
          onClose={() => setShowUserPanel(false)}
          onCreateNewUser={() => {
            setShowUserPanel(false);
            onNavigate("login"); // opens LoginPage from App.tsx
          }}
        />
      )}
    </>
  );
}
