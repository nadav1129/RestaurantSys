import { useState } from "react";
import Shell from "./layouts/Shell";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import ActionsPage from "./pages/Temp/ActionsPage";
import EmptyPage from "./pages/EmptyPage";
import OrderPage from "./pages/OrderPage/OrderPage";
import LandingPage from "./pages/LandingPage";
import ChatAssistantPage from "./pages/Service/ChatAssistantPage";
import ServicePage from "./pages/Service/ServicePage";
import ManagementPage from "./pages/Management/ManagementPage";
import SettingsPage from "./pages/SettingsPage";
import type { Page } from "./types";

export default function App() {
  const [hasEnteredApp, setHasEnteredApp] = useState(false);
  const [page, setPage] = useState<Page>("home");
  const [activeStationId, setActiveStationId] = useState<string | undefined>(
    undefined
  );
  const [currentTable, setCurrentTable] = useState<string>("none");

  const openOrderForTable = (tableId: string) => {
    setCurrentTable(tableId);
    setPage("order");
  };

  const renderPage = () => {
    switch (page) {
      case "home":
        return <HomePage />;
      case "assistant":
        return <ChatAssistantPage />;
      case "login":
        return <LoginPage onBackToUserLogin={() => setPage("home")} />;
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
        return (
          <OrderPage
            initialTableId={currentTable !== "none" ? currentTable : null}
            originStationId={activeStationId ?? null}
          />
        );
      case "settings":
        return <SettingsPage />;
      case "management":
        return <ManagementPage />;
      default:
        return <EmptyPage />;
    }
  };

  if (!hasEnteredApp) {
    return <LandingPage onContinue={() => setHasEnteredApp(true)} />;
  }

  return (
    <Shell
      page={page}
      setPage={setPage}
      onQuickOrder={() => {
        setCurrentTable("none");
        setPage("order");
      }}
    >
      {renderPage()}
    </Shell>
  );
}
