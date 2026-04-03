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
    description: "Shift start and staff access.",
    icon: HomeIcon,
  },
  assistant: {
    title: "AI Assistant",
    description: "Chat with the assistant.",
    icon: SparklesIcon,
  },
  service: {
    title: "Service Stations",
    description: "Station tools.",
    icon: ServiceIcon,
  },
  actions: {
    title: "Quick Actions",
    description: "Task tools.",
    icon: QuickOrderIcon,
  },
  login: {
    title: "Staff Access",
    description: "Login setup.",
    icon: QuickOrderIcon,
  },
  management: {
    title: "Management",
    description: "Menus, staff, stations.",
    icon: ManagementIcon,
  },
  settings: {
    title: "Settings",
    description: "App settings.",
    icon: SettingsIcon,
  },
  order: {
    title: "Live Order",
    description: "Current order.",
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
