import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { runSeed } from "@/prisma/seed";

export const maxDuration = 300;

async function captureLogs(fn: () => Promise<void>): Promise<string> {
  const lines: string[] = [];
  const origLog = console.log;
  const origError = console.error;
  console.log = (...args: unknown[]) => {
    const line = args.map(String).join(" ");
    lines.push(line);
    origLog(line);
  };
  console.error = (...args: unknown[]) => {
    const line = args.map(String).join(" ");
    lines.push(line);
    origError(line);
  };
  try {
    await fn();
  } finally {
    console.log = origLog;
    console.error = origError;
  }
  return lines.join("\n");
}

async function truncateAllTables() {
  await prisma.$executeRawUnsafe(`
    DO $$
    DECLARE r RECORD;
    BEGIN
      FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'TRUNCATE TABLE "' || r.tablename || '" CASCADE';
      END LOOP;
    END $$;
  `);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.roles?.includes("ADMIN")) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { action?: unknown };
  try {
    body = (await request.json()) as { action?: unknown };
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const action = typeof body.action === "string" ? body.action : "";

  try {
    if (action === "seed") {
      const output = await captureLogs(() => runSeed());
      return Response.json({ ok: true, output });
    }

    if (action === "reset") {
      await truncateAllTables();
      const output = await captureLogs(() => runSeed());
      return Response.json({ ok: true, output: `--- tables truncated ---\n${output}` });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ ok: false, output: message }, { status: 500 });
  }
}
