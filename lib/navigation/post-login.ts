export function getPostLoginRedirectPath(roles: string[] | null | undefined) {
  const safeRoles = Array.isArray(roles) ? roles : [];

  if (safeRoles.includes("ADMIN") || safeRoles.includes("STAFF")) {
    return "/admin";
  }

  if (safeRoles.includes("TRUCKER")) {
    return "/dashboard";
  }

  return "/dashboard";
}
