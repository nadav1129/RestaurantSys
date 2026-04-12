import { useEffect, useState } from "react";
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
import OrdersPage from "./pages/OrdersPage";
import SettingsPage from "./pages/SettingsPage";
import {
  loadStoredDeviceConfig,
  saveStoredDeviceConfig,
  type StoredDeviceConfig,
} from "./lib/deviceConfig";
import type { ManagedDevice, Page } from "./types";

export default function App() {
  const [deviceConfig, setDeviceConfig] = useState<StoredDeviceConfig | null>(
    () => loadStoredDeviceConfig()
  );
  const [hasEnteredApp, setHasEnteredApp] = useState(
    () => loadStoredDeviceConfig() !== null
  );
  const [page, setPage] = useState<Page>("home");
  const [activeStationId, setActiveStationId] = useState<string | undefined>(
    deviceConfig?.stationId ?? undefined
  );
  const [currentTable, setCurrentTable] = useState<string>("none");

  useEffect(() => {
    setActiveStationId(deviceConfig?.stationId ?? undefined);
  }, [deviceConfig?.stationId]);

  const openOrderForTable = (tableId: string) => {
    setCurrentTable(tableId);
    setPage("order");
  };

  const renderPage = () => {
    switch (page) {
      case "home":
        return <HomePage configuredDevice={deviceConfig} />;
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
            autoSelectFirstStation={!deviceConfig}
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
      case "orders":
        return <OrdersPage />;
      default:
        return <EmptyPage />;
    }
  };

  const handleDeviceConfigured = (device: ManagedDevice) => {
    const next = saveStoredDeviceConfig(device);
    setDeviceConfig(next);
    setHasEnteredApp(true);
  };

  if (!hasEnteredApp) {
    return (
      <LandingPage
        onConfigured={handleDeviceConfigured}
        onSkip={() => setHasEnteredApp(true)}
      />
    );
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
