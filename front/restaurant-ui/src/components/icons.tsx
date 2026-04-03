import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function BaseIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    />
  );
}

export function HomeIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 9.5V20h13V9.5" />
      <path d="M9.5 20v-6h5v6" />
    </BaseIcon>
  );
}

export function ServiceIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M4 6.5h7v5H4z" />
      <path d="M13 6.5h7v5h-7z" />
      <path d="M4 13h7v5H4z" />
      <path d="M13 13h7v5h-7z" />
    </BaseIcon>
  );
}

export function ManagementIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect x="3.5" y="4" width="17" height="16" rx="2.5" />
      <path d="M8 20V9" />
      <path d="M12 20v-6" />
      <path d="M16 20V7" />
    </BaseIcon>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M12 8.75A3.25 3.25 0 1 0 12 15.25A3.25 3.25 0 1 0 12 8.75z" />
      <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a2 2 0 1 1-4 0v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a2 2 0 1 1 0-4h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V4a2 2 0 1 1 4 0v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6h.2a2 2 0 1 1 0 4h-.2a1 1 0 0 0-.9.6z" />
    </BaseIcon>
  );
}

export function QuickOrderIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M4 6.5h16" />
      <path d="M7 6.5v-2" />
      <path d="M17 6.5v-2" />
      <rect x="4" y="6.5" width="16" height="13.5" rx="2.5" />
      <path d="M8 11h8" />
      <path d="M8 15h5" />
    </BaseIcon>
  );
}

export function AnalyticsIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M4 19.5h16" />
      <path d="M7 17V9" />
      <path d="M12 17V5.5" />
      <path d="M17 17v-6" />
    </BaseIcon>
  );
}

export function SunIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2.2" />
      <path d="M12 19.3v2.2" />
      <path d="m4.9 4.9 1.6 1.6" />
      <path d="m17.5 17.5 1.6 1.6" />
      <path d="M2.5 12h2.2" />
      <path d="M19.3 12h2.2" />
      <path d="m4.9 19.1 1.6-1.6" />
      <path d="m17.5 6.5 1.6-1.6" />
    </BaseIcon>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M20 15.6A8.5 8.5 0 1 1 8.4 4 7 7 0 0 0 20 15.6Z" />
    </BaseIcon>
  );
}

export function BellIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M6.5 9a5.5 5.5 0 1 1 11 0c0 6 2.5 7 2.5 7h-16s2.5-1 2.5-7" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </BaseIcon>
  );
}

export function HelpIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.4 9.3a2.8 2.8 0 1 1 4.8 2c-.8.7-1.4 1.2-1.4 2.5" />
      <path d="M12 16.8h.01" />
    </BaseIcon>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.2-4.2" />
    </BaseIcon>
  );
}

export function TableIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M4 7h16" />
      <path d="M7 7v12" />
      <path d="M17 7v12" />
      <path d="M6 13h12" />
    </BaseIcon>
  );
}

export function OrdersIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M7 5.5h10" />
      <path d="M7 9.5h10" />
      <path d="M7 13.5h6" />
      <rect x="4" y="3.5" width="16" height="17" rx="2.5" />
    </BaseIcon>
  );
}

export function StaffIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M16 18.5a4 4 0 0 0-8 0" />
      <circle cx="12" cy="8.5" r="3" />
      <path d="M18.5 18.5a3 3 0 0 0-2.2-2.9" />
      <path d="M7.7 15.6A3 3 0 0 0 5.5 18.5" />
    </BaseIcon>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M5 7h14" />
      <path d="M5 12h14" />
      <path d="M5 17h10" />
    </BaseIcon>
  );
}

export function StationsIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M5 7h14" />
      <path d="M8 7v10" />
      <path d="M16 7v10" />
      <path d="M5 17h14" />
    </BaseIcon>
  );
}

export function ListsIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M9 7h10" />
      <path d="M9 12h10" />
      <path d="M9 17h10" />
      <path d="M5 7h.01" />
      <path d="M5 12h.01" />
      <path d="M5 17h.01" />
    </BaseIcon>
  );
}

export function PaletteIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M12 4a8 8 0 1 0 0 16h1.3a2.2 2.2 0 0 0 0-4.4H12a2 2 0 0 1 0-4h4.5A3.5 3.5 0 0 0 20 8.1 8 8 0 0 0 12 4Z" />
      <path d="M7.5 11h.01" />
      <path d="M8.5 8h.01" />
      <path d="M11.5 7h.01" />
    </BaseIcon>
  );
}

export function SparklesIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="m12 3 1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1L6.5 8.5l4.1-1.4Z" />
      <path d="m18.5 14 1 2.8 2.8 1-2.8 1-1 2.8-1-2.8-2.8-1 2.8-1Z" />
      <path d="m4.5 13 1 2.6 2.5 1-2.5 1-1 2.6-1-2.6-2.5-1 2.5-1Z" />
    </BaseIcon>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v5l3 2" />
    </BaseIcon>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="m14.5 6-6 6 6 6" />
    </BaseIcon>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="m9.5 6 6 6-6 6" />
    </BaseIcon>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </BaseIcon>
  );
}

export function FolderTreeIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M6 5.5h5v4H6z" />
      <path d="M13 14.5h5v4h-5z" />
      <path d="M13 5.5h5v4h-5z" />
      <path d="M11 7.5h2" />
      <path d="M11 7.5v9h2" />
    </BaseIcon>
  );
}

export function GripIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M9 7h.01" />
      <path d="M15 7h.01" />
      <path d="M9 12h.01" />
      <path d="M15 12h.01" />
      <path d="M9 17h.01" />
      <path d="M15 17h.01" />
    </BaseIcon>
  );
}

export function ReceiptIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M6 4.5h12v15l-2.5-1.5-2.5 1.5-2.5-1.5-2.5 1.5Z" />
      <path d="M9 8.5h6" />
      <path d="M9 12h6" />
      <path d="M9 15.5h4" />
    </BaseIcon>
  );
}

export function CheckCircleIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.2 2.2 2.3 4.8-5.1" />
    </BaseIcon>
  );
}

export function AlertTriangleIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M10.3 4.8 2.8 18a1 1 0 0 0 .9 1.5h16.6a1 1 0 0 0 .9-1.5L13.7 4.8a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4" />
      <path d="M12 16.5h.01" />
    </BaseIcon>
  );
}

export function XIcon(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="m6 6 12 12" />
      <path d="M18 6 6 18" />
    </BaseIcon>
  );
}
