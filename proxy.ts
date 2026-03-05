import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/auth";

// 1) Define reglas: path -> permisos requeridos
const RULES: Array<{
  match: (pathname: string) => boolean;
  requireAuth?: boolean;
  requirePerms?: string[];
}> = [
  // Admin panel completo
  { match: (p) => p.startsWith("/admin"), requireAuth: true, requirePerms: ["admin:access"] },

  // Ejemplos por módulo
  { match: (p) => p.startsWith("/admin/users"), requireAuth: true, requirePerms: ["users:read"] },
  { match: (p) => p.startsWith("/admin/users/new"), requireAuth: true, requirePerms: ["users:write"] },

  { match: (p) => p.startsWith("/admin/cases"), requireAuth: true, requirePerms: ["cases:read"] },
  { match: (p) => p.startsWith("/admin/cases/create"), requireAuth: true, requirePerms: ["cases:write"] },
];

function firstRule(pathname: string) {
  return RULES.find((r) => r.match(pathname));
}

function bestRule(pathname: string) {
  const matches = RULES.filter((r) => r.match(pathname));
  if (!matches.length) return undefined;
  return matches[matches.length - 1]; // si ordenas de general->específica
}

function hasAll(perms: string[], required: string[]) {
  const set = new Set(perms);
  return required.every((p) => set.has(p));
}

// 2) Proxy con auth() (Auth.js v5)
export default auth((req: NextRequest) => {
  const { pathname } = req.nextUrl;

  // ignora assets internos
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    return NextResponse.next();
  }

  const rule = firstRule(pathname);
  if (!rule) return NextResponse.next();

  const isLoggedIn = !!req.auth;
  if (rule.requireAuth && !isLoggedIn) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  if (rule.requirePerms?.length) {
    const perms = ((req.auth?.user as any)?.permissions ?? []) as string[];
    if (!hasAll(perms, rule.requirePerms)) {
      // opción A: 403 directo
      return new NextResponse("Forbidden", { status: 403 });

      // opción B: redirigir a /unauthorized
      // const url = req.nextUrl.clone();
      // url.pathname = "/unauthorized";
      // return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
});

// 3) Matcher: decide qué rutas pasan por proxy
export const config = {
  matcher: ["/admin/:path*", "/dashboard/:path*"],
};