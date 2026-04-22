import type { Metadata } from "next";
import styles from "./layout.module.css";
import LayoutWrap from "./components/layout/LayoutWrap";
import { getBillingSettings } from "@/lib/services/billing-settings.service";

export const metadata: Metadata = {
  title: "Dashboard | Truckers Unidos",
  description: "Truckers Unidos dashboard.",
};

export default async function V2Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const billingSettings = await getBillingSettings();

  return <div className={styles.theme}>
    <div className={styles.shell}>
      <LayoutWrap subscriptionsEnabled={billingSettings.subscriptionsEnabled}>
        {children}
      </LayoutWrap>
    </div>
    </div>;
}
