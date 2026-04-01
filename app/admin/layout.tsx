"use client";

import Image from "next/image";
import Link from "next/link";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { ImpersonationBanner } from "@/components/auth/ImpersonationBanner";
import {
  SidebarNavIcon,
  resolveSidebarIcon,
} from "@/components/navigation/SidebarNavIcon";
import { useSidebarPreference } from "@/components/navigation/useSidebarPreference";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { STAFF_ADMIN_FEATURE_MODULES } from "@/lib/rbac-feature-modules";
import { hasPermission } from "@/lib/rbac-core";
import styles from "../console-theme.module.css";

interface AdminLayoutProps {
  children: ReactNode;
}

type NavItem = {
  href: string;
  label: string;
  permission?: string;
  moduleKey?: string;
};

type NavGroup = {
  heading: string;
  items: NavItem[];
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function titleFromPath(pathname: string | null) {
  if (!pathname) return "Admin";
  if (pathname === "/admin") return "Dashboard";
  if (pathname.startsWith("/admin/profile")) return "Profile";
  if (pathname === "/admin/settings") return "Settings";
  if (pathname.startsWith("/admin/settings/billing")) return "Billing Settings";
  if (pathname.startsWith("/admin/settings/2290")) return "Form 2290 Settings";
  if (pathname.startsWith("/admin/settings/ifta-tax-rates")) return "IFTA Tax Rates";
  if (pathname.startsWith("/admin/settings/ucr-rates")) return "UCR Rates";
  if (pathname.startsWith("/admin/settings/ucr")) return "UCR Settings";
  if (pathname.startsWith("/admin/sandbox")) return "Sandbox";
  if (pathname.startsWith("/admin/users")) return "Users";
  if (pathname.startsWith("/admin/roles")) return "Roles";
  if (pathname.startsWith("/admin/permissions")) return "Permissions";
  if (pathname.startsWith("/admin/features/documents")) return "Documents";
  if (pathname.startsWith("/admin/features/ifta")) return "IFTA";
  if (pathname.startsWith("/admin/features/ucr")) return "UCR";
  if (pathname.startsWith("/admin/features/dmv")) return "DMV Renewals";
  if (pathname.startsWith("/admin/features/2290")) return "Form 2290";
  const last = pathname.split("/").filter(Boolean).pop() ?? "Admin";
  return last.charAt(0).toUpperCase() + last.slice(1);
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const { isSidebarCollapsed, sidebarPreference, toggleSidebar } = useSidebarPreference();

  const roles = Array.isArray(session?.user?.roles) ? session.user.roles : [];
  const permissions = Array.isArray(session?.user?.permissions)
    ? session.user.permissions
    : [];
  const isAdmin = roles.includes("ADMIN");
  const isStaff = roles.includes("STAFF");
  const isStaffOnly = isStaff && !isAdmin;
  const isSandboxRoute = Boolean(pathname?.startsWith("/admin/sandbox"));
  const canAccessSandboxRoute =
    isSandboxRoute &&
    (!isStaffOnly &&
      (isAdmin ||
      permissions.includes("sandbox:access") ||
      permissions.includes("sandbox:manage")));
  const canAccessAdminShell = !pathname || isAdmin || isStaff || canAccessSandboxRoute;
  const roleBadge = isAdmin ? "ADMIN" : isStaff ? "STAFF" : "USER";
  const homeHref = isAdmin || isStaff ? "/admin" : "/panel";
  const profileHref = "/admin/profile";
  const consoleLabel = isAdmin ? "Admin" : isStaff ? "Staff" : "Admin";
  const consoleSubtitle = isAdmin ? "Admin Console" : "Staff Console";

  const initials = useMemo(() => {
    const name = session?.user?.name?.trim();
    if (!name) return "A";
    const parts = name.split(/\s+/).slice(0, 2);
    return parts.map((part) => part[0]?.toUpperCase()).join("");
  }, [session?.user?.name]);

  const pageTitle = useMemo(() => titleFromPath(pathname), [pathname]);
  const workspaceHeading = isAdmin ? "Workspace" : "Staff Workspace";

  const navigationGroups = (() => {
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
          { href: "/admin/settings", label: "Settings", permission: "settings:read" },
          { href: "/admin/users", label: "Users", permission: "users:read" },
          { href: "/admin/roles", label: "Roles", permission: "roles:read" },
          { href: "/admin/permissions", label: "Permissions", permission: "permissions:read" },
        ],
      });
    }

  const workspaceItems: NavItem[] = [
      {
        href: "/admin/features/documents",
        label: "Documents",
        permission: "documents:read",
        moduleKey: "documents",
      },
      {
        href: "/admin/features/ifta",
        label: "IFTA",
        permission: "ifta:read",
        moduleKey: "ifta",
      },
      {
        href: "/admin/features/ucr",
        label: "UCR",
        permission: "ucr:read",
        moduleKey: "ucr",
      },
      {
        href: "/admin/features/dmv/renewals",
        label: "DMV Renewals",
        permission: "dmv:read",
        moduleKey: "dmv",
      },
      {
        href: "/admin/features/2290",
        label: "Form 2290",
        permission: "compliance2290:view",
        moduleKey: "compliance2290",
      },
    ].filter((item) => {
      if (!item.permission) return true;

      const hasExplicitAccess = hasPermission(permissions, roles, item.permission);
      const hasStaffFeatureAccess =
        isStaff && Boolean(item.moduleKey) && STAFF_ADMIN_FEATURE_MODULES.has(item.moduleKey);

      return hasExplicitAccess || hasStaffFeatureAccess;
    });

    if (workspaceItems.length > 0) {
      groups.push({
        heading: workspaceHeading,
        items: workspaceItems,
      });
    }

    const sandboxItems: NavItem[] = [];
    if (
      isAdmin &&
      (hasPermission(permissions, roles, "sandbox:access") ||
        hasPermission(permissions, roles, "sandbox:manage"))
    ) {
      sandboxItems.push({ href: "/admin/sandbox", label: "Sandbox" });
    }

    if (sandboxItems.length > 0) {
      groups.push({
        heading: isAdmin ? "Sandbox" : "Tools",
        items: sandboxItems,
      });
    }

    return groups;
  })();

  useEffect(() => {
    if (!pathname) return;
    if (status === "unauthenticated") router.replace("/login");
    if (status === "authenticated" && !canAccessAdminShell) router.replace("/panel");
  }, [status, canAccessAdminShell, pathname, router]);

  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      if (!userMenuOpen) return;
      const element = menuRef.current;
      if (element && !element.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setUserMenuOpen(false);
    };

    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [userMenuOpen]);

  const navItemClass = (href: string) => {
    const active =
      pathname === href || (href !== "/admin" && pathname?.startsWith(href));
    return cx(styles.navItem, active && styles.navItemActive);
  };

  const handleLogout = async () => {
    await signOut({ callbackUrl: "/" });
  };

  if (status === "loading" || !pathname) {
    return (
      <div className={styles.consoleLoading}>
        <div className={styles.loadingCard}>
          <div className="h-6 w-40 rounded bg-zinc-100 animate-pulse" />
          <div className="mt-6 space-y-3">
            <div className="h-3 w-full rounded bg-zinc-100 animate-pulse" />
            <div className="h-3 w-5/6 rounded bg-zinc-100 animate-pulse" />
            <div className="h-3 w-2/3 rounded bg-zinc-100 animate-pulse" />
          </div>
          <div className="mt-6 h-10 w-full rounded-xl bg-zinc-100 animate-pulse" />
        </div>
      </div>
    );
  }

  if (status !== "authenticated" || !canAccessAdminShell) return null;

  return (
    <div className={styles.consoleShell}>
      <div
        className={cx(
          styles.shellGrid,
          sidebarPreference === "collapsed" && styles.shellGridCollapsed,
          sidebarPreference === "expanded" && styles.shellGridExpanded,
        )}
      >
        <aside className={styles.sidebar}>
          <div className={styles.sidebarInner}>
            <div className={styles.sidebarBrand}>
              <Link href={homeHref} className={styles.brandLink}>
                <Image
                  src="/brand/truckers-unidos-logo.png"
                  alt="Truckers Unidos logo"
                  width={64}
                  height={64}
                  className={styles.brandLogo}
                />
                <div className={styles.brandText}>
                  <div className={styles.brandTitle}>Truckers Unidos</div>
                  <div className={styles.brandSubtitle}>{consoleSubtitle}</div>
                </div>
              </Link>

              <div className={styles.brandActions}>
                <span className={styles.roleBadge}>{roleBadge}</span>
                <button
                  type="button"
                  onClick={toggleSidebar}
                  className={styles.sidebarToggle}
                  aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                  title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path
                      d="M4 4.75C4 4.336 4.336 4 4.75 4H6.5C6.914 4 7.25 4.336 7.25 4.75V15.25C7.25 15.664 6.914 16 6.5 16H4.75C4.336 16 4 15.664 4 15.25V4.75Z"
                      fill="currentColor"
                    />
                    <path
                      d="M9.75 5.25C9.75 4.836 10.086 4.5 10.5 4.5H15.25C15.664 4.5 16 4.836 16 5.25V6C16 6.414 15.664 6.75 15.25 6.75H10.5C10.086 6.75 9.75 6.414 9.75 6V5.25Z"
                      fill="currentColor"
                      opacity=".9"
                    />
                    <path
                      d="M9.75 9.625C9.75 9.211 10.086 8.875 10.5 8.875H15.25C15.664 8.875 16 9.211 16 9.625V10.375C16 10.789 15.664 11.125 15.25 11.125H10.5C10.086 11.125 9.75 10.789 9.75 10.375V9.625Z"
                      fill="currentColor"
                      opacity=".72"
                    />
                    <path
                      d="M9.75 14C9.75 13.586 10.086 13.25 10.5 13.25H15.25C15.664 13.25 16 13.586 16 14V14.75C16 15.164 15.664 15.5 15.25 15.5H10.5C10.086 15.5 9.75 15.164 9.75 14.75V14Z"
                      fill="currentColor"
                      opacity=".55"
                    />
                  </svg>
                </button>
              </div>
            </div>

            <nav className={styles.sidebarScroll}>
              {navigationGroups.map((group, groupIndex) => (
                <div
                  key={group.heading}
                  className={groupIndex === 0 ? undefined : styles.navGroup}
                >
                  <div
                    className={cx(
                      styles.navHeading,
                      groupIndex > 0 && styles.navGroup,
                    )}
                  >
                    {group.heading}
                  </div>
                  <div className={styles.navSection}>
                    {group.items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={navItemClass(item.href)}
                        title={item.label}
                      >
                        <span className={styles.navIconWrap} aria-hidden="true">
                          <SidebarNavIcon
                            name={resolveSidebarIcon({
                              href: item.href,
                              label: item.label,
                              section: group.heading,
                            })}
                            className={styles.navIcon}
                          />
                        </span>
                        <span className={styles.navLabel}>{item.label}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </nav>

            <div className={styles.sidebarFooter}>
              <div ref={menuRef} className="relative">
                <button
                  onClick={() => setUserMenuOpen((current) => !current)}
                  className={styles.accountButton}
                >
                  <div className="flex items-center gap-3">
                    <div className={styles.accountAvatar}>{initials}</div>
                    <div className={styles.accountMeta}>
                      <div className={`${styles.accountName} truncate`}>
                        {session?.user?.name || roleBadge}
                      </div>
                      <div className={`${styles.accountEmail} truncate`}>
                        {session?.user?.email || "admin@example.com"}
                      </div>
                    </div>
                    <svg
                      className={cx(
                        "h-4 w-4 text-zinc-500 transition-transform",
                        userMenuOpen && "rotate-180",
                      )}
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                </button>

                {userMenuOpen && (
                  <div className={styles.dropdown}>
                    <Link
                      href={profileHref}
                      className={styles.dropdownLink}
                      onClick={() => setUserMenuOpen(false)}
                    >
                      My profile
                    </Link>
                    <button
                      onClick={handleLogout}
                      className={styles.dropdownButton}
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>

              <div className={styles.footerMeta}>
                (c) {new Date().getFullYear()} Truckers Unidos
              </div>
            </div>
          </div>
        </aside>

        <div className={styles.mainWrap}>
          <header className={styles.topbar}>
            <div className={styles.topbarInner}>
              <div className="min-w-0">
                <div className={styles.breadcrumb}>
                  {consoleLabel} <span className="mx-1">/</span>{" "}
                  <span className={styles.breadcrumbCurrent}>{pageTitle}</span>
                </div>
                <h1 className={styles.pageTitle}>{pageTitle}</h1>
              </div>

              <div className={styles.topActions}>
                <div className={styles.searchMock}>
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M8.5 3.5a5 5 0 103.14 8.9l3.48 3.48a.75.75 0 101.06-1.06l-3.48-3.48A5 5 0 008.5 3.5zM5 8.5a3.5 3.5 0 117 0 3.5 3.5 0 01-7 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="select-none">Search or type command...</span>
                  <span className={styles.searchKey}>Ctrl K</span>
                </div>

                <NotificationBell />

                <Link href={profileHref} className={styles.quickProfile}>
                  <div className={styles.quickAvatar}>{initials}</div>
                  <span className={styles.quickName}>
                    {session?.user?.name?.split(" ")[0] || roleBadge}
                  </span>
                </Link>
              </div>
            </div>
          </header>

          <main className={styles.contentWrap}>
            <div className={styles.contentCard}>
              <div className={styles.contentInner}>
                {session?.impersonation?.isActive ? (
                  <ImpersonationBanner
                    actorName={session.impersonation.actorName}
                    actorEmail={session.impersonation.actorEmail}
                  />
                ) : null}
                {children}
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
