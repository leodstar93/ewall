import type { ReactNode } from "react";

type AlertTone = "success" | "error" | "info";
type BadgeTone = "blue" | "zinc" | "amber" | "green" | "error" | "info" | "success";

function joinClasses(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

const badgeToneClasses: Record<BadgeTone, string> = {
  blue: "border-sky-200 bg-sky-50 text-sky-700",
  zinc: "border-zinc-200 bg-zinc-100 text-zinc-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  green: "border-emerald-200 bg-emerald-50 text-emerald-700",
  error: "border-rose-200 bg-rose-50 text-rose-700",
  info: "border-sky-200 bg-sky-50 text-sky-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

const alertToneClasses: Record<AlertTone, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  error: "border-rose-200 bg-rose-50 text-rose-800",
  info: "border-sky-200 bg-sky-50 text-sky-800",
};

export function textInputClassName(readOnly = false) {
  return joinClasses(
    "w-full rounded-2xl border px-4 py-3 text-sm outline-none transition",
    readOnly
      ? "cursor-default border-zinc-200 bg-zinc-50 text-zinc-600"
      : "border-zinc-200 bg-white text-zinc-900 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200",
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
        {label}
      </span>
      {children}
      {hint ? <span className="text-xs leading-5 text-zinc-500">{hint}</span> : null}
    </label>
  );
}

export function InlineAlert({
  tone,
  message,
}: {
  tone: AlertTone;
  message: string;
}) {
  return (
    <div className={joinClasses("rounded-2xl border px-4 py-3 text-sm leading-6", alertToneClasses[tone])}>
      {message}
    </div>
  );
}

export function StatusBadge({
  tone,
  children,
}: {
  tone: BadgeTone;
  children: ReactNode;
}) {
  return (
    <span
      className={joinClasses(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
        badgeToneClasses[tone],
      )}
    >
      {children}
    </span>
  );
}

export function LoadingPanel() {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="h-9 w-9 animate-spin rounded-full border-4 border-zinc-200 border-t-zinc-900" />
    </div>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[24px] border border-dashed border-zinc-300 bg-zinc-50 px-6 py-8 text-center">
      <h3 className="text-base font-semibold text-zinc-900">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-zinc-600">{description}</p>
    </div>
  );
}

export function PanelCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[24px] border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-200 px-5 py-4">
        <h2 className="text-base font-semibold text-zinc-950">{title}</h2>
        {description ? <p className="mt-1 text-sm leading-6 text-zinc-600">{description}</p> : null}
      </div>
      <div className="px-5 py-5">{children}</div>
    </section>
  );
}

export function StickyActions({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-5 sticky bottom-0 border-t border-zinc-200 bg-white/95 px-5 py-4 backdrop-blur">
      <div className="flex flex-wrap items-center justify-end gap-3">{children}</div>
    </div>
  );
}
