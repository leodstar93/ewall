import { NextResponse } from "next/server";
import { getAuthz } from "./rbac";

const STAFF_ADMIN_FEATURE_MODULES = new Set([
  "ifta",
  "truck",
  "reports",
  "documents",
  "ucr",
  "compliance2290",
]);

export async function requireApiPermission(permission: string) {
  console.log("requireApiPermission called with permission:", permission);
  const { session, perms, roles, isAdmin } = await getAuthz();

  if (!session) {
    return { ok: false as const, res: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }

  const moduleKey = permission.split(":")[0];
  const isStaff = roles.includes("STAFF");
  const isFeatureAdmin = isAdmin || (isStaff && STAFF_ADMIN_FEATURE_MODULES.has(moduleKey));

  const ok =
    isFeatureAdmin ||
    perms.includes(permission) ||
    perms.includes(`${moduleKey}:manage`);
  console.log("requireApiPermission result:", {
    ok,
    session,
    perms,
    isAdmin,
    isFeatureAdmin,
  });

  if (!ok) {
    return { ok: false as const, res: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }

  return { ok: true as const, session, perms, isAdmin: isFeatureAdmin };
}

// Example usage in an API route
// export async function GET() {
//   const { ok, res } = await requireApiPermission("some:permission");
//   if (!ok) return res;
//   // Proceed with the rest of your API logic
// }

/* import { requireApiPermission } from "@/lib/rbac-api";

export async function POST() {
  const guard = await requireApiPermission("labslips:create");
  if (!guard.ok) return guard.res;

  // ... lógica
} */
