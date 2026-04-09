"use client";

import { useState, type ReactNode } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import styles from "./LayoutWrap.module.css";

interface Props {
  children: ReactNode;
}

export default function LayoutWrap({ children }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState("");

  return (
    <div className={styles.wrapper}>
      <div className={styles.accentBar} />
      <div className={styles.body}>
        <Sidebar collapsed={collapsed} />
        <div className={styles.main}>
          <Topbar
            onToggleSidebar={() => setCollapsed((current) => !current)}
            searchValue={search}
            onSearch={setSearch}
          />
          {children}
        </div>
      </div>
    </div>
  );
}
