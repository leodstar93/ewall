"use client";

import { useState, type ReactNode } from "react";
import { useSession } from "next-auth/react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import styles from "./LayoutWrap.module.css";
import { hasPermission } from "@/lib/rbac-core";
import { STAFF_ADMIN_FEATURE_MODULES } from "@/lib/rbac-feature-modules";
import { ImpersonationBanner } from "@/app/v2/components/auth/ImpersonationBanner";

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
      items: [{ href: "/v2/admin", label: "Dashboard" }],
    },
  ];

  if (isAdmin) {
    groups.push({
      heading: "Access Control",
      items: [
        {
          href: "/v2/admin/settings",
          label: "Settings",
          permission: "settings:read",
        },
        { href: "/v2/admin/users", label: "Users", permission: "users:read" },
        { href: "/v2/admin/roles", label: "Roles", permission: "roles:read" },
        {
          href: "/v2/admin/permissions",
          label: "Permissions",
          permission: "permissions:read",
        },
      ],
    });
  }

  const workspaceItems: NavItem[] = [
    {
      href: "/v2/admin/truckers",
      label: "Clients",
      permission: "truck:read",
      moduleKey: "truck",
      allowStaff: true,
    },
    {
      href: "/v2/admin/documents",
      label: "Documents",
      permission: "documents:read",
      moduleKey: "documents",
    },
    {
      href: "/v2/admin/features/ifta-v2",
      label: "IFTA Automation",
      permission: "ifta:review",
      moduleKey: "ifta",
    },
    {
      href: "/v2/admin/features/ucr",
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

  const sandboxItems: NavItem[] = [];
  if (
    isAdmin &&
    (hasPermission(permissions, roles, "sandbox:access") ||
      hasPermission(permissions, roles, "sandbox:manage"))
  ) {
    sandboxItems.push({ href: "/v2/admin/sandbox", label: "Sandbox" });
  }

  if (sandboxItems.length > 0) {
    groups.push({ heading: isAdmin ? "Sandbox" : "Tools", items: sandboxItems });
  }

  return groups;
}

export default function LayoutWrap({ children }: Props) {
  const { data: session } = useSession();
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState("");

  const roles = Array.isArray(session?.user?.roles) ? session.user.roles : [];
  const permissions = Array.isArray(session?.user?.permissions) ? session.user.permissions : [];
  const isAdmin = roles.includes("ADMIN");
  const isStaff = roles.includes("STAFF");

  const navGroups = buildNavGroups(roles, permissions, isAdmin, isStaff);

  return (
    <div className={styles.wrapper}>
      <div className={styles.accentBar} />
      <div className={styles.body}>
        <Sidebar collapsed={collapsed} navGroups={navGroups} />
        <div className={styles.main}>
          <Topbar
            onToggleSidebar={() => setCollapsed((current) => !current)}
            searchValue={search}
            onSearch={setSearch}
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
