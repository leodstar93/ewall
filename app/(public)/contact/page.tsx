import type { Metadata } from "next";
import { ContactForm } from "@/components/contact-form";
import styles from "../public.module.css";

export const metadata: Metadata = {
  title: "Contact | Truckers Unidos",
  description:
    "Contact Truckers Unidos for questions, partnerships, and community support.",
};

export default function ContactPage() {
  return (
    <div className={styles.pageContainer}>
      <section className={styles.pageHero}>
        <p className={styles.kicker}>Contact</p>
        <h1 className={styles.pageHeroTitle}>Contact Truckers Unidos</h1>
        <p className={styles.pageHeroText}>
          We welcome inquiries from trucking professionals, community members,
          partners, and supporters.
        </p>
      </section>

      <section className={styles.contactLayout}>
        <aside className={styles.contactInfo}>
          <h2 className={styles.sectionTitle}>Let us connect</h2>
          <p className={styles.sectionLead}>
            Our team is here to help build a stronger and more united trucking
            community.
          </p>
          <ul className={styles.audienceList}>
            <li className={styles.audienceItem}>General questions</li>
            <li className={styles.audienceItem}>Program information</li>
            <li className={styles.audienceItem}>Community partnerships</li>
            <li className={styles.audienceItem}>Support and collaboration</li>
          </ul>
        </aside>

        <div className={styles.contactFormPanel}>
          <ContactForm />
        </div>
      </section>
    </div>
  );
}
