import Link from "next/link";
import type { CSSProperties } from "react";
import { labModules, type LabModule } from "./content";
import styles from "./v2.module.css";

type V2ModulePageProps = {
  module: LabModule;
};

export function V2ModulePage({ module }: V2ModulePageProps) {
  const relatedModules = labModules.filter((item) => item.slug !== module.slug);

  return (
    <div className={styles.stack}>
      <section
        className={styles.detailHero}
        style={
          {
            "--module-accent": module.accent,
            "--module-accent-soft": module.accentSoft,
            "--module-accent-ink": module.accentInk,
          } as CSSProperties
        }
      >
        <div className={styles.detailHead}>
          <span className={styles.sectionKicker}>{module.eyebrow}</span>
          <h1 className={styles.detailTitle}>{module.label}</h1>
          <p className={styles.detailSummary}>{module.summary}</p>

          <div className={styles.heroActions}>
            <Link href={module.currentHref} className={styles.primaryAction}>
              Open current module
            </Link>
            <Link href="/v2" className={styles.secondaryAction}>
              Back to V2 home
            </Link>
          </div>
        </div>

        <div className={styles.signalGrid}>
          {module.signals.map((signal) => (
            <article key={signal.label} className={styles.signalPanel}>
              <span className={styles.previewLabel}>{signal.label}</span>
              <strong className={styles.previewValue}>{signal.value}</strong>
              <p className={styles.previewNote}>{signal.note}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.detailGrid}>
        <article className={styles.detailSection}>
          <div className={styles.sectionIntro}>
            <span className={styles.sectionKicker}>Workflow</span>
            <h2 className={styles.sectionTitle}>How this module should feel in V2</h2>
          </div>

          <div className={styles.workflowList}>
            {module.workflow.map((step, index) => (
              <div key={step} className={styles.workflowItem}>
                <span className={styles.workflowNumber}>
                  {(index + 1).toString().padStart(2, "0")}
                </span>
                <p className={styles.workflowText}>{step}</p>
              </div>
            ))}
          </div>
        </article>

        <article className={styles.detailSection}>
          <div className={styles.sectionIntro}>
            <span className={styles.sectionKicker}>Signals</span>
            <h2 className={styles.sectionTitle}>Metrics to anchor the redesign</h2>
          </div>

          <div className={styles.moduleMetrics}>
            {module.metrics.map((metric) => (
              <div key={metric.label} className={styles.moduleMetric}>
                <span className={styles.moduleMetricLabel}>{metric.label}</span>
                <strong className={styles.moduleMetricValue}>{metric.value}</strong>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className={styles.detailGrid}>
        <article className={styles.detailSection}>
          <div className={styles.sectionIntro}>
            <span className={styles.sectionKicker}>Next passes</span>
            <h2 className={styles.sectionTitle}>Recommended V2 tasks</h2>
          </div>

          <div className={styles.checkList}>
            {module.checklist.map((item) => (
              <div key={item} className={styles.checkItem}>
                <span className={styles.noticePill}>Task</span>
                <p className={styles.previewNote}>{item}</p>
              </div>
            ))}
          </div>
        </article>

        <article className={styles.detailSection}>
          <div className={styles.sectionIntro}>
            <span className={styles.sectionKicker}>Continue exploring</span>
            <h2 className={styles.sectionTitle}>Other module previews</h2>
          </div>

          <div className={styles.relatedGrid}>
            {relatedModules.map((item) => (
              <Link
                key={item.slug}
                href={`/v2/modules/${item.slug}`}
                className={styles.relatedCard}
              >
                <span className={styles.moduleEyebrow}>{item.eyebrow}</span>
                <strong className={styles.moduleTitle}>{item.label}</strong>
                <span className={styles.previewNote}>{item.status}</span>
              </Link>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
