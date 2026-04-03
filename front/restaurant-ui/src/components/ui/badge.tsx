import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold transition",
  {
    variants: {
      variant: {
        default:
          "border-[var(--border)] bg-[var(--card-muted)] text-[var(--muted-foreground)]",
        secondary:
          "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]",
        destructive:
          "border-[var(--destructive)] bg-[var(--warning-surface)] text-[var(--destructive)]",
        outline: "border-[var(--border)] text-[var(--foreground)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof badgeVariants>) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
