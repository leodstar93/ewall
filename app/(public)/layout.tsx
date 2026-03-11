import Link from "next/link";
import Image from "next/image";
import { Barlow_Condensed, Lora, Source_Sans_3 } from "next/font/google";
import styles from "./public.module.css";

const headingFont = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-public-heading",
});

const bodyFont = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-public-body",
});

const accentFont = Lora({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["italic", "normal"],
  variable: "--font-public-accent",
});

const navigation = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About Us" },
  { href: "/programs", label: "Programs" },
  { href: "/resources", label: "Resources" },
  { href: "/community", label: "Community" },
  { href: "/donate", label: "Donate" },
  { href: "/contact", label: "Contact" },
];

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${styles.publicShell} ${headingFont.variable} ${bodyFont.variable} ${accentFont.variable}`}
    >
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/" className={styles.brandLink}>
            <Image
              src="/brand/truckers-unidos-logo.png"
              alt="Truckers Unidos logo"
              width={96}
              height={96}
              className={styles.brandLogo}
              priority
            />
            <div>
              <p className={styles.brandName}>Truckers Unidos</p>
              <p className={styles.brandTagline}>Proud to Drive America</p>
            </div>
          </Link>

          <nav className={styles.desktopNav} aria-label="Main navigation">
            {navigation.map((item) => (
              <Link key={item.href} href={item.href} className={styles.navLink}>
                {item.label}
              </Link>
            ))}
          </nav>

          <div className={styles.headerActions}>
            <Link href="/login" className={`${styles.button} ${styles.secondaryButton}`}>
              Member Login
            </Link>
            <Link href="/donate" className={`${styles.button} ${styles.primaryButton}`}>
              Donate
            </Link>
          </div>

          <details className={styles.mobileMenu}>
            <summary className={styles.mobileMenuTrigger}>Menu</summary>
            <div className={styles.mobileMenuPanel}>
              {navigation.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={styles.mobileNavLink}
                >
                  {item.label}
                </Link>
              ))}
              <div className={styles.mobileMenuActions}>
                <Link
                  href="/login"
                  className={`${styles.button} ${styles.secondaryButton}`}
                >
                  Member Login
                </Link>
                <Link
                  href="/donate"
                  className={`${styles.button} ${styles.primaryButton}`}
                >
                  Donate
                </Link>
              </div>
            </div>
          </details>
        </div>
      </header>

      <main className={styles.main}>{children}</main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerBrand}>
            <p className={styles.brandName}>Truckers Unidos</p>
            <p className={styles.footerMission}>
              Truckers Unidos is a nonprofit organization supporting trucking
              businesses, owner-operators, and drivers through education,
              resources, and community.
            </p>
          </div>

          <div className={styles.footerLinks}>
            <div>
              <p className={styles.footerColumnTitle}>Explore</p>
              <ul className={styles.footerList}>
                <li>
                  <Link href="/" className={styles.footerLink}>
                    Home
                  </Link>
                </li>
                <li>
                  <Link href="/about" className={styles.footerLink}>
                    About
                  </Link>
                </li>
                <li>
                  <Link href="/programs" className={styles.footerLink}>
                    Programs
                  </Link>
                </li>
                <li>
                  <Link href="/resources" className={styles.footerLink}>
                    Resources
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className={styles.footerColumnTitle}>Get Involved</p>
              <ul className={styles.footerList}>
                <li>
                  <Link href="/community" className={styles.footerLink}>
                    Community
                  </Link>
                </li>
                <li>
                  <Link href="/donate" className={styles.footerLink}>
                    Donate
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className={styles.footerLink}>
                    Contact
                  </Link>
                </li>
                <li>
                  <Link href="/login" className={styles.footerLink}>
                    Member Login
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className={styles.footerColumnTitle}>Follow</p>
              <div className={styles.socialRow}>
                <span className={styles.socialChip}>Facebook</span>
                <span className={styles.socialChip}>Instagram</span>
                <span className={styles.socialChip}>LinkedIn</span>
              </div>
            </div>
          </div>

          <p className={styles.footerBottom}>
            © {new Date().getFullYear()} Truckers Unidos. One Industry. One
            Community.
          </p>
        </div>
      </footer>
    </div>
  );
}
