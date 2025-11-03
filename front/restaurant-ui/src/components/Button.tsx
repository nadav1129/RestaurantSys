// File: src/components/Button.tsx
import React from "react";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

const base =
  "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 " +
  "disabled:opacity-50 disabled:cursor-not-allowed transition-colors";

function variantClasses(variant: ButtonProps["variant"]) {
  switch (variant) {
    case "secondary":
      return "border border-gray-300 bg-white text-gray-800 hover:bg-gray-50";
    case "ghost":
      return "bg-transparent text-gray-800 hover:bg-gray-100";
    case "danger":
      return "bg-red-600 text-white hover:bg-red-700";
    case "primary":
    default:
      return "bg-indigo-600 text-white hover:bg-indigo-700";
  }
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", className = "", ...rest }, ref) => {
    return (
      <button
        ref={ref}
        className={`${base} ${variantClasses(variant)} ${className}`}
        {...rest}
      />
    );
  }
);

Button.displayName = "Button";
export default Button;
