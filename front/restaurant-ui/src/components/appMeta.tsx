import type { ComponentType, SVGProps } from "react";
import type { Page } from "../types";
import {
  AnalyticsIcon,
  HomeIcon,
  ManagementIcon,
  QuickOrderIcon,
  ServiceIcon,
  SettingsIcon,
  SparklesIcon,
} from "./icons";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

export const pageMeta: Record<
  Page,
  {
    title: string;
    description: string;
    icon: IconComponent;
  }
> = {
  home: {
    title: "Shift Hub",
    description: "Device setup, staff shift control, and the nightly brief in one place.",
    icon: HomeIcon,
  },
  assistant: {
    title: "AI Assistant",
    description: "A dedicated assistant workspace for service guidance, drafting, and operational support.",
    icon: SparklesIcon,
  },
  service: {
    title: "Service Stations",
    description: "Move between active stations and keep guest-facing workflows fast and clear.",
    icon: ServiceIcon,
  },
  actions: {
    title: "Quick Actions",
    description: "Rapid task workflows and temporary shift tools.",
    icon: QuickOrderIcon,
  },
  login: {
    title: "Staff Access",
    description: "Claim a staff code and set up secure personal access.",
    icon: QuickOrderIcon,
  },
  management: {
    title: "Management",
    description: "Operations, menu structure, staffing, and performance controls.",
    icon: ManagementIcon,
  },
  settings: {
    title: "Settings",
    description: "Appearance, workspace preferences, and operational defaults.",
    icon: SettingsIcon,
  },
  order: {
    title: "Live Order",
    description: "Create, confirm, and close orders without losing the table context.",
    icon: AnalyticsIcon,
  },
};

export const primaryNav: Array<{
  key: Page;
  label: string;
  icon: IconComponent;
}> = [
  { key: "home", label: "Home", icon: HomeIcon },
  { key: "service", label: "Service", icon: ServiceIcon },
  { key: "assistant", label: "AI", icon: SparklesIcon },
  { key: "management", label: "Management", icon: ManagementIcon },
  { key: "settings", label: "Settings", icon: SettingsIcon },
];
