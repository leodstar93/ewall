"use client";

import { useSession } from "next-auth/react";
import AdvertisingSlider from "./components/advertising/AdvertisingSlider";
import TrucksDropdown from "./components/trucks/TrucksDropdown";
import CompanyInfoPanel from "./components/ui/CompanyInfo";
import DataTable from "./components/ui/DataTable";
import StaffFilingsClient from "./staff-filings-client";
import { adSlides, companyInfo, tableData, trucksData } from "../../data";
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
      <div className={styles.topPanels}>
        <CompanyInfoPanel data={companyInfo} />
        <AdvertisingSlider slides={adSlides} />
      </div>

      <TrucksDropdown trucks={trucksData} />
      <DataTable data={tableData} searchQuery="" />
    </div>
  );
}
