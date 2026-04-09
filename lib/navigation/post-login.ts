export function getPostLoginRedirectPath(roles: string[] | null | undefined) {
  const safeRoles = Array.isArray(roles) ? roles : [];

  if (safeRoles.includes("ADMIN") || safeRoles.includes("STAFF")) {
    return "/v2/admin";
  }

  if (safeRoles.includes("TRUCKER")) {
    return "/v2/dashboard";
  }

  return "/v2/dashboard";
}
