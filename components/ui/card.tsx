import { HTMLAttributes } from "react";
import { cn } from "@/lib/ui/cn";

export function Card({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-gray-200 bg-white shadow-theme-xs",
        className,
      )}
      {...props}
    />
  );
}
