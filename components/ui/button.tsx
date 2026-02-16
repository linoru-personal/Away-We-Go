import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-rose-400 hover:bg-rose-500 text-white focus:ring-2 focus:ring-rose-500 focus:ring-offset-2",
  secondary:
    "border border-gray-300 bg-transparent hover:bg-gray-100 text-gray-700 focus:ring-2 focus:ring-gray-400 focus:ring-offset-2",
};

export function Button({
  variant = "primary",
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      className={`rounded-full px-4 py-2 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${variantStyles[variant]} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}
