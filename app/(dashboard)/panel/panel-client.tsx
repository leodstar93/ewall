"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

type QuickAction = {
  href: string;
  title: string;
  description: string;
  badge: string;
};

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="space-y-4">
          <div className="h-8 w-60 rounded bg-zinc-100 animate-pulse" />
          <div className="h-4 w-80 rounded bg-zinc-100 animate-pulse" />
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-40 rounded-[28px] border border-zinc-200 bg-white animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (!session?.user) return null;

  const permissions = Array.isArray(session.user.permissions)
    ? session.user.permissions
    : [];

  const quickActions: QuickAction[] = [
    {
      href: "/settings",
      title: "Account settings",
      description: "Update your profile, company info, payments, documents, and security.",
      badge: "Start here",
    },
    {
      href: "/settings?tab=documents",
      title: "My documents",
      description: "Upload insurance, IDs, and compliance files in one place.",
      badge: "Documents",
    },
  ];

  if (permissions.includes("truck:read")) {
    quickActions.push({
      href: "/trucks",
      title: "My trucks",
      description: "Review units, fleet details, and truck records.",
      badge: "Fleet",
    });
  }

  if (permissions.includes("ifta:read")) {
    quickActions.push({
      href: "/ifta",
      title: "IFTA",
      description: "Open quarterly fuel tax reports and mileage records.",
      badge: "Tax filing",
    });
  }

  if (permissions.includes("ucr:read")) {
    quickActions.push({
      href: "/ucr",
      title: "UCR",
      description: "Review your UCR filing and complete missing compliance steps.",
      badge: "Compliance",
    });
  }

  if (permissions.includes("dmv:read")) {
    quickActions.push({
      href: "/dmv",
      title: "DMV registration",
      description: "Track registrations, renewals, and requirement documents.",
      badge: "Registration",
    });
  }

  if (permissions.includes("compliance2290:view")) {
    quickActions.push({
      href: "/2290",
      title: "Form 2290",
      description: "Check HVUT filings, payment status, and Schedule 1 progress.",
      badge: "2290",
    });
  }

  const firstName =
    session.user.name?.split(" ").filter(Boolean)[0] ||
    session.user.email?.split("@")[0] ||
    "driver";

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <section className="rounded-[32px] border border-zinc-200 bg-[linear-gradient(135deg,_#f8fafc,_#ffffff_52%,_#ecfccb)] p-6 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
          Quick Actions
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
          Everything you need, {firstName}.
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
          Pick the task you want to work on and jump straight into it. No extra stats,
          no admin noise, just the actions that matter for your day.
        </p>
      </section>

      <section className="mt-8">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="group rounded-[28px] border border-zinc-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
                  {action.badge}
                </span>
                <span className="text-zinc-400 transition group-hover:text-zinc-700">
                  Open
                </span>
              </div>

              <h2 className="mt-5 text-lg font-semibold text-zinc-950">
                {action.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                {action.description}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
