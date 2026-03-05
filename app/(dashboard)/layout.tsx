"use client";

import Link from "next/link";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";

type FeatureLink = {
  name: string;
  label?: string;
  section?: string;
  order?: number;
  icon?: string;
  href: string;
  // compat: algunos items pueden venir con permission (string) o permissions (string[])
  permission?: string;
  permissions?: string[];
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
  if (pathname.startsWith("/panel/settings")) return "Settings";
  if (pathname.startsWith("/users/")) return "Perfil";
  const last = pathname.split("/").filter(Boolean).pop() ?? "Panel";
  return last.charAt(0).toUpperCase() + last.slice(1);
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

  const isAdmin = !!session?.user?.roles?.includes("ADMIN");

  const initials = useMemo(() => {
    const name = session?.user?.name?.trim();
    if (!name) return "U";
    const parts = name.split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0]?.toUpperCase()).join("");
  }, [session]);

  const roleLabel = useMemo(() => {
    const roles = (session?.user as any)?.roles ?? [];
    if (!roles?.length) return "USER";
    if (roles.includes("ADMIN")) return "ADMIN";
    return String(roles[0]);
  }, [session]);

  const pageTitle = useMemo(() => titleFromPath(pathname), [pathname]);

  // Group by section
  const grouped = useMemo(() => {
    const map = new Map<string, FeatureLink[]>();
    for (const f of featureLinks) {
      const section = f.section ?? "Módulos";
      if (!map.has(section)) map.set(section, []);
      map.get(section)!.push(f);
    }
    return Array.from(map.entries());
  }, [featureLinks]);

  // ✅ Redirects correctos
  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
    if (status === "authenticated" && isAdmin) router.replace("/admin");
  }, [status, isAdmin, router]);

  // ✅ Close dropdown on outside click / ESC
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!isDropdownOpen) return;
      const el = dropdownRef.current;
      if (el && !el.contains(e.target as Node)) setIsDropdownOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsDropdownOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [isDropdownOpen]);

  // ✅ Load features + RBAC robusto
  useEffect(() => {
    let active = true;

    const run = async () => {
      setFeaturesLoading(true);
      setFeaturesError(null);
      try {
        const res = await fetch("/api/v1/features", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as any[];

        const perms =
          (((session?.user as any)?.permissions ?? []) as string[]) ?? [];

        const visible = (Array.isArray(data) ? data : []).filter((f: any) => {
          const required: string[] = Array.isArray(f.permissions)
            ? f.permissions
            : typeof f.permission === "string"
              ? [f.permission]
              : [];

          if (required.length === 0) return true;

          // OR (tiene alguno)
          const hasAny = required.some((p) => perms.includes(p));

          // bonus: si tienes "module:manage" cuenta como acceso al módulo
          const hasManage = required.some((p) => {
            const module = String(p).split(":")[0];
            return perms.includes(`${module}:manage`);
          });

          return hasAny || hasManage;
        });

        // ordenar por section + order + label
        visible.sort((a: any, b: any) => {
          const as = String(a.section ?? "Módulos");
          const bs = String(b.section ?? "Módulos");
          if (as !== bs) return as.localeCompare(bs);

          const ao = typeof a.order === "number" ? a.order : 999;
          const bo = typeof b.order === "number" ? b.order : 999;
          if (ao !== bo) return ao - bo;

          const al = String(a.label ?? a.name ?? "");
          const bl = String(b.label ?? b.name ?? "");
          return al.localeCompare(bl);
        });

        if (active) setFeatureLinks(visible as FeatureLink[]);
      } catch (e) {
        if (active) setFeaturesError("No se pudieron cargar los módulos.");
      } finally {
        if (active) setFeaturesLoading(false);
      }
    };

    if (status === "authenticated" && session && !isAdmin) run();

    return () => {
      active = false;
    };
  }, [status, session, isAdmin]);

  const handleLogout = async () => {
    await signOut({ callbackUrl: "/" });
  };

  // Loading “pretty”
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

  // Si está redirecting o no autenticado
  if (status !== "authenticated" || isAdmin) return null;

  const isActive = (href: string) => {
    if (!pathname) return false;
    if (pathname === href) return true;
    // si el user está dentro de una subruta del módulo
    return href !== "/panel" && pathname.startsWith(href);
  };

  const navItemClass = (href: string) =>
    cx(
      "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
      isActive(href)
        ? "bg-zinc-900 text-white"
        : "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900",
    );

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="flex">
        {/* SIDEBAR */}
        <aside className="w-72 border-r bg-white">
          <div className="h-screen flex flex-col">
            {/* Brand */}
            <div className="h-16 px-5 flex items-center justify-between border-b">
              <Link href="/panel" className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-xl bg-zinc-900 text-white flex items-center justify-center font-semibold">
                  E
                </div>
                <div className="leading-tight">
                  <div className="text-sm font-semibold text-zinc-900">
                    EWall
                  </div>
                  <div className="text-xs text-zinc-500">User Panel</div>
                </div>
              </Link>

              <span className="text-[11px] font-medium px-2 py-1 rounded-full bg-zinc-100 text-zinc-700">
                {roleLabel}
              </span>
            </div>

            {/* Nav */}
            <nav className="px-3 py-4 flex-1 overflow-y-auto">
              <div className="px-2 text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                General
              </div>

              <div className="mt-2 space-y-1">
                <Link href="/panel" className={navItemClass("/panel")}>
                  <span className="h-2 w-2 rounded-full bg-current opacity-40" />
                  Dashboard
                </Link>

                <Link
                  href={`/users/${session?.user?.id}`}
                  className={navItemClass(`/users/${session?.user?.id}`)}
                >
                  <span className="h-2 w-2 rounded-full bg-current opacity-40" />
                  Perfil
                </Link>
              </div>

              <div className="mt-6 px-2 text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                Módulos
              </div>

              <div className="mt-2 space-y-4">
                {featuresLoading && (
                  <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-9 rounded-xl bg-zinc-100 animate-pulse"
                      />
                    ))}
                  </div>
                )}

                {!featuresLoading && featuresError && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    {featuresError}
                    <button
                      onClick={() => location.reload()}
                      className="ml-2 underline underline-offset-2"
                    >
                      Reintentar
                    </button>
                  </div>
                )}

                {!featuresLoading &&
                  !featuresError &&
                  grouped.map(([section, items]) => (
                    <div key={section}>
                      <div className="px-2 text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                        {section}
                      </div>
                      <div className="mt-2 space-y-1">
                        {items.map((f) => (
                          <Link
                            key={f.href}
                            href={f.href}
                            className={navItemClass(f.href)}
                          >
                            <span className="h-2 w-2 rounded-full bg-current opacity-40" />
                            <span className="truncate">
                              {f.label ?? f.name}
                            </span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </nav>

            {/* Account */}
            <div className="border-t p-3">
              <div ref={dropdownRef} className="relative">
                <button
                  onClick={() => setIsDropdownOpen((v) => !v)}
                  className="w-full rounded-2xl border bg-white p-3 hover:bg-zinc-50 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-zinc-900 text-white flex items-center justify-center font-semibold">
                      {initials}
                    </div>
                    <div className="min-w-0 text-left flex-1">
                      <div className="text-sm font-semibold text-zinc-900 truncate">
                        {session?.user?.name || "User"}
                      </div>
                      <div className="text-xs text-zinc-500 truncate">
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
                  <div className="absolute bottom-full left-0 right-0 mb-2 rounded-2xl border bg-white shadow-lg overflow-hidden">
                    <Link
                      href="/panel/settings"
                      className="block px-4 py-3 text-sm text-zinc-700 hover:bg-zinc-50"
                      onClick={() => setIsDropdownOpen(false)}
                    >
                      Profile settings
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-zinc-50 border-t"
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
                  Panel <span className="mx-1">/</span>{" "}
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
                  <span className="select-none">Buscar…</span>
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

                {/* Profile quick */}
                <Link
                  href={`/users/${session?.user?.id}`}
                  className="h-10 px-3 rounded-2xl border bg-white hover:bg-zinc-50 transition flex items-center gap-2"
                >
                  <div className="h-7 w-7 rounded-xl bg-zinc-900 text-white flex items-center justify-center text-xs font-semibold">
                    {initials}
                  </div>
                  <span className="hidden sm:block text-sm font-medium text-zinc-900">
                    {session?.user?.name?.split(" ")[0] || "User"}
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