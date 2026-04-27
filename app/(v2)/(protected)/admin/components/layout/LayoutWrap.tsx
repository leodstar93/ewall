"use client";

import { useState, type ReactNode } from "react";
import { useSession } from "next-auth/react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import styles from "./LayoutWrap.module.css";
import AdminRecentAccessTracker from "./AdminRecentAccessTracker";
import { hasPermission } from "@/lib/rbac-core";
import { STAFF_ADMIN_FEATURE_MODULES } from "@/lib/rbac-feature-modules";
import { ImpersonationBanner } from "@/app/(v2)/components/auth/ImpersonationBanner";

interface Props {
  children: ReactNode;
}

type NavItem = {
  href: string;
  label: string;
  permission?: string;
  moduleKey?: string;
  allowStaff?: boolean;
};

type NavGroup = {
  heading: string;
  items: NavItem[];
};

export type { NavGroup, NavItem };

function buildNavGroups(
  roles: string[],
  permissions: string[],
  isAdmin: boolean,
  isStaff: boolean,
): NavGroup[] {
  const groups: NavGroup[] = [
    {
      heading: "Overview",
      items: [{ href: "/admin", label: "Dashboard" }],
    },
  ];

  if (isAdmin) {
    groups.push({
      heading: "Access Control",
      items: [
        {
          href: "/admin/settings",
          label: "Settings",
          permission: "settings:read",
        },
        { href: "/admin/users", label: "Users", permission: "users:read" },
        { href: "/admin/roles", label: "Roles", permission: "roles:read" },
        {
          href: "/admin/permissions",
          label: "Permissions",
          permission: "permissions:read",
        },
      ],
    });
  }

  const workspaceItems: NavItem[] = [
    {
      href: "/admin/truckers",
      label: "Clients",
      permission: "truck:read",
      moduleKey: "truck",
      allowStaff: true,
    },
    {
      href: "/admin/documents",
      label: "Documents",
      permission: "documents:read",
      moduleKey: "documents",
    },
    {
      href: "/admin/features/ifta-v2",
      label: "IFTA",
      permission: "ifta:review",
      moduleKey: "ifta",
    },
    {
      href: "/admin/features/ucr",
      label: "UCR",
      permission: "ucr:read",
      moduleKey: "ucr",
    },
  ].filter((item) => {
    if (!item.permission) return true;
    const hasExplicitAccess = hasPermission(
      permissions,
      roles,
      item.permission,
    );
    const hasStaffFeatureAccess =
      isStaff &&
      Boolean(item.moduleKey) &&
      STAFF_ADMIN_FEATURE_MODULES.has(item.moduleKey);
    const hasStaffRouteAccess = isStaff && Boolean(item.allowStaff);
    return hasExplicitAccess || hasStaffFeatureAccess || hasStaffRouteAccess;
  });

  if (workspaceItems.length > 0) {
    const workspaceHeading = isAdmin ? "Workspace" : "Staff Workspace";
    groups.push({ heading: workspaceHeading, items: workspaceItems });
  }

  return groups;
}

export default function LayoutWrap({ children }: Props) {
  const { data: session } = useSession();
  const [collapsed, setCollapsed] = useState(false);

  const roles = Array.isArray(session?.user?.roles) ? session.user.roles : [];
  const permissions = Array.isArray(session?.user?.permissions) ? session.user.permissions : [];
  const isAdmin = roles.includes("ADMIN");
  const isStaff = roles.includes("STAFF");

  const navGroups = buildNavGroups(roles, permissions, isAdmin, isStaff);

  return (
    <div className={styles.wrapper}>
      <AdminRecentAccessTracker navGroups={navGroups} />
      <div className={styles.accentBar} />
      <div className={styles.body}>
        <Sidebar collapsed={collapsed} navGroups={navGroups} />
        <div className={styles.main}>
          <Topbar
            onToggleSidebar={() => setCollapsed((current) => !current)}
            navGroups={navGroups}
          />
          {session?.impersonation?.isActive ? (
            <ImpersonationBanner
              actorName={session.impersonation.actorName}
              actorEmail={session.impersonation.actorEmail}
            />
          ) : null}
          {children}
        </div>
      </div>
    </div>
  );
}
