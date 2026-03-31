import fs from "fs/promises";
import path from "path";

type FeatureMeta = {
  label?: string;
  section?: string;
  order?: number;
  icon?: string;
  href?: string;
  permission?: string[];
  visible?: boolean;
  hidden?: boolean;
};

export type Feature = {
  name: string;
  label: string;
  section: string;
  order: number;
  icon?: string;
  href: string;
  permission?: string[];
  visible?: boolean;
  hidden?: boolean;
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

          let meta: FeatureMeta = {};

          try {
            const raw = await fs.readFile(metaPath, "utf8");
            meta = JSON.parse(raw) as FeatureMeta;
          } catch {}

          return {
            name,
            label: meta.label ?? name,
            section: meta.section ?? "Modules",
            order: meta.order ?? 999,
            icon: meta.icon,
            href: meta.href ?? `/panel/${name}`,
            permissions: meta.permission,
            visible: meta.visible !== false,
            hidden: meta.hidden === true,
          };
        })
    );

    return features
      .filter((feature) => feature.visible !== false && !feature.hidden)
      .sort((a, b) => {
      if (a.section !== b.section) return a.section.localeCompare(b.section);
      return a.order - b.order;
      });
  } catch {
    return [];
  }
}
