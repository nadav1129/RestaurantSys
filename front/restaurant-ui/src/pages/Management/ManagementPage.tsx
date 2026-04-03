import { useState } from "react";
import MenuPage from "../MenuPage/MenuPage";
import ManagementSettingsPage from "./ManagementSettingsPage";
import StationsPage from "../StationsPage/StationsPage";
import ListsPage from "../Service/Lists/ListsPage";
import DashboardPage from "./DashboardPage";
import StaffPage from "./StaffPage";
import AnalyticsPage from "./AnalyticsPage";
import {
  AnalyticsIcon,
  ListsIcon,
  ManagementIcon,
  MenuIcon,
  SettingsIcon,
  StaffIcon,
  StationsIcon,
} from "../../components/icons";
import { PageContainer, PageHeader } from "../../components/ui/layout";
import { cn } from "../../lib/utils";

const tabs = [
  { id: "dashboard", label: "Dashboard", icon: ManagementIcon },
  { id: "analytics", label: "Analytics", icon: AnalyticsIcon },
  { id: "menu", label: "Menu Builder", icon: MenuIcon },
  { id: "stations", label: "Stations", icon: StationsIcon },
  { id: "lists", label: "Lists", icon: ListsIcon },
  { id: "staff", label: "Staff", icon: StaffIcon },
  { id: "settings", label: "Settings", icon: SettingsIcon },
] as const;

type ManagementTab = (typeof tabs)[number]["id"];

export default function ManagementPage() {
  const [activeTab, setActiveTab] = useState<ManagementTab>("dashboard");
  const [hasActiveShift, setHasActiveShift] = useState(false);

  const handleStartShift = () => {
    setHasActiveShift(true);
  };

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        eyebrow="Management"
        title="Operations Center"
        description="A calmer control surface for shift oversight, menu structure, staffing, and restaurant configuration."
        actions={
          <div className="rs-pill">
            {hasActiveShift ? "Shift active" : "Shift not started"}
          </div>
        }
      />

      <section className="rs-surface p-3">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium transition",
                  active
                    ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
                    : "border-[var(--border)] bg-[var(--card-muted)] text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
                )}
              >
                <Icon className="h-4.5 w-4.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </section>

      <div className="space-y-6">
        {activeTab === "dashboard" && (
          <DashboardPage
            hasActiveShift={hasActiveShift}
            onStartShift={handleStartShift}
          />
        )}

        {activeTab === "analytics" && <AnalyticsPage />}
        {activeTab === "menu" && <MenuPage />}
        {activeTab === "stations" && <StationsPage />}
        {activeTab === "lists" && <ListsPage />}
        {activeTab === "staff" && <StaffPage />}
        {activeTab === "settings" && <ManagementSettingsPage />}
      </div>
    </PageContainer>
  );
}
