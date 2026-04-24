import type { Metadata } from "next";
import styles from "./layout.module.css";
import LayoutWrap from "./components/layout/LayoutWrap";

export const metadata: Metadata = {
  title: "Admin | Truckers Unidos",
  description: "Truckers Unidos admin panel.",
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
