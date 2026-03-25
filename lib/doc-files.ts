import { resolveDiskPathFromPublicUrl } from "@/lib/storage/resolve-storage";

export function isRemoteUrl(u: string) {
  return /^https?:\/\//i.test(u);
}

export function toPublicRelative(u: string) {
  let p = u.trim();
  if (!p.startsWith("/")) p = `/${p}`;
  p = p.replace(/^\/public\//, "/");
  return p;
}

export function publicDiskPathFromUrl(u: string) {
  return resolveDiskPathFromPublicUrl(toPublicRelative(u));
}
