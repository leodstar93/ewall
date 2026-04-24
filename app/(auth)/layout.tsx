import { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import styles from "./auth.module.css";

interface AuthLayoutProps {
  children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className={styles.authShell}>
      <div className={styles.authContainer}>
        <div className={styles.authHeader}>
          <Link href="/" className={styles.authBrand}>
            <Image
              src="/brand/truckers-unidos-logo.png"
              alt="Truckers Unidos logo"
              width={96}
              height={96}
              className={styles.authLogo}
              priority
            />
            <div>
              <p className={styles.brandName}>Truckers Unidos</p>
              <p className={styles.brandTagline}>Proud to Drive America</p>
            </div>
          </Link>
          <p className={styles.authLead}>
            Secure access for sign in, invitations, and account setup.
          </p>
        </div>

        <div className={styles.authCard}>{children}</div>

        <p className={styles.authFooter}>
            By continuing, you agree to our{" "}
            <a href="/terms" className={styles.authFooterLink}>
              Terms of Service
            </a>{" "}
            and{" "}
            <a href="/privacy" className={styles.authFooterLink}>
              Privacy Policy
            </a>
        </p>
      </div>
    </div>
  );
}
