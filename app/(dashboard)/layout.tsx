"use client";

import Image from "next/image";
import Link from "next/link";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import styles from "../console-theme.module.css";

type FeatureLink = {
  name: string;
  label?: string;
  section?: string;
  order?: number;
  icon?: string;
  href: string;
  permission?: string;
  permissions?: string[];
};

type FeatureApiItem = {
  name?: unknown;
  label?: unknown;
  section?: unknown;
  order?: unknown;
  icon?: unknown;
  href?: unknown;
  permission?: unknown;
  permissions?: unknown;
};

interface DashboardLayoutProps {
  children: ReactNode;
}

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function titleFromPath(pathname: string | null) {
  if (!pathname) return "Panel";
  if (pathname === "/panel") return "Dashboard";
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/users/")) return "Settings";
  const last = pathname.split("/").filter(Boolean).pop() ?? "Panel";
  return last.charAt(0).toUpperCase() + last.slice(1);
}

function normalizeFeature(item: FeatureApiItem): FeatureLink | null {
  if (typeof item.name !== "string" || typeof item.href !== "string") {
    return null;
  }

  return {
    name: item.name,
    href: item.href,
    label: typeof item.label === "string" ? item.label : undefined,
    section: typeof item.section === "string" ? item.section : undefined,
    order: typeof item.order === "number" ? item.order : undefined,
    icon: typeof item.icon === "string" ? item.icon : undefined,
    permission: typeof item.permission === "string" ? item.permission : undefined,
    permissions: Array.isArray(item.permissions)
      ? item.permissions.filter(
          (value): value is string => typeof value === "string",
        )
      : undefined,
  };
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [featureLinks, setFeatureLinks] = useState<FeatureLink[]>([]);
  const [featuresLoading, setFeaturesLoading] = useState(true);
  const [featuresError, setFeaturesError] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const hasAdminConsoleAccess = Boolean(
    session?.user?.roles?.includes("ADMIN") ||
      session?.user?.roles?.includes("STAFF"),
  );
  const canUseDashboardShell = Boolean(
    pathname?.startsWith("/users/") || pathname?.startsWith("/settings"),
  );
  const userPermissions = useMemo(
    () =>
      Array.isArray(session?.user?.permissions)
        ? session.user.permissions
        : [],
    [session?.user?.permissions],
  );

  const initials = useMemo(() => {
    const name = session?.user?.name?.trim();
    if (!name) return "U";
    const parts = name.split(/\s+/).slice(0, 2);
    return parts.map((part) => part[0]?.toUpperCase()).join("");
  }, [session?.user?.name]);

  const roleLabel = useMemo(() => {
    const roles = Array.isArray(session?.user?.roles) ? session.user.roles : [];
    if (roles.length === 0) return "USER";
    if (roles.includes("ADMIN")) return "ADMIN";
    return String(roles[0]);
  }, [session?.user?.roles]);

  const pageTitle = useMemo(() => titleFromPath(pathname), [pathname]);

  const grouped = useMemo(() => {
    const groupedMap = new Map<string, FeatureLink[]>();
    for (const feature of featureLinks) {
      const section = feature.section ?? "Modules";
      if (!groupedMap.has(section)) groupedMap.set(section, []);
      groupedMap.get(section)?.push(feature);
    }
    return Array.from(groupedMap.entries());
  }, [featureLinks]);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
    if (
      status === "authenticated" &&
      hasAdminConsoleAccess &&
      !canUseDashboardShell
    ) {
      router.replace("/admin");
    }
  }, [status, hasAdminConsoleAccess, canUseDashboardShell, router]);

  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      if (!isDropdownOpen) return;
      const element = dropdownRef.current;
      if (element && !element.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsDropdownOpen(false);
    };

    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [isDropdownOpen]);

  useEffect(() => {
    let active = true;

    const loadFeatures = async () => {
      setFeaturesLoading(true);
      setFeaturesError(null);

      try {
        const response = await fetch("/api/v1/features", { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const payload: unknown = await response.json();
        const parsed = Array.isArray(payload)
          ? payload
              .map((item) => normalizeFeature(item as FeatureApiItem))
              .filter((item): item is FeatureLink => item !== null)
          : [];

        const visible = parsed.filter((feature) => {
          const requiredPermissions = Array.isArray(feature.permissions)
            ? feature.permissions
            : feature.permission
              ? [feature.permission]
              : [];

          if (requiredPermissions.length === 0) return true;

          const hasRequiredPermission = requiredPermissions.some((permission) =>
            userPermissions.includes(permission),
          );

          const hasManagePermission = requiredPermissions.some((permission) => {
            const scope = permission.split(":")[0];
            return userPermissions.includes(`${scope}:manage`);
          });

          return hasRequiredPermission || hasManagePermission;
        });

        visible.sort((left, right) => {
          const leftSection = left.section ?? "Modules";
          const rightSection = right.section ?? "Modules";
          if (leftSection !== rightSection) {
            return leftSection.localeCompare(rightSection);
          }

          const leftOrder = typeof left.order === "number" ? left.order : 999;
          const rightOrder = typeof right.order === "number" ? right.order : 999;
          if (leftOrder !== rightOrder) return leftOrder - rightOrder;

          const leftLabel = left.label ?? left.name;
          const rightLabel = right.label ?? right.name;
          return leftLabel.localeCompare(rightLabel);
        });

        if (active) setFeatureLinks(visible);
      } catch {
        if (active) setFeaturesError("Could not load modules.");
      } finally {
        if (active) setFeaturesLoading(false);
      }
    };

    if (
      status === "authenticated" &&
      session &&
      (!hasAdminConsoleAccess || canUseDashboardShell)
    ) {
      loadFeatures().catch(() => {
        if (active) setFeaturesError("Could not load modules.");
      });
    }

    return () => {
      active = false;
    };
  }, [status, session, hasAdminConsoleAccess, canUseDashboardShell, userPermissions]);

  const handleLogout = async () => {
    await signOut({ callbackUrl: "/" });
  };

  if (status === "loading") {
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

  if (
    status !== "authenticated" ||
    (hasAdminConsoleAccess && !canUseDashboardShell)
  ) {
    return null;
  }

  const isActive = (href: string) => {
    if (!pathname) return false;
    if (pathname === href) return true;
    return href !== "/panel" && pathname.startsWith(href);
  };

  const navItemClass = (href: string) =>
    cx(styles.navItem, isActive(href) && styles.navItemActive);

  return (
    <div className={styles.consoleShell}>
      <div className={styles.shellGrid}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarInner}>
            <div className={styles.sidebarBrand}>
              <Link href="/panel" className={styles.brandLink}>
                <Image
                  src="/brand/truckers-unidos-logo.png"
                  alt="Truckers Unidos logo"
                  width={64}
                  height={64}
                  className={styles.brandLogo}
                />
                <div>
                  <div className={styles.brandTitle}>Truckers Unidos</div>
                  <div className={styles.brandSubtitle}>User Panel</div>
                </div>
              </Link>

              <span className={styles.roleBadge}>{roleLabel}</span>
            </div>

            <nav className={styles.sidebarScroll}>
              <div className={styles.navHeading}>General</div>
              <div className={styles.navSection}>
                <Link href="/panel" className={navItemClass("/panel")}>
                  <span className={styles.navDot} />
                  Dashboard
                </Link>
                <Link href="/settings" className={navItemClass("/settings")}>
                  <span className={styles.navDot} />
                  Settings
                </Link>
              </div>

              <div className={`${styles.navHeading} ${styles.navGroup}`}>
                Modules
              </div>

              <div className={styles.navGroup}>
                {featuresLoading && (
                  <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <div
                        key={index}
                        className="h-9 rounded-xl bg-zinc-100 animate-pulse"
                      />
                    ))}
                  </div>
                )}

                {!featuresLoading && featuresError && (
                  <div className={styles.warningBox}>
                    {featuresError}
                    <button
                      onClick={() => location.reload()}
                      className={styles.retryButton}
                    >
                      Retry
                    </button>
                  </div>
                )}

                {!featuresLoading &&
                  !featuresError &&
                  grouped.map(([section, items]) => (
                    <div key={section} className={styles.navGroup}>
                      <div className={styles.navHeading}>{section}</div>
                      <div className={styles.navSection}>
                        {items.map((feature) => (
                          <Link
                            key={feature.href}
                            href={feature.href}
                            className={navItemClass(feature.href)}
                          >
                            <span className={styles.navDot} />
                            <span className="truncate">
                              {feature.label ?? feature.name}
                            </span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </nav>

            <div className={styles.sidebarFooter}>
              <div ref={dropdownRef} className="relative">
                <button
                  onClick={() => setIsDropdownOpen((current) => !current)}
                  className={styles.accountButton}
                >
                  <div className="flex items-center gap-3">
                    <div className={styles.accountAvatar}>{initials}</div>
                    <div className="min-w-0 text-left flex-1">
                      <div className={`${styles.accountName} truncate`}>
                        {session?.user?.name || "User"}
                      </div>
                      <div className={`${styles.accountEmail} truncate`}>
                        {session?.user?.email || "user@example.com"}
                      </div>
                    </div>
                    <svg
                      className={cx(
                        "h-4 w-4 text-zinc-500 transition-transform",
                        isDropdownOpen && "rotate-180",
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

                {isDropdownOpen && (
                  <div className={styles.dropdown}>
                    <Link
                      href="/settings"
                      className={styles.dropdownLink}
                      onClick={() => setIsDropdownOpen(false)}
                    >
                      Settings
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
                  Panel <span className="mx-1">/</span>{" "}
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
                  <span className="select-none">Search...</span>
                  <span className={styles.searchKey}>Ctrl K</span>
                </div>

                <NotificationBell />

                <Link
                  href="/settings"
                  className={styles.quickProfile}
                >
                  <div className={styles.quickAvatar}>{initials}</div>
                  <span className={styles.quickName}>
                    {session?.user?.name?.split(" ")[0] || "User"}
                  </span>
                </Link>
              </div>
            </div>
          </header>

          <main className={styles.contentWrap}>
            <div className={styles.contentCard}>
              <div className={styles.contentInner}>{children}</div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
