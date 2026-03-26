"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

type ImpersonationBannerProps = {
  actorName?: string | null;
  actorEmail?: string | null;
};

export function ImpersonationBanner({
  actorName,
  actorEmail,
}: ImpersonationBannerProps) {
  const router = useRouter();
  const { update } = useSession();
  const [stopping, setStopping] = useState(false);
  const actorLabel = actorName?.trim() || actorEmail?.trim() || "the admin account";

  async function handleStop() {
    try {
      setStopping(true);
      await update({
        impersonation: {
          action: "stop",
        },
      });
      router.push("/admin/users");
      router.refresh();
    } finally {
      setStopping(false);
    }
  }

  return (
    <div className="mb-6 rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-semibold uppercase tracking-[0.14em] text-amber-700">
            Impersonation Active
          </p>
          <p className="mt-1">
            You are viewing the app as this user. Return control to{" "}
            <span className="font-semibold">{actorLabel}</span> when you are done.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void handleStop()}
          disabled={stopping}
          className="rounded-2xl border border-amber-300 bg-white px-4 py-2 font-semibold text-amber-900 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {stopping ? "Returning..." : "Return to admin"}
        </button>
      </div>
    </div>
  );
}
