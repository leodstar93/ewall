import { ReactNode } from "react";
import { cn } from "@/lib/ui/cn";
import { BadgeTone } from "@/lib/ui/status-utils";

type BadgeProps = {
  children: ReactNode;
  tone?: BadgeTone;
  variant?: "light" | "solid";
  size?: "sm" | "md";
  className?: string;
};

const sizeClasses = {
  sm: "px-2.5 py-0.5 text-[12px]",
  md: "px-3 py-1 text-sm",
};

const lightToneClasses: Record<BadgeTone, string> = {
  primary: "bg-brand-50 text-brand-500",
  success: "bg-success-50 text-success-500",
  warning: "bg-warning-50 text-warning-500",
  error: "bg-error-50 text-error-500",
  info: "bg-blue-light-50 text-blue-light-500",
  light: "bg-gray-100 text-gray-700",
  dark: "bg-gray-500 text-white",
};

const solidToneClasses: Record<BadgeTone, string> = {
  primary: "bg-brand-500 text-white",
  success: "bg-success-500 text-white",
  warning: "bg-warning-500 text-white",
  error: "bg-error-500 text-white",
  info: "bg-blue-light-500 text-white",
  light: "bg-gray-300 text-gray-800",
  dark: "bg-gray-700 text-white",
};

export function Badge({
  children,
  tone = "primary",
  variant = "light",
  size = "sm",
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center gap-1 rounded-full font-medium",
        sizeClasses[size],
        variant === "light" ? lightToneClasses[tone] : solidToneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
