export function getSessionUserId(session: { user?: { id?: string | null } } | null | undefined) {
  return session?.user?.id ?? null;
}
