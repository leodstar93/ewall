import { NextResponse } from "next/server";
import { getAuthz } from "./rbac";
import { STAFF_ADMIN_FEATURE_MODULES } from "./rbac-feature-modules";
import { getModuleAccess } from "@/lib/services/entitlements.service";
import { ensureUserOrganization } from "@/lib/services/organization.service";

const API_MODULE_ACCESS_GATES = new Set(["ifta", "ucr"]);

async function requireEntitledApiModule(input: {
  userId?: string | null;
  moduleKey: string;
}) {
  if (!API_MODULE_ACCESS_GATES.has(input.moduleKey)) {
    return { ok: true as const };
  }

  if (!input.userId) {
    return {
      ok: false as const,
      res: NextResponse.json({ error: "invalid session" }, { status: 400 }),
    };
  }

  const organization = await ensureUserOrganization(input.userId);
  const access = await getModuleAccess(organization.id, input.moduleKey);

  if (access.allowed) {
    return { ok: true as const };
  }

  return {
    ok: false as const,
    res: NextResponse.json(
      {
        error: "module access required",
        blockedModule: input.moduleKey,
        reason: access.reason,
      },
      { status: 402 },
    ),
  };
}

export async function requireApiPermission(permission: string) {
  //console.log("requireApiPermission called with permission:", permission);
  const { session, perms, roles, isAdmin } = await getAuthz();

  if (!session) {
    return {
      ok: false as const,
      res: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    };
  }

  const moduleKey = permission.split(":")[0];
  const isStaff = roles.includes("STAFF");
  const isFeatureAdmin =
    isAdmin || (isStaff && STAFF_ADMIN_FEATURE_MODULES.has(moduleKey));

  const ok =
    isFeatureAdmin ||
    perms.includes(permission) ||
    perms.includes(`${moduleKey}:manage`);
  /*console.log("requireApiPermission result:", {
    ok,
    session,
    perms,
    isAdmin,
    isFeatureAdmin,
  });*/

  if (!ok) {
    return {
      ok: false as const,
      res: NextResponse.json({ error: "forbidden" }, { status: 403 }),
    };
  }

  if (!isFeatureAdmin) {
    const entitlement = await requireEntitledApiModule({
      userId: session.user.id,
      moduleKey,
    });

    if (!entitlement.ok) {
      return entitlement;
    }
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
