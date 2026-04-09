import type { Metadata } from "next";
import styles from "./layout.module.css";
import LayoutWrap from "./components/layout/LayoutWrap";

export const metadata: Metadata = {
  title: "Dashboard | Truckers Unidos",
  description: "Truckers Unidos dashboard.",
};

export default function V2Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className={styles.theme}>
    <div className={styles.shell}>
      <LayoutWrap>
        {children}
      </LayoutWrap>
    </div>
    </div>;
}
