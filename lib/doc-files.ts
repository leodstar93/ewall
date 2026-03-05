import path from "path";

export function isRemoteUrl(u: string) {
  return /^https?:\/\//i.test(u);
}

export function toPublicRelative(u: string) {
  // Acepta "/public/uploads/x.png" o "/uploads/x.png"
  // Normaliza a "/uploads/x.png"
  let p = u.trim();
  if (!p.startsWith("/")) p = `/${p}`;
  p = p.replace(/^\/public\//, "/");
  return p;
}

export function publicDiskPathFromUrl(u: string) {
  // Convierte "/uploads/x.png" -> "<cwd>/public/uploads/x.png"
  const rel = toPublicRelative(u); // "/uploads/x.png"
  const disk = path.join(process.cwd(), "public", rel); // join maneja slashes
  // Protección contra traversal
  const publicRoot = path.join(process.cwd(), "public");
  if (!disk.startsWith(publicRoot)) {
    throw new Error("INVALID_PATH");
  }
  return disk;
}