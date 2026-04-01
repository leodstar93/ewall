import { InputHTMLAttributes } from "react";
import { cn } from "@/lib/ui/cn";

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-lg border border-gray-300 bg-white px-4 text-sm text-gray-700 shadow-theme-xs outline-none placeholder:text-gray-400 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10",
        className,
      )}
      {...props}
    />
  );
}
