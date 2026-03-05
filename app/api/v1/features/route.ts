import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

async function exists(p: string) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  // root del proyecto
  const root = process.cwd();
  const featuresDir = path.join(root, "features");

  try {
    const entries = await fs.readdir(featuresDir, { withFileTypes: true });

    const items = await Promise.all(
      entries
        .filter((e) => e.isDirectory())
        .map(async (e) => {
          const name = e.name;

          // Solo cuenta si tiene client.tsx o client.jsx (ajusta si usas otros)
          const pageTsx = path.join(featuresDir, name, "client.tsx");
          const pageJsx = path.join(featuresDir, name, "client.jsx");

          const hasPage = (await exists(pageTsx)) || (await exists(pageJsx));
          if (!hasPage) return null;

          return {
            name,
            href: `/${name}`, // <- como pediste: /document
          };
        })
      );
      

    return NextResponse.json(items.filter(Boolean));
  } catch (err) {
    // Si no existe /features o hay error, devuelve lista vacía
    return NextResponse.json([]);
  }
}