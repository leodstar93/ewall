"use client";

import { useEffect, useState } from "react";
import AdvertisingSlider from "./components/advertising/AdvertisingSlider";
import Sidebar from "./components/layout/Sidebar";
import Topbar from "./components/layout/Topbar";
import TrucksDropdown from "./components/trucks/TrucksDropdown";
import CompanyInfoPanel from "./components/ui/CompanyInfo";
import DataTable from "./components/ui/DataTable";
import { adSlides, companyInfo, tableData, trucksData } from "./data";
import styles from "./page.module.css";
import type { AdSlide } from "@/lib/types";

export default function DashboardPage() {
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState("");
  const [managedSlides, setManagedSlides] = useState<AdSlide[]>([]);

  useEffect(() => {
    let active = true;

    fetch("/api/v1/news-updates?audience=PUBLIC", { cache: "no-store" })
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

  return (
    <div className={styles.shell}>
      <div className={styles.accentBar} />
      <div className={styles.body}>
        <Sidebar collapsed={collapsed} />
        <div className={styles.main}>
          <Topbar
            onToggleSidebar={() => setCollapsed((current) => !current)}
            searchValue={search}
            onSearch={setSearch}
          />
          <div className={styles.content}>
            <div className={styles.topPanels}>
              <CompanyInfoPanel data={companyInfo} />
              <AdvertisingSlider slides={managedSlides.length > 0 ? managedSlides : adSlides} />
            </div>

            <TrucksDropdown trucks={trucksData} />
            <DataTable data={tableData} searchQuery={search} />
          </div>
        </div>
      </div>
    </div>
  );
}
