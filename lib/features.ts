import fs from "fs/promises";
import path from "path";

export type Feature = {
  name: string;
  label: string;
  section: string;
  order: number;
  icon?: string;
  href: string;
  permission?: string[];
};

export async function getFeatures(): Promise<Feature[]> {
  const root = process.cwd();
  const dir = path.join(root, "features");

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    const features = await Promise.all(
      entries
        .filter((e) => e.isDirectory())
        .map(async (e) => {
          const name = e.name;

          const metaPath = path.join(dir, name, "meta.json");

          let meta: any = {};

          try {
            const raw = await fs.readFile(metaPath, "utf8");
            meta = JSON.parse(raw);
          } catch {}

          return {
            name,
            label: meta.label ?? name,
            section: meta.section ?? "Modules",
            order: meta.order ?? 999,
            icon: meta.icon,
            href: meta.href ?? `/panel/${name}`,
            permissions: meta.permission,
          };
        })
    );

    return features.sort((a, b) => {
      if (a.section !== b.section) return a.section.localeCompare(b.section);
      return a.order - b.order;
    });
  } catch {
    return [];
  }
}