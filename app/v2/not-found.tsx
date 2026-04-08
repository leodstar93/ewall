import Link from "next/link";
import styles from "./module-page.module.css";

export default function V2NotFound() {
  return (
    <section className={styles.panel}>
      <span className={styles.kicker}>Route not found</span>
      <h1 className={styles.title}>This V2 page does not exist yet.</h1>
      <p className={styles.text}>
        The new template is active, but this route has not been connected yet.
      </p>
      <div className={styles.actions}>
        <Link href="/v2" className={styles.primaryAction}>
          Back to V2 home
        </Link>
        <Link href="/" className={styles.secondaryAction}>
          Open current site
        </Link>
      </div>
    </section>
  );
}
