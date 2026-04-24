"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import styles from "./ImpersonationBanner.module.css";

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

  const actorLabel =
    actorName?.trim() || actorEmail?.trim() || "the admin account";

  async function handleStop() {
    try {
      setStopping(true);
      await update({
        impersonation: {
          action: "stop",
        },
      });
      router.replace("/admin/users");
      router.refresh();
    } finally {
      setStopping(false);
    }
  }

  return (
    <div className={styles.banner}>
      <div className={styles.inner}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>Impersonation Active</p>
          <p className={styles.message}>
            You are viewing the USA workspace as this user. Return control to{" "}
            <span className={styles.actor}>{actorLabel}</span> when you are done.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void handleStop()}
          disabled={stopping}
          className={styles.action}
        >
          {stopping ? "Returning..." : "Return to Admin"}
        </button>
      </div>
    </div>
  );
}
