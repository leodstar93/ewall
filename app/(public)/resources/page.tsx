import type { Metadata } from "next";
import styles from "../public.module.css";

export const metadata: Metadata = {
  title: "Resources | Truckers Unidos",
  description:
    "Access practical resources for trucking businesses, owner-operators, and drivers.",
};

const resources = [
  "Starting a trucking company",
  "Understanding industry regulations",
  "Business management for trucking companies",
  "Financial planning for owner-operators",
  "Industry news and updates",
  "Professional development opportunities",
];

export default function ResourcesPage() {
  return (
    <div className={styles.pageContainer}>
      <section className={styles.pageHero}>
        <p className={styles.kicker}>Resources</p>
        <h1 className={styles.pageHeroTitle}>Resources for Trucking Businesses</h1>
        <p className={styles.pageHeroText}>
          Truckers Unidos connects truckers with valuable tools and information
          designed to be clear, practical, and accessible.
        </p>
      </section>

      <section className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Topics We Focus On</h2>
        </div>
        <ul className={styles.resourceGrid}>
          {resources.map((topic) => (
            <li key={topic} className={styles.resourceItem}>
              {topic}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
