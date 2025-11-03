// File: src/layouts/Shell.tsx
import React from "react";
import TopBar from "../components/TopBar";
import Sidebar from "../components/Sidebar";
import ScrollView from "../components/ScrollView";
import Button from "../components/Button";
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
    <div className="flex h-screen w-full flex-col">
      <TopBar current={page} onNavigate={setPage} />
      <div className="flex flex-1">
        <Sidebar title="Quick Actions" defaultOpen>
          <Button className="w-full" onClick={onQuickOrder}>
            Quick Order
          </Button>
          {/* add more buttons / links as needed */}
        </Sidebar>

        <ScrollView>{children}</ScrollView>
      </div>
    </div>
  );
}
