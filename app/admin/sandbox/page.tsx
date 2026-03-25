import { redirect } from "next/navigation";
import { getDbForEnvironment } from "@/lib/db/resolve-db";
import { getForcedSandboxEnvironment } from "@/lib/db/env";
import { getActingContext } from "@/lib/auth/get-acting-context";
import { getSandboxSchemaStatus } from "@/services/sandbox/getSandboxSchemaStatus";
import { ensureSandboxBaseData, listSandboxDemoUsers } from "@/services/sandbox/shared";
import { requireSandboxAccess } from "@/server/guards/requireSandboxAccess";
import SandboxConsole from "./sandbox-console";

export default async function SandboxPage() {
  try {
    await requireSandboxAccess();
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      redirect("/login");
    }
    redirect("/forbidden");
  }

  const environment = getForcedSandboxEnvironment();
  const db = getDbForEnvironment(environment);
  const schemaStatus = await getSandboxSchemaStatus(db);

  if (!schemaStatus.isReady) {
    return (
      <div className="space-y-6">
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
            Sandbox setup required
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-amber-950">
            The sandbox database is missing required tables.
          </h1>
          <p className="mt-3 text-sm text-amber-900">
            This sandbox route is hard-wired to <code>SANDBOX_DATABASE_URL</code>. It will not
            fall back to production, so the schema must be provisioned before the console can load.
          </p>
          <div className="mt-4 rounded-xl border border-amber-300 bg-white/70 p-4">
            <p className="text-sm font-medium text-amber-950">Missing tables</p>
            <p className="mt-2 text-sm text-amber-900">
              {schemaStatus.missingTables.join(", ")}
            </p>
          </div>
          <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-950 p-4 text-sm text-zinc-100">
            <p className="font-medium text-white">Run one of these commands to initialize sandbox</p>
            <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs text-zinc-200">
              npm run db:push:sandbox{"\n"}
              npx prisma db push --config prisma.sandbox.config.ts
            </pre>
          </div>
        </section>
      </div>
    );
  }

  await ensureSandboxBaseData(db);

  const [actingContext, scenarios, logs, demoUsers, activeImpersonationCount] =
    await Promise.all([
      getActingContext(),
      db.sandboxScenario.findMany({
        where: { isActive: true },
        orderBy: [{ moduleKey: "asc" }, { name: "asc" }],
      }),
      db.sandboxAuditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      listSandboxDemoUsers(db),
      db.sandboxImpersonationSession.count({
        where: { isActive: true },
      }),
    ]);

  const lastReset = logs.find((log) => log.action === "sandbox.reset")?.createdAt ?? null;

  return (
    <SandboxConsole
      actingContext={actingContext}
      activeImpersonationCount={activeImpersonationCount}
      demoUsers={demoUsers.map((user) => ({
        id: user.id,
        email: user.email ?? "",
        name: user.name ?? "Unnamed demo user",
        roles: user.roles.map((role) => role.role.name),
      }))}
      lastReset={lastReset?.toISOString() ?? null}
      logs={logs.map((log) => ({
        id: log.id,
        action: log.action,
        actorUserId: log.actorUserId,
        actingAsRole: log.actingAsRole,
        entityType: log.entityType,
        entityId: log.entityId,
        createdAt: log.createdAt.toISOString(),
      }))}
      scenarios={scenarios.map((scenario) => ({
        key: scenario.key,
        name: scenario.name,
        description: scenario.description,
        moduleKey: scenario.moduleKey,
      }))}
    />
  );
}
