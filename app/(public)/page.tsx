import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import styles from "./public.module.css";

export const metadata: Metadata = {
  title: "Truckers Unidos | Supporting Trucking Businesses Across America",
  description:
    "Truckers Unidos is a nonprofit organization dedicated to supporting trucking businesses, owner-operators, and drivers through education, resources, and community.",
};

const whatWeDo = [
  {
    icon: "ED",
    title: "Education",
    description:
      "Clear and practical information to help trucking businesses understand the industry and make better decisions.",
  },
  {
    icon: "CO",
    title: "Community",
    description:
      "A united network where truckers share knowledge, support each other, and grow stronger together.",
  },
  {
    icon: "RE",
    title: "Resources",
    description:
      "Reliable tools, guidance, and opportunities that help owner-operators and fleets move forward with confidence.",
  },
  {
    icon: "SU",
    title: "Support",
    description:
      "Practical help for real challenges so trucking professionals can focus on operations, growth, and long-term success.",
  },
];

const whoWeServe = [
  "Owner-operators",
  "Small trucking companies",
  "Spanish-speaking drivers",
  "Transportation entrepreneurs",
  "Families connected to the trucking industry",
];

const values = [
  {
    title: "Unity",
    description:
      "We believe the trucking community is stronger when we stand together.",
  },
  {
    title: "Support",
    description: "Helping each other succeed strengthens the entire industry.",
  },
  {
    title: "Integrity",
    description: "We provide honest guidance and trusted information.",
  },
  {
    title: "Progress",
    description:
      "We work toward a stronger future for Hispanic trucking businesses.",
  },
];

export default function HomePage() {
  return (
    <div className={styles.pageContainer}>
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <p className={styles.kicker}>Nonprofit for Trucking Professionals</p>
          <h1 className={styles.heroTitle}>TRUCKERS UNIDOS</h1>
          <h2 className={styles.heroSubtitle}>
            Supporting Trucking Businesses Across America
          </h2>
          <p className={styles.heroText}>
            Truckers Unidos is a nonprofit organization dedicated to empowering
            trucking companies, owner-operators, and drivers through education,
            support, and community. Together we help truckers grow stronger
            businesses, access reliable information, and build a united trucking
            community.
          </p>
          <div className={styles.buttonRow}>
            <Link href="/community" className={`${styles.button} ${styles.primaryButton}`}>
              Join the Community
            </Link>
            <Link href="/resources" className={`${styles.button} ${styles.secondaryButton}`}>
              Get Support
            </Link>
          </div>
        </div>

        <div className={styles.heroVisual}>
          <div className={styles.logoFrame}>
            <Image
              src="/brand/truckers-unidos-logo.png"
              alt="Truckers Unidos truck logo"
              width={900}
              height={900}
              className={styles.heroLogo}
              priority
            />
          </div>
          <p className={styles.heroQuote}>One Industry. One Community.</p>
        </div>
      </section>

      <section className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Why Truckers Unidos Exists</h2>
          <p className={styles.sectionLead}>
            The trucking industry keeps America moving. Yet many hard-working
            drivers and entrepreneurs still face language barriers, limited
            access to reliable guidance, and weak support networks.
          </p>
          <p className={styles.sectionLead}>
            Truckers Unidos was created to change that by delivering education,
            trusted information, and practical community support that helps
            trucking businesses grow with confidence.
          </p>
        </div>
      </section>

      <section className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>What We Do</h2>
          <p className={styles.sectionLead}>
            We focus on practical, high-impact support for trucking businesses
            and professionals.
          </p>
        </div>
        <div className={styles.cardGridFour}>
          {whatWeDo.map((item) => (
            <article key={item.title} className={styles.infoCard}>
              <span className={styles.cardIcon} aria-hidden="true">
                {item.icon}
              </span>
              <h3 className={styles.cardTitle}>{item.title}</h3>
              <p className={styles.cardText}>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Who We Serve</h2>
          <p className={styles.sectionLead}>
            Truckers Unidos supports the people who keep freight moving across
            America.
          </p>
        </div>
        <ul className={styles.audienceList}>
          {whoWeServe.map((audience) => (
            <li key={audience} className={styles.audienceItem}>
              {audience}
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Our Values</h2>
        </div>
        <div className={styles.valueGrid}>
          {values.map((value) => (
            <article key={value.title} className={styles.valueCard}>
              <h3 className={styles.valueName}>{value.title}</h3>
              <p className={styles.valueText}>{value.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.ctaBand}>
        <div>
          <h2 className={styles.sectionTitle}>Join the Truckers Unidos Community</h2>
          <p className={styles.ctaText}>
            Truckers Unidos is more than an organization. It is a growing
            network committed to unity, support, and progress.
          </p>
        </div>
        <div className={styles.buttonRow}>
          <Link href="/community" className={`${styles.button} ${styles.primaryButton}`}>
            Become a Member
          </Link>
          <Link href="/donate" className={`${styles.button} ${styles.secondaryButton}`}>
            Support the Mission
          </Link>
        </div>
      </section>
    </div>
  );
}
