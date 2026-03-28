import { getSessionUserId } from "@/lib/api/auth";
import { requireApiPermission } from "@/lib/rbac-api";
import { SettingsValidationError } from "@/lib/services/settings-errors";
import { normalizeSaferCompany } from "@/services/fmcsa/normalizeSaferCompany";
import { lookupSaferCompany } from "@/services/fmcsa/lookupSaferCompany";

export async function POST(request: Request) {
  const startedAt = Date.now();
  const guard = await requireApiPermission("settings:read");
  if (!guard.ok) return guard.res;

  const userId = getSessionUserId(guard.session);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let dotNumber = "";

  try {
    const body = await request.json().catch(() => ({}));
    dotNumber = typeof body.dotNumber === "string" ? body.dotNumber : "";

    const raw = await lookupSaferCompany({ dotNumber });
    const normalized = normalizeSaferCompany(raw);
    const status = normalized.found ? 200 : 404;

    console.info("[safer.lookup]", {
      userId,
      dotNumber: raw.searchedDotNumber,
      status,
      found: normalized.found,
      warnings: normalized.warnings.length,
      durationMs: Date.now() - startedAt,
    });

    return Response.json(normalized, { status });
  } catch (error) {
    if (
      error instanceof SettingsValidationError ||
      error instanceof SyntaxError ||
      (error instanceof Error && error.name === "ZodError")
    ) {
      return Response.json({ error: "Invalid USDOT number." }, { status: 400 });
    }

    console.error("[safer.lookup]", {
      userId,
      dotNumber,
      durationMs: Date.now() - startedAt,
      error,
    });

    return Response.json(
      { error: "We couldn't retrieve company data from SAFER right now." },
      { status: 502 },
    );
  }
}
