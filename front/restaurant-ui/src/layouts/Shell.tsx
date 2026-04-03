// File: src/layouts/Shell.tsx
import React from "react";
import TopBar from "../components/TopBar";
import Sidebar from "../components/Sidebar";
import ScrollView from "../components/ScrollView";
import type { Page } from "../types";

type Props = {
  page: Page;
  setPage: (p: Page) => void;
  children: React.ReactNode;
  onQuickOrder: () => void;
};

export default function Shell({
  page,
  setPage,
  children,
  onQuickOrder,
}: Props) {
  return (
    <div className="flex h-full w-full bg-app text-[var(--foreground)]">
      <Sidebar page={page} setPage={setPage} onQuickOrder={onQuickOrder} />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar current={page} onNavigate={setPage} />
        <ScrollView>{children}</ScrollView>
      </div>
    </div>
  );
}
