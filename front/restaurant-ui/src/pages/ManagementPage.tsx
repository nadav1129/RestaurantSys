import React, { useState } from "react";
import MenuPage from "./MenuPage/MenuPage";
import SpeedPage from "./SpeedPage";
import ManagementSettingsPage from "./ManagementSettingsPage";
import StationsPage from "./StationsPage/StationsPage";
import ListsPage from "./ListsPage";

export default function ManagementPage() {
  /* which sub-view is active? "menu" | "speed" */
  const [activeTab, setActiveTab] = useState<
    "menu" | "speed" | "stations" | "lists" | "settings"
  >("menu");

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="text-sm font-medium text-gray-500">Management</div>
          <div className="text-2xl font-semibold tracking-tight text-gray-900">
            Control Panel
          </div>
          <div className="mt-1 text-sm text-gray-500">
            Configure menu, bottles, and defaults.
          </div>
        </div>

        {/* Tabs / actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("menu")}
            className={[
              "rounded-xl border px-3 py-2 text-sm font-medium",
              activeTab === "menu"
                ? "border-gray-900 bg-gray-900 text-white"
                : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
            ].join(" ")}
          >
            Menu Builder
          </button>

          <button
            onClick={() => setActiveTab("speed")}
            className={[
              "rounded-xl border px-3 py-2 text-sm font-medium",
              activeTab === "speed"
                ? "border-gray-900 bg-gray-900 text-white"
                : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
            ].join(" ")}
          >
            Speed Rail
          </button>

          <button
            onClick={() => setActiveTab("stations")}
            className={[
              "rounded-xl border px-3 py-2 text-sm font-medium",
              activeTab === "settings"
                ? "border-gray-900 bg-gray-900 text-white"
                : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
            ].join(" ")}
          >
            Stations
          </button>

           <button
            onClick={() => setActiveTab("lists")}
            className={[
              "rounded-xl border px-3 py-2 text-sm font-medium",
              activeTab === "settings"
                ? "border-gray-900 bg-gray-900 text-white"
                : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
            ].join(" ")}
          >
            Lists
          </button>

          <button
            onClick={() => setActiveTab("settings")}
            className={[
              "rounded-xl border px-3 py-2 text-sm font-medium",
              activeTab === "settings"
                ? "border-gray-900 bg-gray-900 text-white"
                : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
            ].join(" ")}
          >
            Settings
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
        {activeTab === "menu" && (
          <div className="rounded-xl border border-gray-200 bg-gray-100">
            <MenuPage />
          </div>
        )}

        {activeTab === "speed" && (
          <div className="rounded-xl border border-gray-200 bg-white">
            <SpeedPage />
          </div>
        )}

        {activeTab === "stations" && (
          <div className="rounded-xl border border-gray-200 bg-white">
            <StationsPage />
          </div>
        )}

        {activeTab === "lists" && (
          <div className="rounded-xl border border-gray-200 bg-white">
            <ListsPage />
          </div>
        )}

        {activeTab === "settings" && (
          <div className="rounded-xl border border-gray-200 bg-white">
            <ManagementSettingsPage />
          </div>
        )}
      </div>
    </div>
  );
}
