import path from "path";
import type { AppEnvironment } from "@/lib/db/types";

export function getStorageBaseSegments(environment: AppEnvironment) {
  return ["uploads", environment] as const;
}

export function getStorageBasePath(environment: AppEnvironment) {
  return `/${getStorageBaseSegments(environment).join("/")}`;
}

export function getStorageDiskDirectory(environment: AppEnvironment, ...segments: string[]) {
  return path.join(process.cwd(), "public", ...getStorageBaseSegments(environment), ...segments);
}

export function getStoragePublicUrl(environment: AppEnvironment, ...segments: string[]) {
  const sanitizedSegments = segments.map((segment) => segment.replace(/^\/+|\/+$/g, ""));
  return [getStorageBasePath(environment), ...sanitizedSegments].join("/");
}

export function resolveDiskPathFromPublicUrl(fileUrl: string) {
  let relativeUrl = fileUrl.trim();
  if (!relativeUrl.startsWith("/")) {
    relativeUrl = `/${relativeUrl}`;
  }

  relativeUrl = relativeUrl.replace(/^\/public\//, "/");
  if (!relativeUrl.startsWith("/uploads/")) {
    throw new Error("INVALID_PATH");
  }

  const publicRoot = path.join(process.cwd(), "public");
  const diskPath = path.join(publicRoot, relativeUrl);
  if (!diskPath.startsWith(publicRoot)) {
    throw new Error("INVALID_PATH");
  }

  return diskPath;
}
