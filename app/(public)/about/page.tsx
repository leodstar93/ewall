import type { Metadata } from "next";
import styles from "../public.module.css";

export const metadata: Metadata = {
  title: "About Us | Truckers Unidos",
  description:
    "Learn about the mission of Truckers Unidos and how we support Hispanic trucking professionals across the United States.",
};

export default function AboutPage() {
  return (
    <div className={styles.pageContainer}>
      <section className={styles.pageHero}>
        <p className={styles.kicker}>About Truckers Unidos</p>
        <h1 className={styles.pageHeroTitle}>Built to Support a Stronger Industry</h1>
        <p className={styles.pageHeroText}>
          Truckers Unidos is a nonprofit organization created to support and
          strengthen the Hispanic trucking community across the United States.
        </p>
      </section>

      <section className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Our Mission</h2>
          <p className={styles.sectionLead}>
            We provide Spanish-speaking trucking professionals with access to
            valuable information, practical resources, and community support
            that helps them succeed in a demanding and competitive industry.
          </p>
        </div>
      </section>

      <section className={styles.statRow}>
        <article className={styles.statCard}>
          <h3 className={styles.cardTitle}>Industry Reality</h3>
          <p className={styles.cardText}>
            The trucking industry is built on hard work, resilience, and
            entrepreneurship. Hispanic truckers and business owners are a major
            force behind the movement of freight across the country.
          </p>
        </article>
        <article className={styles.statCard}>
          <h3 className={styles.cardTitle}>The Gap</h3>
          <p className={styles.cardText}>
            Many still face barriers when it comes to language access, reliable
            guidance, and trusted information to make better business decisions.
          </p>
        </article>
        <article className={styles.statCard}>
          <h3 className={styles.cardTitle}>Why We Exist</h3>
          <p className={styles.cardText}>
            Truckers Unidos bridges that gap. When truckers are informed,
            connected, and supported, the entire industry becomes stronger.
          </p>
        </article>
      </section>
    </div>
  );
}
