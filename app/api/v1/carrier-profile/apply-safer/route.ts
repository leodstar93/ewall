import { getSessionUserId } from "@/lib/api/auth";
import { requireApiPermission } from "@/lib/rbac-api";
import { saferApplySchema } from "@/lib/validations/safer";
import { applySaferToCompanyProfile } from "@/lib/services/company.service";
import { SettingsValidationError } from "@/lib/services/settings-errors";

function normalizeDotNumber(value?: string | null) {
  if (!value) return null;

  const digits = value.replace(/[^\d]/g, "");
  if (!digits) return null;

  return digits.replace(/^0+/, "") || "0";
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const guard = await requireApiPermission("settings:update");
  if (!guard.ok) return guard.res;

  const userId = getSessionUserId(guard.session);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = saferApplySchema.parse(body);
    const lookupResult = parsed.lookupResult;

    if (!lookupResult.found || !lookupResult.company) {
      return Response.json({ error: "No SAFER result available to apply." }, { status: 400 });
    }

    const requestedDot = normalizeDotNumber(parsed.dotNumber);
    const snapshotDot = normalizeDotNumber(
      lookupResult.company.usdotNumber ?? lookupResult.searchedDotNumber,
    );
    const searchedDot = normalizeDotNumber(lookupResult.searchedDotNumber);

    if (snapshotDot !== requestedDot || searchedDot !== requestedDot) {
      return Response.json(
        { error: "The SAFER snapshot USDOT number does not match the requested USDOT number." },
        { status: 400 },
      );
    }

    const profile = await applySaferToCompanyProfile(userId, lookupResult);

    console.info("[safer.apply]", {
      userId,
      dotNumber: parsed.dotNumber,
      warnings: lookupResult.warnings.length,
      durationMs: Date.now() - startedAt,
    });

    return Response.json({ ok: true, profile });
  } catch (error) {
    if (
      error instanceof SettingsValidationError ||
      error instanceof SyntaxError ||
      (error instanceof Error && error.name === "ZodError")
    ) {
      return Response.json({ error: error.message || "Invalid SAFER payload." }, { status: 400 });
    }

    console.error("[safer.apply]", {
      userId,
      durationMs: Date.now() - startedAt,
      error,
    });

    return Response.json({ error: "Unable to apply SAFER data." }, { status: 500 });
  }
}
