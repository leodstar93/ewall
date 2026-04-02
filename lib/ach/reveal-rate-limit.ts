import { AchServiceError } from "@/lib/ach/errors";

const WINDOW_MS = 5 * 60 * 1000;
const MAX_REVEALS_PER_WINDOW = 5;

const revealAttempts = new Map<string, number[]>();

export function assertRevealRateLimit(actorUserId: string, paymentMethodId: string) {
  const key = `${actorUserId}:${paymentMethodId}`;
  const now = Date.now();
  const recent = (revealAttempts.get(key) ?? []).filter(
    (timestamp) => now - timestamp < WINDOW_MS,
  );

  if (recent.length >= MAX_REVEALS_PER_WINDOW) {
    throw new AchServiceError(
      "Reveal rate limit exceeded for this payment method. Please wait a few minutes before trying again.",
      429,
    );
  }

  recent.push(now);
  revealAttempts.set(key, recent);
}
