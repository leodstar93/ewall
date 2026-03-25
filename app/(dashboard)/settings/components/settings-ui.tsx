"use client";

import type { ReactNode } from "react";

export type SettingsToast = {
  id: string;
  tone: "success" | "error";
  message: string;
};

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function PanelCard({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-100 px-6 py-5">
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-zinc-950">
          {title}
        </h2>
        {description ? (
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
            {description}
          </p>
        ) : null}
      </div>

      <div className="px-6 py-6">{children}</div>
    </section>
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
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
        {label}
      </span>
      {children}
      {hint ? <span className="mt-2 block text-xs text-zinc-500">{hint}</span> : null}
    </label>
  );
}

export function textInputClassName(readOnly = false) {
  return cx(
    "w-full rounded-2xl border px-4 py-3 text-sm text-zinc-900 outline-none transition",
    readOnly
      ? "border-zinc-200 bg-zinc-50"
      : "border-zinc-200 bg-white focus:border-zinc-400 focus:ring-4 focus:ring-zinc-950/5",
  );
}

export function InlineAlert({
  tone,
  message,
}: {
  tone: "success" | "error" | "info";
  message: string;
}) {
  const toneClassName =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : tone === "error"
        ? "border-rose-200 bg-rose-50 text-rose-800"
        : "border-sky-200 bg-sky-50 text-sky-800";

  return <div className={cx("rounded-2xl border px-4 py-3 text-sm", toneClassName)}>{message}</div>;
}

export function LoadingPanel() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-24 rounded-[24px] border border-zinc-200 bg-zinc-50/70 animate-pulse"
          />
        ))}
      </div>
      <div className="h-28 rounded-[24px] border border-zinc-200 bg-zinc-50/70 animate-pulse" />
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
    <div className="rounded-[24px] border border-dashed border-zinc-300 bg-zinc-50 px-5 py-6">
      <p className="text-sm font-semibold text-zinc-900">{title}</p>
      <p className="mt-2 text-sm leading-6 text-zinc-600">{description}</p>
    </div>
  );
}

export function StickyActions({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="sticky bottom-4 mt-8 flex flex-wrap items-center justify-end gap-3 rounded-[24px] border border-zinc-200 bg-white/95 px-4 py-4 shadow-lg shadow-zinc-950/5 backdrop-blur">
      {children}
    </div>
  );
}

export function StatusBadge({
  tone,
  children,
}: {
  tone: "green" | "amber" | "zinc" | "blue";
  children: ReactNode;
}) {
  const toneClassName =
    tone === "green"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : tone === "blue"
          ? "border-sky-200 bg-sky-50 text-sky-700"
          : "border-zinc-200 bg-zinc-50 text-zinc-700";

  return (
    <span className={cx("inline-flex rounded-full border px-3 py-1 text-xs font-semibold", toneClassName)}>
      {children}
    </span>
  );
}

export function ToastViewport({ toasts }: { toasts: SettingsToast[] }) {
  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-6 top-24 z-50 flex w-full max-w-sm flex-col gap-3">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cx(
            "rounded-2xl border px-4 py-3 text-sm shadow-lg shadow-zinc-950/10",
            toast.tone === "success"
              ? "border-emerald-200 bg-white text-emerald-700"
              : "border-rose-200 bg-white text-rose-700",
          )}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
