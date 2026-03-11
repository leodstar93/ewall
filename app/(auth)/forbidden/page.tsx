"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "../auth.module.css";

export default function ForbiddenPage() {
  const router = useRouter();

  return (
    <div className={styles.statusPage}>
      <h1 className={styles.statusCode}>403</h1>
      <h2 className={styles.statusTitle}>Access Forbidden</h2>
      <p className={styles.statusText}>
        You do not have permission to view this page. If you believe this is a
        mistake, please contact support or return to a safe page.
      </p>

      <div className={styles.statusActions}>
        <button
          onClick={() => router.push("/")}
          className={`${styles.button} ${styles.primaryButton}`}
        >
          Go Home
        </button>
        <Link href="/" className={`${styles.button} ${styles.secondaryButton}`}>
          Back
        </Link>
      </div>

      <p className={styles.statusMeta}>Error Code: 403 | Forbidden</p>
    </div>
  );
}
