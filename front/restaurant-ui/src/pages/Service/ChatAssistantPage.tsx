import { useMemo, useState } from "react";
import { assistantFetch } from "../../api/api";
import Button from "../../components/Button";
import { SparklesIcon } from "../../components/icons";
import { Textarea } from "../../components/ui/textarea";
import { PageContainer, PageHeader, Pill, SectionCard } from "../../components/ui/layout";

type ChatEntry = {
  role: "assistant" | "user";
  title: string;
  body: string;
};

type ChatReplyDto = {
  reply: string;
};

const suggestedPrompts = [
  "Summarize floor pressure.",
  "Draft a guest reply.",
  "Help with bar backlog.",
  "Prepare a shift handoff.",
];

const initialTranscript: ChatEntry[] = [
  {
    role: "assistant",
    title: "Assistant",
    body: "",
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
          title: "Assistant",
          body: res?.reply?.trim() || "No reply received.",
        },
      ]);
    } catch (e: any) {
      console.error("Assistant request failed", e);
      setError(e?.message ?? "Failed to reach assistant.");
      setTranscript((prev) => [
        ...prev,
        {
          role: "assistant",
          title: "Assistant",
          body: "Assistant unavailable right now.",
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="Assistant"
        actions={
          <Pill>
            <SparklesIcon className="h-4 w-4" />
            Live
          </Pill>
        }
      />

      <SectionCard
        title="Chat"
        actions={
          <div className="flex flex-wrap gap-2">
            {suggestedPrompts.map((prompt) => (
              <Button
                key={prompt}
                variant="secondary"
                className="h-9"
                onClick={() => setDraft(prompt)}
              >
                {prompt}
              </Button>
            ))}
          </div>
        }
        contentClassName="space-y-4"
      >
        <div className="space-y-3">
          {transcript
            .filter((entry) => entry.body.trim().length > 0)
            .map((entry, index) => {
            const assistant = entry.role === "assistant";
            return (
              <div
                key={`${entry.role}-${index}`}
                className={[
                  "max-w-[88%] rounded-[20px] border px-4 py-3 shadow-[var(--shadow-soft)]",
                  assistant
                    ? "border-[var(--border)] bg-[var(--card-muted)]"
                    : "ml-auto border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]",
                ].join(" ")}
              >
                <div
                  className={[
                    "text-[11px] font-semibold uppercase tracking-[0.18em]",
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

        <div className="rounded-[24px] border border-[var(--border)] bg-[var(--card-muted)] p-4">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask the assistant..."
            className="min-h-[120px]"
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
            <Button onClick={() => void sendMessage(draft)} disabled={sending || !draft.trim()}>
              {sending ? "Sending..." : "Send"}
            </Button>
          </div>
        </div>
      </SectionCard>
    </PageContainer>
  );
}
