import { useEffect, useState } from "react";
import MenuPage from "../MenuPage/MenuPage";
import ManagementSettingsPage from "./ManagementSettingsPage";
import StationsPage from "../StationsPage/StationsPage";
import ListsPage from "../Service/Lists/ListsPage";
import DashboardPage from "./DashboardPage";
import type { DashboardTab } from "./DashboardPage";
import StaffPage from "./StaffPage";
import AnalyticsPage from "./AnalyticsPage";
import RevenueCentersPage from "./RevenueCentersPage";
import DevicesPage from "./DevicesPage";
import {
  AnalyticsIcon,
  DevicesIcon,
  ListsIcon,
  ManagementIcon,
  MenuIcon,
  RevenueCenterIcon,
  SettingsIcon,
  StaffIcon,
  StationsIcon,
} from "../../components/icons";
import { PageContainer, PageHeader } from "../../components/ui/layout";
import { PosActionButton, PosActionStrip } from "../../components/ui/pos";
import { cn } from "../../lib/utils";

const tabs = [
  { id: "dashboard", label: "Dashboard", icon: ManagementIcon },
  { id: "analytics", label: "Analytics", icon: AnalyticsIcon },
  { id: "menu", label: "Menu Builder", icon: MenuIcon },
  { id: "stations", label: "Stations", icon: StationsIcon },
  { id: "devices", label: "Devices", icon: DevicesIcon },
  { id: "revenue-centers", label: "Revenue Centers", icon: RevenueCenterIcon },
  { id: "lists", label: "Lists", icon: ListsIcon },
  { id: "staff", label: "Staff", icon: StaffIcon },
  { id: "settings", label: "Settings", icon: SettingsIcon },
] as const;

type ManagementTab = (typeof tabs)[number]["id"];

export default function ManagementPage({
  initialTab = "dashboard",
  initialDashboardTab = "alerts",
}: {
  initialTab?: ManagementTab;
  initialDashboardTab?: DashboardTab;
}) {
  const [activeTab, setActiveTab] = useState<ManagementTab>(initialTab);
  const [hasActiveShift, setHasActiveShift] = useState(false);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const handleStartShift = () => {
    setHasActiveShift(true);
  };

  const handleShiftStateChange = (nextHasActiveShift: boolean) => {
    setHasActiveShift(nextHasActiveShift);
  };

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        eyebrow="Management"
        title="Management"
        description="Operational controls, pricing, staffing, and shift oversight collected into one tablet workspace."
        actions={
          <div className="rs-pill">
            {hasActiveShift ? "Shift active" : "Shift not started"}
          </div>
        }
      />

      <PosActionStrip>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <PosActionButton
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                icon={Icon}
                active={active}
                label={tab.label}
                className={cn(active && "shadow-[var(--shadow-soft)]")}
              />
            );
          })}
      </PosActionStrip>

      <div className="space-y-6">
        {activeTab === "dashboard" && (
          <DashboardPage
            initialTab={initialDashboardTab}
            hasActiveShift={hasActiveShift}
            onStartShift={handleStartShift}
            onShiftStateChange={handleShiftStateChange}
          />
        )}

        {activeTab === "analytics" && <AnalyticsPage />}
        {activeTab === "menu" && <MenuPage />}
        {activeTab === "stations" && <StationsPage />}
        {activeTab === "devices" && <DevicesPage />}
        {activeTab === "revenue-centers" && <RevenueCentersPage />}
        {activeTab === "lists" && <ListsPage />}
        {activeTab === "staff" && <StaffPage />}
        {activeTab === "settings" && <ManagementSettingsPage />}
      </div>
    </PageContainer>
  );
}
