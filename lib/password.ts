import { randomBytes } from "crypto";

function randomIndex(max: number) {
  return randomBytes(4).readUInt32BE(0) % max;
}

export function generateTemporaryPassword(length = 14) {
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const numbers = "23456789";
  const symbols = "!@#$%^&*";

  const groups = [lower, upper, numbers, symbols];
  const allChars = groups.join("");

  const chars: string[] = groups.map((group) => group[randomIndex(group.length)]);
  while (chars.length < length) {
    chars.push(allChars[randomIndex(allChars.length)]);
  }

  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomIndex(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
}
