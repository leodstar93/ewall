import Link from "next/link";
import type { Metadata } from "next";
import styles from "../public.module.css";

export const metadata: Metadata = {
  title: "Community | Truckers Unidos",
  description:
    "Join the Truckers Unidos community to connect, share experience, and grow together.",
};

export default function CommunityPage() {
  return (
    <div className={styles.pageContainer}>
      <section className={styles.pageHero}>
        <p className={styles.kicker}>Community</p>
        <h1 className={styles.pageHeroTitle}>The Truckers Unidos Community</h1>
        <p className={styles.pageHeroText}>
          Truckers Unidos is built around one simple idea: truckers are
          stronger together.
        </p>
      </section>

      <section className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>A Network Built on Support</h2>
          <p className={styles.sectionLead}>
            Our community allows trucking professionals to connect, share
            experiences, and support one another.
          </p>
          <p className={styles.sectionLead}>
            Whether you are an experienced fleet owner or just starting your
            journey, this community is here to help you move forward with
            confidence.
          </p>
        </div>
      </section>

      <section className={styles.ctaBand}>
        <div>
          <h2 className={styles.sectionTitle}>Join Us</h2>
          <p className={styles.ctaText}>
            Build relationships, share knowledge, and become part of a stronger
            and more resilient trucking industry.
          </p>
        </div>
        <div className={styles.buttonRow}>
          <Link href="/contact" className={`${styles.button} ${styles.primaryButton}`}>
            Join the Community
          </Link>
          <Link href="/donate" className={`${styles.button} ${styles.secondaryButton}`}>
            Support the Mission
          </Link>
        </div>
      </section>
    </div>
  );
}
