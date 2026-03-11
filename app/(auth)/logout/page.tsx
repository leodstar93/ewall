"use client";

import { signOut } from "next-auth/react";
import { useEffect } from "react";
import styles from "../auth.module.css";

export default function LogoutPage() {
  useEffect(() => {
    const performLogout = async () => {
      await signOut({ callbackUrl: "/" });
    };

    performLogout();
  }, []);

  return (
    <div className={styles.statusPage}>
      <h2 className={styles.statusTitle}>Signing out...</h2>
      <p className={styles.statusText}>You will be redirected shortly.</p>
    </div>
  );
}
