import type { ReactNode } from "react";
import AdminLayout from "../admin/layout";

export default function DashboardStaffLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <AdminLayout>{children}</AdminLayout>;
}
