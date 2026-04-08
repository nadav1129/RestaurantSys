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
import { PosPageHeading } from "./pos";

export function PageContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-[1680px] px-4 pb-8 pt-5 lg:px-6 lg:pt-6", className)}>
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
    <PosPageHeading
      eyebrow={eyebrow}
      title={title}
      description={description}
      actions={actions}
      className={cn("mb-6", className)}
    />
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
    <Card className={cn("overflow-hidden", className)}>
      {(title || description || actions) && (
        <CardHeader className="flex flex-col gap-4 border-b border-[var(--border)] bg-[color:rgba(255,255,255,0.5)] lg:flex-row lg:items-start lg:justify-between">
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
        "rs-kpi bg-[linear-gradient(180deg,rgba(255,255,255,0.72),var(--card-muted))]",
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
