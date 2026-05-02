import { NextResponse } from "next/server";
import { auth } from "@/auth";

const RULES: Array<{
  match: (pathname: string) => boolean;
  requireAuth?: boolean;
  requirePerms?: string[];
  requireRolesAny?: string[];
}> = [
  {
    match: (pathname) => pathname === "/admin" || pathname === "/admin/",
    requireAuth: true,
    requireRolesAny: ["ADMIN", "STAFF"],
  },
  {
    match: (pathname) => pathname.startsWith("/admin/features"),
    requireAuth: true,
    requireRolesAny: ["ADMIN", "STAFF"],
  },
  {
    match: (pathname) =>
      pathname === "/admin/profile" || pathname.startsWith("/admin/profile/"),
    requireAuth: true,
    requireRolesAny: ["ADMIN", "STAFF"],
  },
  {
    match: (pathname) => pathname.startsWith("/admin/truckers"),
    requireAuth: true,
    requireRolesAny: ["ADMIN", "STAFF"],
  },
  {
    match: (pathname) => pathname.startsWith("/admin/users/new"),
    requireAuth: true,
    requirePerms: ["users:write"],
  },
  {
    match: (pathname) => pathname.startsWith("/admin/users"),
    requireAuth: true,
    requirePerms: ["users:read"],
  },
  {
    match: (pathname) => pathname.startsWith("/admin/cases/create"),
    requireAuth: true,
    requirePerms: ["cases:write"],
  },
  {
    match: (pathname) => pathname.startsWith("/admin/cases"),
    requireAuth: true,
    requirePerms: ["cases:read"],
  },
  {
    match: (pathname) => pathname.startsWith("/admin/documents"),
    requireAuth: true,
    requireRolesAny: ["ADMIN", "STAFF"],
  },
  {
    match: (pathname) => pathname.startsWith("/admin"),
    requireAuth: true,
    requirePerms: ["admin:access"],
  },
  {
    match: (pathname) => pathname.startsWith("/panel"),
    requireAuth: true,
    requirePerms: ["dashboard:access"],
  },
];

function firstRule(pathname: string) {
  return RULES.find((rule) => rule.match(pathname));
}

function hasAll(perms: string[], required: string[]) {
  const set = new Set(perms);
  return required.every((permission) => set.has(permission));
}

function getAuthUserMeta(req: {
  auth?:
    | {
        user?: {
          roles?: string[];
          permissions?: string[];
        };
      }
    | null;
}) {
  return {
    roles: req.auth?.user?.roles ?? [],
    permissions: req.auth?.user?.permissions ?? [],
  };
}

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    return NextResponse.next();
  }

  const rule = firstRule(pathname);
  if (!rule) return NextResponse.next();

  if (rule.requireAuth && !req.auth) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/panel")) {
    const { roles } = getAuthUserMeta(req);
    if (roles.includes("ADMIN") || roles.includes("STAFF")) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin";
      return NextResponse.redirect(url);
    }
  }

  if (rule.requirePerms?.length) {
    const { permissions } = getAuthUserMeta(req);
    if (!hasAll(permissions, rule.requirePerms)) {
      return new NextResponse("Forbidden", { status: 403 });
    }
  }

  if (rule.requireRolesAny?.length) {
    const { roles } = getAuthUserMeta(req);
    const hasSomeRole = rule.requireRolesAny.some((role) => roles.includes(role));
    if (!hasSomeRole) {
      return new NextResponse("Forbidden", { status: 403 });
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*", "/panel/:path*"],
};
