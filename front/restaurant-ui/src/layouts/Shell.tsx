// File: src/layouts/Shell.tsx
import React from "react";
import TopBar from "../components/TopBar";
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
  onQuickOrder: _onQuickOrder,
}: Props) {
  return (
    <div className="min-h-screen bg-app p-3 text-[var(--foreground)] lg:p-5">
      <div className="rs-pos-shell mx-auto min-h-[calc(100vh-1.5rem)] max-w-[1880px] overflow-hidden">
        <div className="flex min-w-0 flex-1 flex-col bg-[var(--surface-main)]">
          <TopBar current={page} onNavigate={setPage} />
          <ScrollView>{children}</ScrollView>
        </div>
      </div>
    </div>
  );
}
