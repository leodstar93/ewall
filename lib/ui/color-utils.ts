function channelToLinear(value: number) {
  const normalized = value / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function getRelativeLuminance(red: number, green: number, blue: number) {
  return (
    0.2126 * channelToLinear(red) +
    0.7152 * channelToLinear(green) +
    0.0722 * channelToLinear(blue)
  );
}

function hexToRgb(hex: string) {
  const raw = hex.replace("#", "");
  const normalized =
    raw.length === 3
      ? raw
          .split("")
          .map((character) => `${character}${character}`)
          .join("")
      : raw;

  const value = Number.parseInt(normalized, 16);
  if (!Number.isFinite(value)) return null;

  return {
    red: (value >> 16) & 255,
    green: (value >> 8) & 255,
    blue: value & 255,
  };
}

export function isLightBackground(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes("white")) return true;

  const colors: Array<{ red: number; green: number; blue: number }> = [];

  for (const match of normalized.matchAll(/#([0-9a-f]{6}|[0-9a-f]{3})\b/g)) {
    const color = hexToRgb(match[0]);
    if (color) colors.push(color);
  }

  for (const match of normalized.matchAll(
    /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/g,
  )) {
    colors.push({
      red: Number(match[1]),
      green: Number(match[2]),
      blue: Number(match[3]),
    });
  }

  if (colors.length === 0) return false;

  const averageLuminance =
    colors.reduce(
      (total, color) =>
        total + getRelativeLuminance(color.red, color.green, color.blue),
      0,
    ) / colors.length;

  return averageLuminance >= 0.62;
}
