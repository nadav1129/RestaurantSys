import Button from "../../components/Button";
import {
  CheckCircleIcon,
  ClockIcon,
  HelpIcon,
  SearchIcon,
  SparklesIcon,
} from "../../components/icons";
import {
  PageContainer,
  PageHeader,
  Pill,
  SectionCard,
  StatCard,
} from "../../components/ui/layout";

const suggestedPrompts = [
  "Summarize open floor pressure for the next 20 minutes.",
  "Draft a hostess response for a delayed reservation.",
  "Recommend the fastest route for clearing bar ticket backlog.",
  "Prepare a handoff note for the next shift lead.",
];

const transcript = [
  {
    role: "assistant",
    title: "Shift Assistant",
    body:
      "I can help with service pacing, guest messaging, table prioritization, and shift handoff notes once the live integrations are connected.",
  },
  {
    role: "user",
    title: "You",
    body: "What should I focus on first during a heavy service window?",
  },
  {
    role: "assistant",
    title: "Shift Assistant",
    body:
      "Start with bottlenecks that affect guest perception fastest: delayed greeting, stalled drinks, and tables waiting on payment. This screen is decorative for now, so no live actions are triggered yet.",
  },
];

export default function ChatAssistantPage() {
  return (
    <PageContainer className="space-y-6">
      <PageHeader
        eyebrow="Service Assistant"
        title="Agent Chat Workspace"
        description="Decorative service-side assistant surface for quick guidance, drafting, and operational prompts. This version has no backend logic yet."
        actions={
          <>
            <Pill>
              <SparklesIcon className="h-4 w-4" />
              Assistant preview
            </Pill>
            <Pill>
              <ClockIcon className="h-4 w-4" />
              No live execution
            </Pill>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Mode"
          value="Decor Only"
          hint="The visual shell is ready before wiring in chat actions."
        />
        <StatCard
          label="Best For"
          value="Service Ops"
          hint="Guest comms, pacing suggestions, and handoff drafting."
          tone="success"
        />
        <StatCard
          label="Safety"
          value="No logic"
          hint="No API calls, no writes, and no automation are triggered here."
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_340px]">
        <SectionCard
          title="Conversation"
          description="A staged transcript showing how the assistant area can look inside service."
          contentClassName="space-y-4"
        >
          <div className="space-y-3">
            {transcript.map((entry, index) => {
              const assistant = entry.role === "assistant";
              return (
                <div
                  key={`${entry.role}-${index}`}
                  className={[
                    "max-w-[88%] rounded-[24px] border px-4 py-4 shadow-[var(--shadow-soft)]",
                    assistant
                      ? "border-[var(--border)] bg-[var(--card-muted)]"
                      : "ml-auto border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]",
                  ].join(" ")}
                >
                  <div
                    className={[
                      "text-xs font-semibold uppercase tracking-[0.18em]",
                      assistant
                        ? "text-[var(--muted-foreground)]"
                        : "text-[var(--accent-foreground)]/80",
                    ].join(" ")}
                  >
                    {entry.title}
                  </div>
                  <div
                    className={[
                      "mt-2 text-sm leading-6",
                      assistant
                        ? "text-[var(--foreground)]"
                        : "text-[var(--accent-foreground)]",
                    ].join(" ")}
                  >
                    {entry.body}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-[28px] border border-[var(--border)] bg-[var(--card-muted)] p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Pill>
                <SearchIcon className="h-4 w-4" />
                Prompt draft
              </Pill>
              <Pill>
                <HelpIcon className="h-4 w-4" />
                Service guidance
              </Pill>
            </div>

            <div className="rs-textarea min-h-[120px]">
              Ask the service assistant for coaching, drafting help, or a quick operational summary...
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="secondary">Attach shift context</Button>
              <Button>Send</Button>
            </div>
          </div>
        </SectionCard>

        <div className="space-y-6">
          <SectionCard
            title="Suggested prompts"
            description="Fast-start ideas for the future assistant."
            contentClassName="space-y-3"
          >
            {suggestedPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                className="w-full rounded-[22px] border border-[var(--border)] bg-[var(--card-muted)] px-4 py-3 text-left text-sm leading-6 text-[var(--foreground)] transition hover:bg-[var(--muted)]"
              >
                {prompt}
              </button>
            ))}
          </SectionCard>

          <SectionCard
            title="Assistant status"
            description="Placeholder readiness states for future integration."
            contentClassName="space-y-3"
          >
            <StatusRow label="Conversation UI" value="Ready" tone="success" />
            <StatusRow label="Shift context" value="Planned" />
            <StatusRow label="Tool actions" value="Not wired" />
            <StatusRow label="Guest messaging drafts" value="Planned" />
          </SectionCard>
        </div>
      </div>
    </PageContainer>
  );
}

function StatusRow({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "success";
}) {
  return (
    <div className="flex items-center justify-between rounded-[22px] border border-[var(--border)] bg-[var(--card-muted)] px-4 py-3">
      <div className="text-sm text-[var(--foreground)]">{label}</div>
      <div
        className={[
          "inline-flex items-center gap-2 text-sm font-medium",
          tone === "success"
            ? "text-[var(--success)]"
            : "text-[var(--muted-foreground)]",
        ].join(" ")}
      >
        {tone === "success" ? <CheckCircleIcon className="h-4 w-4" /> : null}
        {value}
      </div>
    </div>
  );
}
