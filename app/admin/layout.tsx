"use client";

import Image from "next/image";
import Link from "next/link";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import styles from "../console-theme.module.css";

interface AdminLayoutProps {
  children: ReactNode;
}

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function titleFromPath(pathname: string | null) {
  if (!pathname) return "Admin";
  if (pathname === "/admin") return "Dashboard";
  if (pathname.startsWith("/admin/users")) return "Users";
  if (pathname.startsWith("/admin/roles")) return "Roles";
  if (pathname.startsWith("/admin/permissions")) return "Permissions";
  if (pathname.startsWith("/admin/features/documents")) return "Documents";
  if (pathname.startsWith("/admin/features/ifta")) return "IFTA";
  const last = pathname.split("/").filter(Boolean).pop() ?? "Admin";
  return last.charAt(0).toUpperCase() + last.slice(1);
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const isAdmin = Boolean(session?.user?.roles?.includes("ADMIN"));

  const initials = useMemo(() => {
    const name = session?.user?.name?.trim();
    if (!name) return "A";
    const parts = name.split(/\s+/).slice(0, 2);
    return parts.map((part) => part[0]?.toUpperCase()).join("");
  }, [session?.user?.name]);

  const pageTitle = useMemo(() => titleFromPath(pathname), [pathname]);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
    if (status === "authenticated" && !isAdmin) router.replace("/panel");
  }, [status, isAdmin, router]);

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

  if (status !== "authenticated" || !isAdmin) return null;

  return (
    <div className={styles.consoleShell}>
      <div className={styles.shellGrid}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarInner}>
            <div className={styles.sidebarBrand}>
              <Link href="/admin" className={styles.brandLink}>
                <Image
                  src="/brand/truckers-unidos-logo.png"
                  alt="Truckers Unidos logo"
                  width={64}
                  height={64}
                  className={styles.brandLogo}
                />
                <div>
                  <div className={styles.brandTitle}>Truckers Unidos</div>
                  <div className={styles.brandSubtitle}>Admin Console</div>
                </div>
              </Link>

              <span className={styles.roleBadge}>ADMIN</span>
            </div>

            <nav className={styles.sidebarScroll}>
              <div className={styles.navHeading}>Overview</div>
              <div className={styles.navSection}>
                <Link href="/admin" className={navItemClass("/admin")}>
                  <span className={styles.navDot} />
                  Dashboard
                </Link>
              </div>

              <div className={`${styles.navHeading} ${styles.navGroup}`}>
                Access Control
              </div>
              <div className={styles.navSection}>
                <Link href="/admin/users" className={navItemClass("/admin/users")}>
                  <span className={styles.navDot} />
                  Users
                </Link>
                <Link href="/admin/roles" className={navItemClass("/admin/roles")}>
                  <span className={styles.navDot} />
                  Roles
                </Link>
                <Link
                  href="/admin/permissions"
                  className={navItemClass("/admin/permissions")}
                >
                  <span className={styles.navDot} />
                  Permissions
                </Link>
              </div>

              <div className={`${styles.navHeading} ${styles.navGroup}`}>
                Workspace
              </div>
              <div className={styles.navSection}>
                <Link
                  href="/admin/features/documents"
                  className={navItemClass("/admin/features/documents")}
                >
                  <span className={styles.navDot} />
                  Documents
                </Link>
                <Link
                  href="/admin/features/ifta"
                  className={navItemClass("/admin/features/ifta")}
                >
                  <span className={styles.navDot} />
                  IFTA
                </Link>
                <Link href="/panel" className={styles.navItem}>
                  <span className={styles.navDot} />
                  Go to user panel
                </Link>
              </div>
            </nav>

            <div className={styles.sidebarFooter}>
              <div ref={menuRef} className="relative">
                <button
                  onClick={() => setUserMenuOpen((current) => !current)}
                  className={styles.accountButton}
                >
                  <div className="flex items-center gap-3">
                    <div className={styles.accountAvatar}>{initials}</div>
                    <div className="min-w-0 text-left flex-1">
                      <div className={`${styles.accountName} truncate`}>
                        {session?.user?.name || "Admin"}
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
                      href={`/admin/users/${session?.user?.id}`}
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
                  Admin <span className="mx-1">/</span>{" "}
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

                <button className={styles.iconButton} aria-label="Notifications">
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                    />
                  </svg>
                </button>

                <Link href={`/users/${session?.user?.id}`} className={styles.quickProfile}>
                  <div className={styles.quickAvatar}>{initials}</div>
                  <span className={styles.quickName}>
                    {session?.user?.name?.split(" ")[0] || "Admin"}
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
