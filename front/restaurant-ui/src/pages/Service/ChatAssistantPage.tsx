import { useMemo, useState } from "react";
import Button from "../../components/Button";
import {
  CheckCircleIcon,
  ClockIcon,
  HelpIcon,
  SearchIcon,
  SparklesIcon,
} from "../../components/icons";
import { assistantFetch } from "../../api/api";
import { Textarea } from "../../components/ui/textarea";
import {
  PageContainer,
  PageHeader,
  Pill,
  SectionCard,
  StatCard,
} from "../../components/ui/layout";

type ChatEntry = {
  role: "assistant" | "user";
  title: string;
  body: string;
};

type ChatReplyDto = {
  reply: string;
};

const suggestedPrompts = [
  "Summarize open floor pressure for the next 20 minutes.",
  "Draft a hostess response for a delayed reservation.",
  "Recommend the fastest route for clearing bar ticket backlog.",
  "Prepare a handoff note for the next shift lead.",
];

const initialTranscript: ChatEntry[] = [
  {
    role: "assistant",
    title: "Shift Assistant",
    body:
      "I’m connected through the existing WhatsApp assistant service now, so you can ask for operational guidance, drafting help, and tool-backed actions from here.",
  },
];

function getSessionId() {
  try {
    const existing = sessionStorage.getItem("assistantSessionId");
    if (existing) return existing;

    const next = `web-${crypto.randomUUID()}`;
    sessionStorage.setItem("assistantSessionId", next);
    return next;
  } catch {
    return "web-ui";
  }
}

export default function ChatAssistantPage() {
  const [transcript, setTranscript] = useState<ChatEntry[]>(initialTranscript);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sessionId = useMemo(() => getSessionId(), []);

  async function sendMessage(message: string) {
    const trimmed = message.trim();
    if (!trimmed || sending) return;

    const userEntry: ChatEntry = {
      role: "user",
      title: "You",
      body: trimmed,
    };

    setTranscript((prev) => [...prev, userEntry]);
    setDraft("");
    setSending(true);
    setError(null);

    try {
      const res = await assistantFetch<ChatReplyDto>("/api/chat/message", {
        method: "POST",
        body: {
          sessionId,
          message: trimmed,
        },
      });

      setTranscript((prev) => [
        ...prev,
        {
          role: "assistant",
          title: "Shift Assistant",
          body: res?.reply?.trim() || "I didn’t get a usable reply back.",
        },
      ]);
    } catch (e: any) {
      console.error("Assistant request failed", e);
      setError(e?.message ?? "Failed to reach the assistant service.");
      setTranscript((prev) => [
        ...prev,
        {
          role: "assistant",
          title: "Shift Assistant",
          body:
            "I couldn’t reach the WhatsApp assistant service just now. Check that the assistant API is running and try again.",
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  function handlePromptClick(prompt: string) {
    setDraft(prompt);
  }

  async function handleSubmit() {
    await sendMessage(draft);
  }

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        eyebrow="Service Assistant"
        title="Agent Chat Workspace"
        description="This workspace now talks to the existing WhatsApp assistant service, so the same LLM and tool flow can be used from the UI."
        actions={
          <>
            <Pill>
              <SparklesIcon className="h-4 w-4" />
              WhatsApp LLM
            </Pill>
            <Pill>
              <ClockIcon className="h-4 w-4" />
              Live assistant
            </Pill>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Mode"
          value="Live Chat"
          hint="Messages are sent to the existing WhatsApp assistant API."
          tone="success"
        />
        <StatCard
          label="Best For"
          value="Service Ops"
          hint="Guest comms, pacing suggestions, and tool-backed restaurant actions."
          tone="success"
        />
        <StatCard
          label="Session"
          value="Web Linked"
          hint="The UI keeps a lightweight web session id for assistant continuity."
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_340px]">
        <SectionCard
          title="Conversation"
          description="Ask directly here and the prompt is handled by the existing WhatsApp assistant backend."
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
                      "mt-2 whitespace-pre-wrap text-sm leading-6",
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
                WhatsApp API connected
              </Pill>
            </div>

            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Ask the service assistant for coaching, drafting help, or a quick operational summary..."
              className="min-h-[140px]"
            />

            {error ? (
              <div className="mt-3 rounded-2xl border border-[var(--destructive)] bg-[var(--warning-surface)] px-4 py-3 text-sm text-[var(--destructive)]">
                {error}
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setDraft("")} disabled={sending || !draft}>
                Clear
              </Button>
              <Button onClick={() => void handleSubmit()} disabled={sending || !draft.trim()}>
                {sending ? "Sending..." : "Send"}
              </Button>
            </div>
          </div>
        </SectionCard>

        <div className="space-y-6">
          <SectionCard
            title="Suggested prompts"
            description="Quick-start prompts for the WhatsApp-backed assistant."
            contentClassName="space-y-3"
          >
            {suggestedPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => handlePromptClick(prompt)}
                className="w-full rounded-[22px] border border-[var(--border)] bg-[var(--card-muted)] px-4 py-3 text-left text-sm leading-6 text-[var(--foreground)] transition hover:bg-[var(--muted)]"
              >
                {prompt}
              </button>
            ))}
          </SectionCard>

          <SectionCard
            title="Assistant status"
            description="Connection state for the shared assistant backend."
            contentClassName="space-y-3"
          >
            <StatusRow label="Conversation UI" value="Ready" tone="success" />
            <StatusRow label="WhatsApp assistant API" value="Connected path" tone="success" />
            <StatusRow label="Tool-backed actions" value="Available through orchestrator" tone="success" />
            <StatusRow label="Session id" value={sessionId} />
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
    <div className="flex items-center justify-between gap-3 rounded-[22px] border border-[var(--border)] bg-[var(--card-muted)] px-4 py-3">
      <div className="text-sm text-[var(--foreground)]">{label}</div>
      <div
        className={[
          "inline-flex items-center gap-2 text-right text-sm font-medium",
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
