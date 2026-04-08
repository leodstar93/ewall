import Link from "next/link";
import type { CSSProperties } from "react";
import {
  labHeroMetrics,
  labMilestones,
  labModules,
  labPrinciples,
} from "./content";
import styles from "./v2.module.css";

export function V2HomePage() {
  return (
    <div className={styles.stack}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.heroKicker}>New visual direction</span>
          <h1 className={styles.heroTitle}>
            A separate V2 space to rebuild the product language from zero.
          </h1>
          <p className={styles.heroLead}>
            This lab starts fresh with a more editorial, high-contrast, and
            operations-driven interface. We can test layout, hierarchy,
            navigation, cards, and module identity here without touching the
            current experience.
          </p>

          <div className={styles.heroActions}>
            <Link
              href={`/v2/modules/${labModules[1]?.slug ?? "ifta-v2"}`}
              className={styles.primaryAction}
            >
              Explore first module
            </Link>
            <Link href="#modules" className={styles.secondaryAction}>
              Browse module previews
            </Link>
          </div>

          <div className={styles.heroMetrics}>
            {labHeroMetrics.map((metric) => (
              <div key={metric.label} className={styles.metricPill}>
                <span className={styles.metricLabel}>{metric.label}</span>
                <span className={styles.metricValue}>{metric.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.previewPanel}>
          <div className={styles.previewHeader}>
            <span className={styles.previewBadge}>Command surface</span>
            <h2 className={styles.previewTitle}>What the V2 shell is aiming for</h2>
          </div>

          <div className={styles.previewGrid}>
            <article className={styles.previewCard}>
              <span className={styles.previewLabel}>Priority lane</span>
              <strong className={styles.previewValue}>IFTA review block</strong>
              <p className={styles.previewNote}>
                Filing states, exceptions, and approvals sit above the fold.
              </p>
            </article>

            <article className={styles.previewCard}>
              <span className={styles.previewLabel}>Navigation rail</span>
              <strong className={styles.previewValue}>Module-first</strong>
              <p className={styles.previewNote}>
                Each area gets its own identity without losing platform
                consistency.
              </p>
            </article>

            <article className={styles.previewCard}>
              <span className={styles.previewLabel}>Surface system</span>
              <strong className={styles.previewValue}>Warm glass cards</strong>
              <p className={styles.previewNote}>
                Elevated layers replace the flat gray admin feel.
              </p>
            </article>

            <article className={styles.previewCard}>
              <span className={styles.previewLabel}>Reading rhythm</span>
              <strong className={styles.previewValue}>Big, direct, scanable</strong>
              <p className={styles.previewNote}>
                Headings and status clusters lead before tables and details.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className={styles.section} id="modules">
        <div className={styles.sectionIntro}>
          <span className={styles.sectionKicker}>Module previews</span>
          <h2 className={styles.sectionTitle}>
            Each module can now evolve inside the V2 sandbox.
          </h2>
          <p className={styles.sectionLead}>
            These cards are not replacing the current app yet. They are visual
            testbeds that let us shape the next shell and module language in a
            controlled area.
          </p>
        </div>

        <div className={styles.moduleGrid}>
          {labModules.map((module) => (
            <article
              key={module.slug}
              className={styles.moduleCard}
              style={
                {
                  "--module-accent": module.accent,
                  "--module-accent-soft": module.accentSoft,
                  "--module-accent-ink": module.accentInk,
                } as CSSProperties
              }
            >
              <div className={styles.moduleTop}>
                <div>
                  <span className={styles.moduleEyebrow}>{module.eyebrow}</span>
                  <h3 className={styles.moduleTitle}>{module.label}</h3>
                </div>
                <span className={styles.moduleStatus}>{module.status}</span>
              </div>

              <p className={styles.moduleSummary}>{module.summary}</p>

              <div className={styles.moduleMetrics}>
                {module.metrics.map((metric) => (
                  <div key={metric.label} className={styles.moduleMetric}>
                    <span className={styles.moduleMetricLabel}>{metric.label}</span>
                    <strong className={styles.moduleMetricValue}>
                      {metric.value}
                    </strong>
                  </div>
                ))}
              </div>

              <div className={styles.moduleActions}>
                <Link
                  href={`/v2/modules/${module.slug}`}
                  className={styles.primaryAction}
                >
                  Open V2 preview
                </Link>
                <Link href={module.currentHref} className={styles.secondaryAction}>
                  Open current route
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionIntro}>
          <span className={styles.sectionKicker}>Design principles</span>
          <h2 className={styles.sectionTitle}>
            A more distinctive visual identity for the platform.
          </h2>
        </div>

        <div className={styles.principlesGrid}>
          {labPrinciples.map((principle) => (
            <article key={principle.title} className={styles.principleCard}>
              <h3 className={styles.principleTitle}>{principle.title}</h3>
              <p className={styles.principleText}>{principle.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionIntro}>
          <span className={styles.sectionKicker}>Migration path</span>
          <h2 className={styles.sectionTitle}>
            Build safely now, decide later if it replaces the current app.
          </h2>
        </div>

        <div className={styles.roadmapGrid}>
          {labMilestones.map((milestone) => (
            <article key={milestone.step} className={styles.roadmapCard}>
              <span className={styles.roadmapStep}>{milestone.step}</span>
              <h3 className={styles.roadmapTitle}>{milestone.title}</h3>
              <p className={styles.roadmapText}>{milestone.text}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
