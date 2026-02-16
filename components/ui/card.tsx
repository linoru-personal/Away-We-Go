import type { HTMLAttributes, ReactNode } from "react";

type CardSectionProps = HTMLAttributes<HTMLDivElement> & {
  children?: ReactNode;
  className?: string;
};

export function Card({ children, className = "", ...props }: CardSectionProps) {
  return (
    <div
      className={`bg-white rounded-3xl shadow-sm ${className}`.trim()}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  className = "",
  ...props
}: CardSectionProps) {
  return (
    <div
      className={`px-6 pt-6 text-lg font-semibold ${className}`.trim()}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardContent({
  children,
  className = "",
  ...props
}: CardSectionProps) {
  return (
    <div
      className={`px-6 py-4 ${className}`.trim()}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardFooter({
  children,
  className = "",
  ...props
}: CardSectionProps) {
  return (
    <div
      className={`flex items-center justify-between px-6 pb-6 ${className}`.trim()}
      {...props}
    >
      {children}
    </div>
  );
}
