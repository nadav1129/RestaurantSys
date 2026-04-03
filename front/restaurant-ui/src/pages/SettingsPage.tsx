import Button from "../components/Button";
import { useTheme } from "../components/theme/ThemeProvider";
import {
  CheckCircleIcon,
  MoonIcon,
  PaletteIcon,
  QuickOrderIcon,
  SettingsIcon,
  SunIcon,
} from "../components/icons";
import {
  EmptyState,
  PageContainer,
  PageHeader,
  SectionCard,
  StatCard,
} from "../components/ui/layout";
import { cn } from "../lib/utils";

const themeOptions = [
  {
    id: "dark" as const,
    title: "Dark",
    description: "Low glare.",
    icon: MoonIcon,
  },
  {
    id: "light" as const,
    title: "Light",
    description: "Bright surfaces.",
    icon: SunIcon,
  },
];

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();

  return (
    <PageContainer className="space-y-6">
      <PageHeader eyebrow="Settings" title="Settings" />

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.9fr]">
        <SectionCard title="Theme">
          <div className="grid gap-4 md:grid-cols-2">
            {themeOptions.map((option) => {
              const Icon = option.icon;
              const active = theme === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setTheme(option.id)}
                  className={cn(
                    "rounded-[28px] border p-5 text-left transition",
                    active
                      ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)] shadow-[var(--shadow-strong)]"
                      : "border-[var(--border)] bg-[var(--card-muted)] text-[var(--foreground)] hover:border-[var(--border-strong)] hover:bg-[var(--muted)]"
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/55 text-current">
                      <Icon className="h-5 w-5" />
                    </div>
                    {active ? <CheckCircleIcon className="h-5 w-5" /> : null}
                  </div>
                  <div className="mt-5 font-display text-xl font-semibold">
                    {option.title}
                  </div>
                  <div
                    className={cn(
                      "mt-2 text-sm leading-6",
                      active ? "text-[var(--accent-foreground)]/80" : "text-[var(--muted-foreground)]"
                    )}
                  >
                    {option.description}
                  </div>
                </button>
              );
            })}
          </div>
        </SectionCard>

        <div className="space-y-6">
          <SectionCard title="Status">
            <div className="grid gap-3">
              <StatCard
                label="Active Theme"
                value={theme === "dark" ? "Dark mode" : "Light mode"}
                hint="Local"
              />
              <StatCard
                label="Quick Actions"
                value="Ready"
                hint="Enabled"
                tone="success"
              />
              <StatCard
                label="UI"
                value="In Progress"
                hint="Active pass"
                tone="warning"
              />
            </div>
          </SectionCard>

          <SectionCard title="Scope">
            <div className="space-y-3">
              <div className="rs-surface-muted flex items-start gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--accent)] text-[var(--accent-foreground)]">
                  <PaletteIcon className="h-4.5 w-4.5" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-[var(--foreground)]">
                    Theme
                  </div>
                </div>
              </div>
              <div className="rs-surface-muted flex items-start gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--accent)] text-[var(--accent-foreground)]">
                  <QuickOrderIcon className="h-4.5 w-4.5" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-[var(--foreground)]">
                    Quick Actions
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>

      <SectionCard
        title="Frontend"
        actions={
          <Button
            variant="secondary"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            Toggle Theme
          </Button>
        }
      >
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard label="Navigation" value="Unified" hint="Updated" />
          <StatCard label="Forms & Tables" value="Refined" hint="Updated" />
          <StatCard label="Management" value="Expanding" hint="Updated" />
        </div>
      </SectionCard>

      <EmptyState
        title="UI only"
        description="No backend changes."
        action={
          <div className="rs-pill">
            <SettingsIcon className="h-4 w-4" />
            Visual settings
          </div>
        }
      />
    </PageContainer>
  );
}
