"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import AdvertisingSlider from "./components/advertising/AdvertisingSlider";
import TrucksDropdown from "./components/trucks/TrucksDropdown";
import CompanyInfoPanel from "./components/ui/CompanyInfo";
import DataTable from "./components/ui/DataTable";
import StaffFilingsClient from "./staff-filings-client";
import { adSlides, companyInfo, tableData, trucksData } from "../../data";
import styles from "./page.module.css";
import type { AdSlide } from "@/lib/types";

export default function AdminPage() {
  const { data: session, status } = useSession();
  const [managedSlides, setManagedSlides] = useState<AdSlide[]>([]);
  const roles = Array.isArray(session?.user?.roles) ? session.user.roles : [];

  const isStaffOnly = roles.includes("STAFF") && !roles.includes("ADMIN");

  useEffect(() => {
    let active = true;

    fetch("/api/v1/news-updates?audience=ADMIN", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload: { slides?: AdSlide[] }) => {
        if (active && Array.isArray(payload.slides)) {
          setManagedSlides(payload.slides);
        }
      })
      .catch(() => {
        if (active) setManagedSlides([]);
      });

    return () => {
      active = false;
    };
  }, []);

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
        <AdvertisingSlider slides={managedSlides.length > 0 ? managedSlides : adSlides} />
      </div>

      <TrucksDropdown trucks={trucksData} />
      <DataTable data={tableData} searchQuery="" />
    </div>
  );
}
