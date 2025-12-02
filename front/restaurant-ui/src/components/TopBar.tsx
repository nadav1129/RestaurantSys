import React, { useState } from "react";
import Button from "./Button";
import type { Page } from "../types";
import UserLoginPanel from "../pages/Users/UserLoginPanel";

type Props = { current: Page; onNavigate: (p: Page) => void };

export default function TopBar({ current, onNavigate }: Props) {
  const [showUserPanel, setShowUserPanel] = useState(false);

  const tabs: { key: Page; label: string }[] = [
    { key: "home", label: "Home" },
    { key: "service", label: "Map" },
    { key: "management", label: "Management" },
    { key: "settings", label: "Settings" },
  ];

  return (
    <>
      <header className="sticky top-0 z-30 w-full border-b border-gray-200 bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          {/* Left: logo + title */}
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-indigo-600" />
            <h1 className="text-lg font-semibold">RestaurantSys</h1>
          </div>

          {/* Middle: tabs */}
          <nav className="flex items-center gap-1 rounded-2xl bg-gray-100 p-1">
            {tabs.map((t) => (
              <button
                key={t.key}
                className={`rounded-xl px-3 py-1.5 text-sm font-medium transition ${
                  current === t.key
                    ? "bg-white shadow text-gray-900"
                    : "text-gray-600 hover:text-gray-900"
                }`}
                onClick={() => onNavigate(t.key)}
              >
                {t.label}
              </button>
            ))}
          </nav>

          {/* Right: user + help round buttons */}
          <div className="flex items-center gap-2">
            {/* User button */}
            <button
              type="button"
              onClick={() => setShowUserPanel(true)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-300 bg-white text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
            >
              <span className="text-base">U</span>
            </button>

            {/* Help button (round with ?) */}
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-300 bg-white text-base font-bold text-gray-700 shadow-sm hover:bg-gray-50"
            >
              ?
            </button>
          </div>
        </div>
      </header>

      {/* User login panel popup */}
      {showUserPanel && (
        <UserLoginPanel
          onLoginSuccess={(resp) => {
            // TODO: store token if needed (context/localStorage)
            // resp.token, resp.user
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
