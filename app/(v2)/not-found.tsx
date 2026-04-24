import Link from "next/link";
import styles from "./module-page.module.css";

export default function V2NotFound() {
  return (
    <section className={styles.panel}>
      <span className={styles.kicker}>Route not found</span>
      <h1 className={styles.title}>This page does not exist yet.</h1>
      <p className={styles.text}>
        The current workspace is active, but this route has not been connected yet.
      </p>
      <div className={styles.actions}>
        <Link href="/" className={styles.primaryAction}>
          Back to home
        </Link>
        <Link href="/" className={styles.secondaryAction}>
          Open current site
        </Link>
      </div>
    </section>
  );
}
