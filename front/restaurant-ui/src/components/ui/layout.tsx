import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./card";
import { Badge } from "./badge";

export function PageContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-[1480px] px-4 pb-8 pt-6 lg:px-6", className)}>
      {children}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between",
        className
      )}
    >
      <div className="space-y-2">
        {eyebrow ? <div className="rs-eyebrow">{eyebrow}</div> : null}
        <div className="font-display text-3xl font-semibold tracking-tight text-[var(--foreground)]">
          {title}
        </div>
        {description ? (
          <p className="max-w-3xl text-sm leading-6 text-[var(--muted-foreground)]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <Card className={className}>
      {(title || description || actions) && (
        <CardHeader className="flex flex-col gap-4 border-b border-[var(--border)] lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            {title ? <CardTitle>{title}</CardTitle> : null}
            {description ? <CardDescription>{description}</CardDescription> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </CardHeader>
      )}
      <CardContent className={cn("p-5", contentClassName)}>{children}</CardContent>
    </Card>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "success" | "warning";
}) {
  return (
    <div
      className={cn(
        "rs-kpi",
        tone === "success" && "border-[color:var(--success-soft)] bg-[var(--success-surface)]",
        tone === "warning" && "border-[color:var(--warning-soft)] bg-[var(--warning-surface)]"
      )}
    >
      <div className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
        {label}
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-tight text-[var(--foreground)]">
        {value}
      </div>
      {hint ? (
        <div className="mt-2 text-xs leading-5 text-[var(--muted-foreground)]">
          {hint}
        </div>
      ) : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rs-empty-state", className)}>
      <div className="font-display text-lg font-semibold text-[var(--foreground)]">
        {title}
      </div>
      <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--muted-foreground)]">
        {description}
      </p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Pill({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <Badge variant="default" className={cn("rs-pill", className)}>
      {children}
    </Badge>
  );
}
