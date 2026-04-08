import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLabModuleBySlug } from "@/v2/content";
import styles from "../../module-page.module.css";

type ModulePageProps = {
  params: {
    slug: string;
  };
};

export function generateMetadata({ params }: ModulePageProps): Metadata {
  const labModule = getLabModuleBySlug(params.slug);

  if (!labModule) {
    return {
      title: "Module not found",
    };
  }

  return {
    title: `${labModule.label} Preview`,
    description: labModule.summary,
  };
}

export default function V2ModuleRoutePage({ params }: ModulePageProps) {
  const labModule = getLabModuleBySlug(params.slug);

  if (!labModule) {
    notFound();
  }

  return (
    <div className={styles.stack}>
      <section className={styles.panel}>
        <span className={styles.kicker}>{labModule.eyebrow}</span>
        <h1 className={styles.title}>{labModule.label}</h1>
        <p className={styles.text}>{labModule.summary}</p>
        <div className={styles.actions}>
          <Link href={labModule.currentHref} className={styles.primaryAction}>
            Open current module
          </Link>
          <Link href="/v2" className={styles.secondaryAction}>
            Back to V2 home
          </Link>
        </div>
      </section>

      <section className={styles.grid}>
        <article className={styles.card}>
          <h2 className={styles.cardTitle}>Workflow</h2>
          <ul className={styles.list}>
            {labModule.workflow.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
        </article>

        <article className={styles.card}>
          <h2 className={styles.cardTitle}>Signals</h2>
          <ul className={styles.list}>
            {labModule.metrics.map((metric) => (
              <li key={metric.label}>
                <strong>{metric.label}:</strong> {metric.value}
              </li>
            ))}
          </ul>
        </article>

        <article className={styles.card}>
          <h2 className={styles.cardTitle}>Next passes</h2>
          <ul className={styles.list}>
            {labModule.checklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      </section>
    </div>
  );
}
