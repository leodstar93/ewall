const SEGMENT_LABELS: Record<string, string> = {
  admin: "Admin",
  dashboard: "Dashboard",
  documents: "Documents",
  dmv: "DMV",
  features: "Features",
  ifta: "IFTA",
  "ifta-v2": "IFTA",
  panel: "Dashboard",
  permissions: "Permissions",
  profile: "Profile",
  renewals: "Renewals",
  roles: "Roles",
  sandbox: "Sandbox",
  settings: "Settings",
  truckers: "Clients",
  trucks: "Trucks",
  ucr: "UCR",
  users: "Users",
};

const DETAIL_LABELS: Record<string, string> = {
  documents: "Document Details",
  dmv: "DMV Case",
  "ifta-v2": "IFTA Filing",
  ifta: "IFTA Report",
  permissions: "Permission Details",
  renewals: "DMV Renewal",
  roles: "Role Details",
  truckers: "Client Details",
  trucks: "Truck Details",
  ucr: "UCR Filing",
  users: "User Details",
};

function titleCaseSegment(segment: string) {
  return segment
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function labelForSegment(segment: string) {
  const normalized = segment.trim().toLowerCase();
  if (!normalized) return "Details";
  return SEGMENT_LABELS[normalized] ?? titleCaseSegment(normalized);
}

function detailLabelForSegment(segment: string | undefined) {
  if (!segment) return "Details";

  const normalized = segment.trim().toLowerCase();
  if (!normalized) return "Details";

  return DETAIL_LABELS[normalized] ?? `${labelForSegment(normalized)} Details`;
}

export function isOpaqueRouteSegment(segment: string | undefined) {
  if (!segment) return false;

  const normalized = segment.trim();
  if (!normalized) return false;

  return (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized) ||
    /^c[a-z0-9]{20,}$/i.test(normalized) ||
    /^[0-9a-f]{24,}$/i.test(normalized) ||
    /^\d{6,}$/.test(normalized) ||
    /^[a-z0-9_-]{16,}$/i.test(normalized)
  );
}

export function fallbackTitleFromPath(pathname: string | null, defaultTitle: string) {
  if (!pathname) return defaultTitle;

  const segments = pathname.split("/").filter(Boolean);
  const last = segments.at(-1);

  if (!last) return defaultTitle;
  if (last === "new") return "New";

  if (isOpaqueRouteSegment(last)) {
    return detailLabelForSegment(segments.at(-2));
  }

  return labelForSegment(last);
}
