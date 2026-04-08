import Image from "next/image";
import Link from "next/link";
import { labModules } from "./content";
import styles from "./v2.module.css";

export function V2Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.frame}>
      <header className={styles.topbar}>
        <Link href="/v2" className={styles.brand}>
          <span className={styles.brandMark}>
            <Image
              src="/brand/truckers-unidos-logo.png"
              alt="Truckers Unidos"
              width={40}
              height={40}
            />
          </span>
          <span className={styles.brandCopy}>
            <span className={styles.brandEyebrow}>EWALL visual lab</span>
            <span className={styles.brandTitle}>Truckers Unidos V2</span>
          </span>
        </Link>

        <nav className={styles.topnav} aria-label="V2 sections">
          {labModules.map((module) => (
            <Link
              key={module.slug}
              href={`/v2/modules/${module.slug}`}
              className={styles.navLink}
            >
              {module.label}
            </Link>
          ))}
        </nav>

        <div className={styles.topActions}>
          <Link href="/" className={styles.secondaryAction}>
            Current site
          </Link>
          <Link href="/settings" className={styles.primaryAction}>
            Current app
          </Link>
        </div>
      </header>

      <div className={styles.noticeBar}>
        <span className={styles.noticePill}>V2</span>
        <p className={styles.noticeText}>
          This redesign lives in its own workspace and route family, so the
          current application stays untouched while we experiment.
        </p>
      </div>

      <main className={styles.page}>{children}</main>

      <footer className={styles.footer}>
        <p className={styles.footerTitle}>Experimental workspace</p>
        <p className={styles.footerText}>
          Source lives in the root <code className={styles.inlineCode}>v2/</code>{" "}
          folder and is exposed through the new{" "}
          <code className={styles.inlineCode}>/v2</code> routes.
        </p>
      </footer>
    </div>
  );
}
