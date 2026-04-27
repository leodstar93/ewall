"use client";

import { useSession } from "next-auth/react";
import AdminDashboardClient from "./admin-dashboard-client";
import StaffFilingsClient from "./staff-filings-client";
import styles from "./page.module.css";

export default function AdminPage() {
  const { data: session, status } = useSession();
  const roles = Array.isArray(session?.user?.roles) ? session.user.roles : [];

  const isStaffOnly = roles.includes("STAFF") && !roles.includes("ADMIN");

  if (status === "loading") {
    return <div className={styles.content} />;
  }

  if (isStaffOnly) {
    return (
      <div className={styles.content}>
        <StaffFilingsClient />
      </div>
    );
  }

  return (
    <div className={styles.content}>
      <AdminDashboardClient />
    </div>
  );
}
