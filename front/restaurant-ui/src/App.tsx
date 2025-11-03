import React, { useState } from "react";
import Shell from "./layouts/Shell";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import ActionsPage from "./pages/ActionsPage";
import EmptyPage from "./pages/EmptyPage";
import OrderPage from "./pages/OrderPage";
import ServicePage from "./pages/ServicePage";
import ManagementPage from "./pages/ManagementPage";
import type { Page } from "./types";

export default function App() {
  const [page, setPage] = useState<Page>("home");

  // station selection lives only in ServicePage
  const [activeStationId, setActiveStationId] = useState<string | undefined>(undefined);

  // when a station page asks to open a specific table’s order
  const [currentTable, setCurrentTable] = useState<string>("none");
  const openOrderForTable = (tableId: string) => {
    setCurrentTable(tableId);
    setPage("order");
  };

  const stations = [
    { id: "bar",       name: "Bar" },
    { id: "floor",     name: "Floor" },
    { id: "hostess",   name: "Hostess" },
    { id: "checker",   name: "Checker" },
    { id: "inventory", name: "Inventory" },
  ];

  const renderPage = () => {
    switch (page) {
      case "home":
        return <HomePage />;
      case "login":
        return <LoginPage />;
      case "actions":
        return <ActionsPage />;
      case "service":
        return (
          <ServicePage
            stations={stations}
            activeStationId={activeStationId}
            onStationChange={setActiveStationId}
            onOpenOrderForTable={openOrderForTable}
          />
        );
      case "order":
        // If you want OrderPage to receive the chosen table, add a prop there and pass it:
        // return <OrderPage table={currentTable} />;
        return <OrderPage />;
      case "settings":
        // You don’t have SettingsPage yet; using EmptyPage as a placeholder
        return <EmptyPage />;
        case "management":
        // 
        return <ManagementPage />;
      default:
        return <EmptyPage />;
    }
  };

  return (
    <Shell
      page={page}
      setPage={setPage}
      onQuickOrder={() => setPage("order")}
    >
      {renderPage()}
    </Shell>
  );
}
