import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[1rem] text-sm font-medium tracking-[0.01em] transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
  {
    variants: {
      variant: {
        default:
          "border border-[color:color-mix(in_srgb,var(--highlight)_58%,var(--border)_42%)] bg-[var(--highlight)] text-[var(--accent-foreground)] shadow-[var(--shadow-soft)] hover:-translate-y-px hover:brightness-[0.98] hover:shadow-[var(--shadow-strong)]",
        destructive:
          "border border-[var(--destructive)] bg-[var(--destructive)] text-[var(--destructive-foreground)] hover:brightness-110",
        outline:
          "border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--muted)]",
        secondary:
          "border border-[var(--border)] bg-[color:rgba(255,255,255,0.74)] text-[var(--foreground)] hover:bg-[var(--muted)]",
        ghost:
          "border border-transparent text-[var(--muted-foreground)] hover:border-[var(--border)] hover:bg-[var(--card-muted)] hover:text-[var(--foreground)]",
        link: "text-[var(--foreground)] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-4 py-2",
        sm: "h-9 rounded-[0.9rem] px-3",
        lg: "h-12 rounded-[1rem] px-6",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
