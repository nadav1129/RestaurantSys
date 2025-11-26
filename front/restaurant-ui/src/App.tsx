import React, { useState } from "react";
import Shell from "./layouts/Shell";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import ActionsPage from "./pages/Temp/ActionsPage";
import EmptyPage from "./pages/EmptyPage";
import OrderPage from "./pages/OrderPage/OrderPage";
import ServicePage from "./pages/Service/ServicePage";
import ManagementPage from "./pages/Management/ManagementPage";
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
