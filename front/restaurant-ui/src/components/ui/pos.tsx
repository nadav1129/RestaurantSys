import type { ComponentType, ReactNode, SVGProps } from "react";
import { Badge } from "./badge";
import { cn } from "../../lib/utils";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

export function PosPanel({
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
  tone = "default",
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  tone?: "default" | "soft" | "highlight";
}) {
  return (
    <section
      className={cn(
        "rs-pos-panel overflow-hidden",
        tone === "soft" && "rs-pos-panel-soft",
        tone === "highlight" && "rs-pos-panel-highlight",
        className
      )}
    >
      {(title || description || actions) && (
        <div className="border-b border-[var(--border)] px-5 py-4 lg:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1.5">
              {title ? (
                <div className="text-base font-semibold tracking-[0.02em] text-[var(--foreground)]">
                  {title}
                </div>
              ) : null}
              {description ? (
                <div className="max-w-3xl text-sm leading-6 text-[var(--muted-foreground)]">
                  {description}
                </div>
              ) : null}
            </div>
            {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
          </div>
        </div>
      )}
      <div className={cn("px-5 py-5 lg:px-6", contentClassName)}>{children}</div>
    </section>
  );
}

export function PosActionStrip({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("rs-pos-action-strip", className)}>{children}</div>;
}

export function PosActionButton({
  icon: Icon,
  label,
  active = false,
  disabled = false,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: IconComponent;
  label: ReactNode;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        "rs-pos-action-button",
        active && "rs-pos-action-button-active",
        className
      )}
      {...props}
    >
      {Icon ? (
        <span className="rs-pos-action-icon">
          <Icon className="h-4.5 w-4.5" />
        </span>
      ) : null}
      <span className="min-w-0 truncate text-sm font-semibold">{label}</span>
    </button>
  );
}

export function PosMetricCircle({
  label,
  value,
  className,
  size = "default",
}: {
  label: ReactNode;
  value: ReactNode;
  className?: string;
  size?: "default" | "small";
}) {
  return (
    <div
      className={cn(
        "rs-pos-metric-circle",
        size === "small" && "h-24 w-24 text-sm",
        className
      )}
    >
      <div className={cn("font-light leading-none", size === "small" ? "text-3xl" : "text-[40px]")}>
        {value}
      </div>
      <div className="mt-1 text-[11px] uppercase tracking-[0.2em] text-white/68">{label}</div>
    </div>
  );
}

export function PosPageHeading({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between", className)}>
      <div className="space-y-2">
        {eyebrow ? <div className="rs-eyebrow">{eyebrow}</div> : null}
        <div className="font-display text-[2rem] font-semibold tracking-[0.01em] text-[var(--foreground)]">
          {title}
        </div>
        {description ? (
          <div className="max-w-3xl text-sm leading-6 text-[var(--muted-foreground)]">
            {description}
          </div>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function PosListShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("rs-pos-list-shell", className)}>{children}</div>;
}

export function PosStatusPill({
  children,
  tone = "default",
  className,
}: {
  children: ReactNode;
  tone?: "default" | "success" | "warning" | "accent";
  className?: string;
}) {
  return (
    <Badge
      variant="default"
      className={cn(
        "rs-pill",
        tone === "success" && "bg-[var(--success-surface)] text-[var(--success)] border-[color:var(--success-soft)]",
        tone === "warning" && "bg-[var(--warning-surface)] text-[var(--warning)] border-[color:var(--warning-soft)]",
        tone === "accent" && "bg-[var(--accent)] text-[var(--accent-foreground)] border-[color:color-mix(in_srgb,var(--accent)_75%,white_25%)]",
        className
      )}
    >
      {children}
    </Badge>
  );
}
