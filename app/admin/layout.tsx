"use client";

import Link from "next/link";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";

interface DashboardLayoutProps {
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
  const last = pathname.split("/").filter(Boolean).pop() ?? "Admin";
  return last.charAt(0).toUpperCase() + last.slice(1);
}

export default function AdminLayout({ children }: DashboardLayoutProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const isAdmin = !!session?.user?.roles?.includes("ADMIN");

  const initials = useMemo(() => {
    const name = session?.user?.name?.trim();
    if (!name) return "A";
    const parts = name.split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0]?.toUpperCase()).join("");
  }, [session?.user?.name]);

  const pageTitle = useMemo(() => titleFromPath(pathname), [pathname]);

  // Redirects
  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
    if (status === "authenticated" && !isAdmin) router.replace("/panel");
  }, [status, isAdmin, router]);

  // Close dropdown
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!userMenuOpen) return;
      const el = menuRef.current;
      if (el && !el.contains(e.target as Node)) setUserMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setUserMenuOpen(false);
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
    return cx(
      "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
      active
        ? "bg-zinc-900 text-white"
        : "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900",
    );
  };

  const handleLogout = async () => {
    await signOut({ callbackUrl: "/" });
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="w-full max-w-sm rounded-2xl border bg-white p-6 shadow-sm">
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

  // redirecting
  if (status !== "authenticated" || !isAdmin) return null;

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="flex">
        {/* SIDEBAR */}
        <aside className="w-72 border-r bg-white">
          <div className="h-screen flex flex-col">
            {/* Brand */}
            <div className="h-16 px-5 flex items-center justify-between border-b">
              <Link href="/admin" className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-xl bg-zinc-900 text-white flex items-center justify-center font-semibold">
                  A
                </div>
                <div className="leading-tight">
                  <div className="text-sm font-semibold text-zinc-900">
                    EWall
                  </div>
                  <div className="text-xs text-zinc-500">Admin Console</div>
                </div>
              </Link>

              <span className="text-[11px] font-medium px-2 py-1 rounded-full bg-zinc-100 text-zinc-700">
                ADMIN
              </span>
            </div>

            {/* Nav */}
            <nav className="px-3 py-4 flex-1 overflow-y-auto">
              <div className="px-2 text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                Overview
              </div>

              <div className="mt-2 space-y-1">
                <Link href="/admin" className={navItemClass("/admin")}>
                  <span className="h-2 w-2 rounded-full bg-current opacity-40" />
                  Dashboard
                </Link>
              </div>

              <div className="mt-6 px-2 text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                Access control
              </div>

              <div className="mt-2 space-y-1">
                <Link
                  href="/admin/users"
                  className={navItemClass("/admin/users")}
                >
                  <span className="h-2 w-2 rounded-full bg-current opacity-40" />
                  Users
                </Link>
                <Link
                  href="/admin/roles"
                  className={navItemClass("/admin/roles")}
                >
                  <span className="h-2 w-2 rounded-full bg-current opacity-40" />
                  Roles
                </Link>
                <Link
                  href="/admin/permissions"
                  className={navItemClass("/admin/permissions")}
                >
                  <span className="h-2 w-2 rounded-full bg-current opacity-40" />
                  Permissions
                </Link>
              </div>

              <div className="mt-6 px-2 text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                Workspace
              </div>

              <div className="mt-2 space-y-1">
                <Link
                  href="/panel"
                  className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
                >
                  <span className="h-2 w-2 rounded-full bg-current opacity-40" />
                  Go to user panel
                </Link>
              </div>
            </nav>

            {/* Account */}
            <div className="border-t p-3">
              <div ref={menuRef} className="relative">
                <button
                  onClick={() => setUserMenuOpen((v) => !v)}
                  className="w-full rounded-2xl border bg-white p-3 hover:bg-zinc-50 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-zinc-900 text-white flex items-center justify-center font-semibold">
                      {initials}
                    </div>
                    <div className="min-w-0 text-left flex-1">
                      <div className="text-sm font-semibold text-zinc-900 truncate">
                        {session?.user?.name || "Admin"}
                      </div>
                      <div className="text-xs text-zinc-500 truncate">
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
                  <div className="absolute bottom-full left-0 right-0 mb-2 rounded-2xl border bg-white shadow-lg overflow-hidden">
                    <Link
                      href={`/users/${session?.user?.id}`}
                      className="block px-4 py-3 text-sm text-zinc-700 hover:bg-zinc-50"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      My profile
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-3 text-sm text-rose-700 hover:bg-zinc-50 border-t"
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-3 text-[11px] text-zinc-500">
                © {new Date().getFullYear()} EWall
              </div>
            </div>
          </div>
        </aside>

        {/* MAIN */}
        <div className="flex-1 min-w-0">
          {/* Topbar */}
          <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b">
            <div className="h-16 px-6 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-xs text-zinc-500">
                  Admin <span className="mx-1">/</span>{" "}
                  <span className="text-zinc-700">{pageTitle}</span>
                </div>
                <h1 className="text-lg font-semibold text-zinc-900 truncate">
                  {pageTitle}
                </h1>
              </div>

              <div className="flex items-center gap-3">
                {/* Search visual */}
                <div className="hidden md:flex items-center gap-2 rounded-2xl border bg-white px-3 py-2 text-sm text-zinc-500">
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.5 3.5a5 5 0 103.14 8.9l3.48 3.48a.75.75 0 101.06-1.06l-3.48-3.48A5 5 0 008.5 3.5zM5 8.5a3.5 3.5 0 117 0 3.5 3.5 0 01-7 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="select-none">Search…</span>
                  <span className="ml-2 rounded-lg bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-600">
                    Ctrl K
                  </span>
                </div>

                {/* Notifications */}
                <button
                  className="h-10 w-10 rounded-2xl border bg-white hover:bg-zinc-50 transition flex items-center justify-center text-zinc-600"
                  aria-label="Notifications"
                >
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

                {/* Quick profile */}
                <Link
                  href={`/users/${session?.user?.id}`}
                  className="h-10 px-3 rounded-2xl border bg-white hover:bg-zinc-50 transition flex items-center gap-2"
                >
                  <div className="h-7 w-7 rounded-xl bg-zinc-900 text-white flex items-center justify-center text-xs font-semibold">
                    {initials}
                  </div>
                  <span className="hidden sm:block text-sm font-medium text-zinc-900">
                    {session?.user?.name?.split(" ")[0] || "Admin"}
                  </span>
                </Link>
              </div>
            </div>
          </header>

          {/* Content */}
          <main className="p-6">
            <div className="rounded-2xl border bg-white shadow-sm">
              <div className="p-6">{children}</div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
