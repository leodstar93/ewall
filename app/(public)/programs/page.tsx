import type { Metadata } from "next";
import styles from "../public.module.css";

export const metadata: Metadata = {
  title: "Programs | Truckers Unidos",
  description:
    "Explore Truckers Unidos programs: educational initiatives, industry awareness, community outreach, and business growth support.",
};

const programs = [
  {
    title: "Educational Programs",
    description:
      "Focused content that helps trucking businesses operate more effectively and make informed decisions.",
  },
  {
    title: "Industry Awareness",
    description:
      "Updates and practical guidance to help trucking professionals stay current with developments and best practices.",
  },
  {
    title: "Community Outreach",
    description:
      "Connection with peers who understand the realities, opportunities, and challenges of the trucking industry.",
  },
  {
    title: "Business Growth Support",
    description:
      "Resources and direction to strengthen operations and plan for long-term business success.",
  },
];

export default function ProgramsPage() {
  return (
    <div className={styles.pageContainer}>
      <section className={styles.pageHero}>
        <p className={styles.kicker}>Programs</p>
        <h1 className={styles.pageHeroTitle}>Our Programs</h1>
        <p className={styles.pageHeroText}>
          Truckers Unidos develops initiatives designed to support trucking
          professionals and small businesses.
        </p>
      </section>

      <section className={styles.programGrid}>
        {programs.map((program) => (
          <article key={program.title} className={styles.infoCard}>
            <h2 className={styles.cardTitle}>{program.title}</h2>
            <p className={styles.cardText}>{program.description}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
