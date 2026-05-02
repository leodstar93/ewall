import { auth } from "@/auth";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";

const execAsync = promisify(exec);
const ROOT = path.resolve(process.cwd());

export const maxDuration = 300;

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
      const { stdout, stderr } = await execAsync("npx prisma db seed", {
        cwd: ROOT,
        timeout: 300_000,
      });
      return Response.json({
        ok: true,
        output: [stdout, stderr].filter(Boolean).join("\n"),
      });
    }

    if (action === "reset") {
      const { stdout: r1, stderr: e1 } = await execAsync(
        "npx prisma migrate reset --force --skip-seed",
        { cwd: ROOT, timeout: 300_000 },
      );
      const { stdout: r2, stderr: e2 } = await execAsync("npx prisma db seed", {
        cwd: ROOT,
        timeout: 300_000,
      });
      return Response.json({
        ok: true,
        output: [r1, e1, "--- seed ---", r2, e2].filter(Boolean).join("\n"),
      });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; message?: string };
    return Response.json(
      {
        ok: false,
        output: [err.stdout, err.stderr, err.message].filter(Boolean).join("\n"),
      },
      { status: 500 },
    );
  }
}
