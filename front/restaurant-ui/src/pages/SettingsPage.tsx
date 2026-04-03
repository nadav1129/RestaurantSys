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
    description: "Calm contrast and lower glare for long service sessions.",
    icon: MoonIcon,
  },
  {
    id: "light" as const,
    title: "Light",
    description: "Bright, balanced surfaces with softer daylight-friendly tones.",
    icon: SunIcon,
  },
];

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        eyebrow="Settings"
        title="Workspace Preferences"
        description="Appearance lives here now, so teams can switch between balanced light and dark surfaces without interrupting service workflows."
      />

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.9fr]">
        <SectionCard
          title="Theme"
          description="The whole interface updates instantly and stays consistent across pages."
        >
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
          <SectionCard
            title="Workspace Snapshot"
            description="These settings are frontend-only and do not affect backend flows."
          >
            <div className="grid gap-3">
              <StatCard
                label="Active Theme"
                value={theme === "dark" ? "Dark mode" : "Light mode"}
                hint="Stored locally for this workspace."
              />
              <StatCard
                label="Quick Actions"
                value="Ready"
                hint="Fast access panel stays available from every major page."
                tone="success"
              />
              <StatCard
                label="UI Consistency"
                value="In Progress"
                hint="The new surface system is being applied across the full app."
                tone="warning"
              />
            </div>
          </SectionCard>

          <SectionCard
            title="What’s Here"
            description="A small overview of the redesign scope already covered by settings."
          >
            <div className="space-y-3">
              <div className="rs-surface-muted flex items-start gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--accent)] text-[var(--accent-foreground)]">
                  <PaletteIcon className="h-4.5 w-4.5" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-[var(--foreground)]">
                    Global appearance
                  </div>
                  <div className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">
                    Theme tokens are applied app-wide so surfaces, cards, forms, and tables stay visually aligned.
                  </div>
                </div>
              </div>
              <div className="rs-surface-muted flex items-start gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--accent)] text-[var(--accent-foreground)]">
                  <QuickOrderIcon className="h-4.5 w-4.5" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-[var(--foreground)]">
                    Shift-friendly access
                  </div>
                  <div className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">
                    Quick actions and navigation stay reachable without changing business logic or API behavior.
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>

      <SectionCard
        title="Next Frontend Layers"
        description="These notes are UI-facing only, so they remain safe while the backend stays untouched."
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
          <StatCard
            label="Navigation"
            value="Unified"
            hint="Shared shell, quick actions, and page headers are being standardized."
          />
          <StatCard
            label="Forms & Tables"
            value="Refined"
            hint="Inputs, list layouts, and action hierarchy now use softer surfaces."
          />
          <StatCard
            label="Management"
            value="Expanding"
            hint="Dashboard, analytics, and menu builder are next in the redesign pass."
          />
        </div>
      </SectionCard>

      <EmptyState
        title="Backend settings stay untouched"
        description="Theme changes are purely presentational. Existing services, handlers, validations, and API contracts remain unchanged."
        action={
          <div className="rs-pill">
            <SettingsIcon className="h-4 w-4" />
            Safe frontend-only configuration
          </div>
        }
      />
    </PageContainer>
  );
}
