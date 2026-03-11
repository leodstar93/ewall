import Link from "next/link";
import type { Metadata } from "next";
import styles from "../public.module.css";

export const metadata: Metadata = {
  title: "Donate | Truckers Unidos",
  description:
    "Support Truckers Unidos and help expand educational resources, outreach programs, and community initiatives.",
};

export default function DonatePage() {
  return (
    <div className={styles.pageContainer}>
      <section className={styles.pageHero}>
        <p className={styles.kicker}>Donate</p>
        <h1 className={styles.pageHeroTitle}>Support the Mission</h1>
        <p className={styles.pageHeroText}>
          Truckers Unidos operates as a nonprofit organization dedicated to
          helping the Hispanic trucking community.
        </p>
      </section>

      <section className={styles.donateHighlight}>
        <h2 className={styles.sectionTitle}>Your Contribution Creates Impact</h2>
        <p className={styles.sectionLead}>
          Your support helps us expand educational resources, outreach programs,
          and community initiatives that benefit trucking professionals across
          the country.
        </p>
        <p className={styles.sectionLead}>
          Every contribution helps us continue providing free support and
          valuable resources to the people who keep America moving.
        </p>
        <div className={styles.buttonRow}>
          <Link href="#" className={`${styles.button} ${styles.primaryButton}`}>
            Donate Now
          </Link>
        </div>
      </section>
    </div>
  );
}
