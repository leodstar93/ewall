import { ButtonHTMLAttributes, SVGProps } from "react";
import { cn } from "@/lib/ui/cn";

export type ActionIconName =
  | "delete"
  | "download"
  | "edit"
  | "login"
  | "roles"
  | "view";

type IconButtonVariant = "default" | "brand" | "danger" | "dark";

const variantClasses: Record<IconButtonVariant, string> = {
  default:
    "border-gray-200 bg-white text-gray-700 shadow-theme-xs hover:bg-gray-50 hover:text-gray-900",
  brand:
    "border-blue-200 bg-blue-50 text-blue-700 shadow-theme-xs hover:bg-blue-100 hover:text-blue-800",
  danger:
    "border-rose-200 bg-rose-50 text-rose-700 shadow-theme-xs hover:bg-rose-100 hover:text-rose-800",
  dark: "border-zinc-900 bg-zinc-900 text-white shadow-theme-xs hover:bg-zinc-800",
};

export function iconButtonClasses({
  variant = "default",
  className,
}: {
  variant?: IconButtonVariant;
  className?: string;
}) {
  return cn(
    "inline-flex h-9 w-9 items-center justify-center rounded-xl border transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-400 disabled:shadow-none",
    variantClasses[variant],
    className,
  );
}

export function ActionIcon({
  name,
  className,
  ...props
}: SVGProps<SVGSVGElement> & { name: ActionIconName }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("h-4.5 w-4.5", className)}
      {...props}
    >
      {name === "view" ? (
        <>
          <path d="M1.8 10s3-5.2 8.2-5.2S18.2 10 18.2 10 15.2 15.2 10 15.2 1.8 10 1.8 10Z" />
          <circle cx="10" cy="10" r="2.6" />
        </>
      ) : null}

      {name === "edit" ? (
        <>
          <path d="m13.8 3.8 2.4 2.4" />
          <path d="m4.8 15.2 2.8-.4 7.5-7.5a1.7 1.7 0 0 0-2.4-2.4L5.2 12.4l-.4 2.8Z" />
          <path d="M4.8 15.2 6.4 13.6" />
        </>
      ) : null}

      {name === "delete" ? (
        <>
          <path d="M4.8 6.2h10.4" />
          <path d="M7.2 6.2V4.8a1 1 0 0 1 1-1h3.6a1 1 0 0 1 1 1v1.4" />
          <path d="m6.2 6.2.6 9a1 1 0 0 0 1 .9h4.4a1 1 0 0 0 1-.9l.6-9" />
          <path d="M8.5 8.8v4.4" />
          <path d="M11.5 8.8v4.4" />
        </>
      ) : null}

      {name === "download" ? (
        <>
          <path d="M10 3.8v8.1" />
          <path d="m6.8 8.8 3.2 3.2 3.2-3.2" />
          <path d="M4.6 15.6h10.8" />
        </>
      ) : null}

      {name === "roles" ? (
        <>
          <path d="M6.6 9a2.3 2.3 0 1 0 0-4.6 2.3 2.3 0 0 0 0 4.6Z" />
          <path d="M13.7 9.8a1.9 1.9 0 1 0 0-3.8 1.9 1.9 0 0 0 0 3.8Z" />
          <path d="M3.7 15.3a4 4 0 0 1 5.8-1.3" />
          <path d="M11.1 14.7a3.3 3.3 0 0 1 4.5-.5" />
        </>
      ) : null}

      {name === "login" ? (
        <>
          <path d="M11.2 4.6h3.1a1.1 1.1 0 0 1 1.1 1.1v8.6a1.1 1.1 0 0 1-1.1 1.1h-3.1" />
          <path d="M8.8 13.6 12.4 10 8.8 6.4" />
          <path d="M12.4 10H4.6" />
        </>
      ) : null}
    </svg>
  );
}

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: ActionIconName;
  label: string;
  variant?: IconButtonVariant;
};

export function IconButton({
  icon,
  label,
  variant = "default",
  className,
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={iconButtonClasses({ variant, className })}
      {...props}
    >
      <ActionIcon name={icon} />
    </button>
  );
}
