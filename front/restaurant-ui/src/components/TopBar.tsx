import React, { useState } from "react";
import type { Page } from "../types";
import UserLoginPanel from "../pages/Users/UserLoginPanel";
import { pageMeta, primaryNav } from "./appMeta";
import { HelpIcon, SettingsIcon } from "./icons";
import { cn } from "../lib/utils";

type Props = { current: Page; onNavigate: (p: Page) => void };

export default function TopBar({ current, onNavigate }: Props) {
  const [showUserPanel, setShowUserPanel] = useState(false);
  const meta = pageMeta[current];
  const dateLabel = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date());
  const timeLabel = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());

  return (
    <>
      <header className="sticky top-0 z-30">
        <div className="rs-pos-topbar px-4 pb-4 pt-3 lg:px-6">
          <div className="relative flex items-start justify-between gap-4">
            <div className="min-w-[96px] text-left leading-tight text-white/82">
              <div className="text-sm font-light">{timeLabel}</div>
              <div className="mt-1 text-[11px] uppercase tracking-[0.24em] text-white/52">
                {dateLabel}
              </div>
            </div>

            <div className="pointer-events-none absolute left-1/2 top-1 min-w-0 -translate-x-1/2 px-2 text-center">
              <div className="truncate text-lg font-medium tracking-[0.04em] text-white">
                {meta.title}
              </div>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--highlight)] transition hover:bg-white/10 hover:text-white"
                aria-label="AI Assistant"
                onClick={() => onNavigate("assistant")}
              >
                <HelpIcon className="h-4.5 w-4.5" />
              </button>
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-xl text-white/76 transition hover:bg-white/10 hover:text-white"
                aria-label="Settings"
                onClick={() => onNavigate("settings")}
              >
                <SettingsIcon className="h-4.5 w-4.5" />
              </button>
              <button
                type="button"
                onClick={() => setShowUserPanel(true)}
                className="rounded-xl border border-white/12 bg-white/8 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/14"
              >
                Staff Access
              </button>
            </div>
          </div>

          <nav className="rs-pos-topbar-tabs mt-4">
            {primaryNav.map((t) => (
              <button
                key={t.key}
                className={cn(
                  "rs-pos-topbar-tab",
                  current === t.key
                    ? "rs-pos-topbar-tab-active"
                    : ""
                )}
                onClick={() => onNavigate(t.key)}
              >
                <t.icon className="h-5.5 w-5.5" />
                <span className="text-xs font-medium tracking-[0.06em] md:text-sm">
                  {t.label}
                </span>
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
