"use client";

import { useState } from "react";
import AdvertisingSlider from "./components/advertising/AdvertisingSlider";
import Sidebar from "./components/layout/Sidebar";
import Topbar from "./components/layout/Topbar";
import TrucksDropdown from "./components/trucks/TrucksDropdown";
import CompanyInfoPanel from "./components/ui/CompanyInfo";
import DataTable from "./components/ui/DataTable";
import { adSlides, companyInfo, tableData, trucksData } from "../../data";
import styles from "./page.module.css";

export default function DashboardPage() {
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState("");

  return (
    
          <div className={styles.content}>
            <div className={styles.topPanels}>
              <CompanyInfoPanel data={companyInfo} />
              <AdvertisingSlider slides={adSlides} />
            </div>

            <TrucksDropdown trucks={trucksData} />
            <DataTable data={tableData} searchQuery={search} />
          </div>
        
  );
}
