import type { DbClient } from "@/lib/db/types";
import { getForm2290Settings, resolveForm2290Db } from "@/services/form2290/shared";
import { update2290Settings } from "@/services/form2290/update2290Settings";

export { getForm2290Settings, update2290Settings };

export async function list2290SettingsBundle(input?: { db?: DbClient }) {
  const db = resolveForm2290Db(input?.db);
  const [settings, taxPeriods] = await Promise.all([
    getForm2290Settings(db),
    db.form2290TaxPeriod.findMany({
      orderBy: [{ startDate: "desc" }],
    }),
  ]);

  return { settings, taxPeriods };
}
