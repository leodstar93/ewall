import type { Metadata } from "next";
import styles from "./layout.module.css";

export const metadata: Metadata = {
  title: "Dashboard USA",
  description: "Panel de administracion con tema USA",
};

export default function V2Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className={styles.theme}>{children}</div>;
}
