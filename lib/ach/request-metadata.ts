export type RequestMetadata = {
  ipAddress: string | null;
  userAgent: string | null;
};

function normalizeHeaderValue(value: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function getRequestMetadata(request: Request): RequestMetadata {
  const forwardedFor = normalizeHeaderValue(request.headers.get("x-forwarded-for"));
  const realIp = normalizeHeaderValue(request.headers.get("x-real-ip"));
  const ipAddress = forwardedFor?.split(",")[0]?.trim() || realIp || null;

  return {
    ipAddress,
    userAgent: normalizeHeaderValue(request.headers.get("user-agent")),
  };
}
