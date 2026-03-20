import { DmvRegistrationType } from "@prisma/client";

export function deriveRegistrationType(input: {
  isInterstate: boolean;
  declaredGrossWeight?: number | null;
  jurisdictionsCount?: number | null;
}) {
  void input.declaredGrossWeight;

  if (input.isInterstate) return DmvRegistrationType.IRP;
  if ((input.jurisdictionsCount ?? 1) > 1) return DmvRegistrationType.IRP;
  return DmvRegistrationType.NEVADA_ONLY;
}
