import type { Metadata } from "next";
import styles from "./layout.module.css";

export const metadata: Metadata = {
  title: "Truckers Unidos",
  description: "Truckers Unidos — platform for admin operations, documents, and IFTA workflows.",
};

export default function V2Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className={styles.theme}>{children}</div>;
}
