import Button from "./Button";
import { ServiceIcon } from "./icons";
import { PosActionStrip } from "./ui/pos";

type Item = { id: string; label: string };

export default function SecondaryBar({
  title,
  description,
  items,
  activeId,
  onChange,
  topOffsetClass = "top-0",
}: {
  title?: string;
  description?: string;
  items: Item[];
  activeId?: string;
  onChange: (id: string) => void;
  topOffsetClass?: string;
}) {
  return (
    <div
      className={[
        "sticky z-20 border-b border-[var(--border)] bg-[color:rgba(244,243,239,0.92)] backdrop-blur-2xl",
        topOffsetClass,
      ].join(" ")}
    >
      <div className="mx-auto flex max-w-[1680px] flex-col gap-3 px-4 py-4 lg:flex-row lg:items-center lg:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--highlight)] text-[var(--accent-foreground)]">
            <ServiceIcon className="h-4.5 w-4.5" />
          </div>
          <div>
            {title ? (
              <div className="text-sm font-semibold text-[var(--foreground)]">
                {title}
              </div>
            ) : null}
            <div className="text-xs text-[var(--muted-foreground)]">
              {description ?? "Switch stations."}
            </div>
          </div>
        </div>

        <PosActionStrip className="min-w-0 flex-1 overflow-x-auto">
          {items.map((it) => (
            <Button
              key={it.id}
              variant={activeId === it.id ? "primary" : "secondary"}
              onClick={() => onChange(it.id)}
              className="min-w-max whitespace-nowrap"
            >
              {it.label}
            </Button>
          ))}
        </PosActionStrip>
      </div>
    </div>
  );
}
