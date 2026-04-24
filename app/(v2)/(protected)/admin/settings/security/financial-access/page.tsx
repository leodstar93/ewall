import Link from "next/link";
import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminSettingsAccess } from "@/lib/admin-settings-access";
import tableStyles from "@/app/(v2)/(protected)/admin/components/ui/DataTable.module.css";

function normalizeFilter(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0]?.trim() ?? "";
  return value?.trim() ?? "";
}

export default async function FinancialAccessAuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const access = await requireAdminSettingsAccess("financial_audit:read");
  if (!access.ok) {
    redirect(access.reason === "UNAUTHENTICATED" ? "/login" : "/forbidden");
  }

  const params = await searchParams;
  const actor = normalizeFilter(params.actor);
  const target = normalizeFilter(params.target);
  const filing = normalizeFilter(params.filing);
  const action = normalizeFilter(params.action);
  const dateFrom = normalizeFilter(params.dateFrom);
  const dateTo = normalizeFilter(params.dateTo);

  const where: Prisma.FinancialAccessAuditWhereInput = {};
  const andClauses: Prisma.FinancialAccessAuditWhereInput[] = [];

  if (actor) {
    andClauses.push({
      actorUser: {
        is: {
          OR: [
            { id: { contains: actor, mode: "insensitive" } },
            { email: { contains: actor, mode: "insensitive" } },
            { name: { contains: actor, mode: "insensitive" } },
          ],
        },
      },
    });
  }

  if (target) {
    andClauses.push({
      targetUser: {
        is: {
          OR: [
            { id: { contains: target, mode: "insensitive" } },
            { email: { contains: target, mode: "insensitive" } },
            { name: { contains: target, mode: "insensitive" } },
          ],
        },
      },
    });
  }

  if (filing) {
    andClauses.push({
      OR: [
        { filingId: { contains: filing, mode: "insensitive" } },
        { resourceId: { contains: filing, mode: "insensitive" } },
      ],
    });
  }

  if (action) {
    andClauses.push({ action: { equals: action, mode: "insensitive" } });
  }

  if (dateFrom || dateTo) {
    const createdAt: Prisma.DateTimeFilter = {};
    if (dateFrom) {
      const parsed = new Date(dateFrom);
      if (!Number.isNaN(parsed.getTime())) createdAt.gte = parsed;
    }
    if (dateTo) {
      const parsed = new Date(`${dateTo}T23:59:59.999Z`);
      if (!Number.isNaN(parsed.getTime())) createdAt.lte = parsed;
    }
    andClauses.push({ createdAt });
  }

  if (andClauses.length > 0) {
    where.AND = andClauses;
  }

  const audits = await prisma.financialAccessAudit.findMany({
    where,
    include: {
      actorUser: { select: { email: true, id: true, name: true } },
      paymentMethod: { select: { bankName: true, id: true, label: true, last4: true } },
      targetUser: { select: { email: true, id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    color: "#aaa",
    display: "block",
    marginBottom: 6,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className={tableStyles.card}>
        <div className={tableStyles.header}>
          <div>
            <div className={tableStyles.subtitle}>Security</div>
            <div className={tableStyles.title}>Financial access audit log</div>
          </div>
          <Link
            href="/admin/settings"
            className={tableStyles.btn}
            style={{ textDecoration: "none" }}
          >
            ← Back to settings
          </Link>
        </div>
        <div style={{ padding: 20 }}>
          <form
            style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr 1fr" }}
          >
            <label>
              <span style={labelStyle}>Actor</span>
              <input
                name="actor"
                defaultValue={actor}
                style={{
                  border: "1px solid var(--br)",
                  borderRadius: 8,
                  padding: "8px 12px",
                  fontSize: 13,
                  outline: "none",
                  width: "100%",
                  color: "var(--b)",
                }}
              />
            </label>
            <label>
              <span style={labelStyle}>Target</span>
              <input
                name="target"
                defaultValue={target}
                style={{
                  border: "1px solid var(--br)",
                  borderRadius: 8,
                  padding: "8px 12px",
                  fontSize: 13,
                  outline: "none",
                  width: "100%",
                  color: "var(--b)",
                }}
              />
            </label>
            <label>
              <span style={labelStyle}>Filing or resource</span>
              <input
                name="filing"
                defaultValue={filing}
                style={{
                  border: "1px solid var(--br)",
                  borderRadius: 8,
                  padding: "8px 12px",
                  fontSize: 13,
                  outline: "none",
                  width: "100%",
                  color: "var(--b)",
                }}
              />
            </label>
            <label>
              <span style={labelStyle}>Action</span>
              <input
                name="action"
                defaultValue={action}
                placeholder="REVEAL"
                style={{
                  border: "1px solid var(--br)",
                  borderRadius: 8,
                  padding: "8px 12px",
                  fontSize: 13,
                  outline: "none",
                  width: "100%",
                  color: "var(--b)",
                }}
              />
            </label>
            <label>
              <span style={labelStyle}>Date from</span>
              <input
                type="date"
                name="dateFrom"
                defaultValue={dateFrom}
                style={{
                  border: "1px solid var(--br)",
                  borderRadius: 8,
                  padding: "8px 12px",
                  fontSize: 13,
                  outline: "none",
                  width: "100%",
                  color: "var(--b)",
                }}
              />
            </label>
            <label>
              <span style={labelStyle}>Date to</span>
              <input
                type="date"
                name="dateTo"
                defaultValue={dateTo}
                style={{
                  border: "1px solid var(--br)",
                  borderRadius: 8,
                  padding: "8px 12px",
                  fontSize: 13,
                  outline: "none",
                  width: "100%",
                  color: "var(--b)",
                }}
              />
            </label>
            <div
              style={{
                gridColumn: "1 / -1",
                display: "flex",
                gap: 8,
              }}
            >
              <button
                type="submit"
                className={`${tableStyles.btn} ${tableStyles.btnPrimary}`}
              >
                Apply filters
              </button>
              <Link
                href="/admin/settings/security/financial-access"
                className={tableStyles.btn}
                style={{ textDecoration: "none" }}
              >
                Clear
              </Link>
            </div>
          </form>
        </div>
      </div>

      <div className={tableStyles.card}>
        <div className={tableStyles.header}>
          <div>
            <div className={tableStyles.title}>Recent audit entries</div>
            <div className={tableStyles.subtitle}>
              {audits.length} matching record(s)
            </div>
          </div>
        </div>
        <div className={tableStyles.tableWrap}>
          <table className={tableStyles.table} style={{ minWidth: 1100 }}>
            <thead>
              <tr>
                <th>When</th>
                <th>Action</th>
                <th>Actor</th>
                <th>Target</th>
                <th>Filing</th>
                <th>Payment method</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {audits.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    style={{ textAlign: "center", color: "#aaa", fontSize: 13, padding: 32 }}
                  >
                    No financial access audits matched these filters.
                  </td>
                </tr>
              ) : (
                audits.map((audit) => (
                  <tr key={audit.id}>
                    <td style={{ fontSize: 12, color: "#777" }}>
                      {audit.createdAt.toLocaleString("en-US")}
                    </td>
                    <td className={tableStyles.nameCell}>{audit.action}</td>
                    <td style={{ fontSize: 13 }}>
                      {[audit.actorUser.name, audit.actorUser.email]
                        .filter(Boolean)
                        .join(" | ") || audit.actorUserId}
                    </td>
                    <td style={{ fontSize: 13, color: "#777" }}>
                      {audit.targetUser
                        ? [audit.targetUser.name, audit.targetUser.email]
                            .filter(Boolean)
                            .join(" | ")
                        : "-"}
                    </td>
                    <td style={{ fontSize: 12, color: "#777" }}>
                      {audit.filingType && audit.filingId
                        ? `${audit.filingType} | ${audit.filingId}`
                        : "-"}
                    </td>
                    <td style={{ fontSize: 12, color: "#777" }}>
                      {audit.paymentMethod
                        ? [
                            audit.paymentMethod.label ||
                              audit.paymentMethod.bankName ||
                              audit.paymentMethod.id,
                            audit.paymentMethod.last4
                              ? `****${audit.paymentMethod.last4}`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" | ")
                        : "-"}
                    </td>
                    <td style={{ fontSize: 12, color: "#777" }}>{audit.reason || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
