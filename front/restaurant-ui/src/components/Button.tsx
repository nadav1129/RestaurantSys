import React from "react";
import { Button as ShadcnButton } from "./ui/button";

export type ButtonProps = Omit<
  React.ComponentProps<typeof ShadcnButton>,
  "variant"
> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

const Button = React.forwardRef<
  React.ElementRef<typeof ShadcnButton>,
  ButtonProps
>(({ variant = "primary", ...props }, ref) => {
  const mappedVariant =
    variant === "primary"
      ? "default"
      : variant === "danger"
        ? "destructive"
        : variant;

  return <ShadcnButton ref={ref} variant={mappedVariant} {...props} />;
});

Button.displayName = "Button";

export default Button;
