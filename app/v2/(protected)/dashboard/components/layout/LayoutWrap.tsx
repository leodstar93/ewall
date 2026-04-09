"use client";

import { useState, type ReactNode } from "react";
import { useSession } from "next-auth/react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import styles from "./LayoutWrap.module.css";
import { hasPermission } from "@/lib/rbac-core";
import { ImpersonationBanner } from "@/app/v2/components/auth/ImpersonationBanner";

interface Props {
  children: ReactNode;
}

type NavItem = {
  href: string;
  label: string;
  permission?: string;
};

type NavGroup = {
  heading: string;
  items: NavItem[];
};

export type { NavGroup, NavItem };

function buildNavGroups(
  roles: string[],
  permissions: string[],
  _isAdmin: boolean,
  _isStaff: boolean,
): NavGroup[] {
  const groups: NavGroup[] = [
    {
      heading: "Principal",
      items: [
        { href: "/v2/dashboard", label: "Dashboard" },
        {
          href: "/v2/dashboard/profile",
          label: "Profile",
          permission: "settings:read",
        },
        {
          href: "/v2/dashboard/payments",
          label: "Payments",
          permission: "billing:manage",
        },
        {
          href: "/v2/dashboard/integrations",
          label: "ELD Integrations",
          permission: "eld:connect",
        },
      ],
    },
  ];

  const workspaceItems: NavItem[] = [
    {
      href: "/v2/dashboard/documents",
      label: "Documents",
      permission: "documents:read",
    },
    {
      href: "/v2/dashboard/ifta-v2",
      label: "IFTA Automation",
      permission: "ifta:read",
    },
    {
      href: "/v2/dashboard/ucr",
      label: "UCR",
      permission: "ucr:read_own",
    },
  ].filter((item) => {
    if (!item.permission) return true;
    return hasPermission(permissions, roles, item.permission);
  });

  if (workspaceItems.length > 0) {
    groups.push({ heading: "Workspace", items: workspaceItems });
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
