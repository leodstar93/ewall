import { NextRequest } from "next/server";
import { runManagedSubscriptionRenewals } from "@/lib/services/subscription-engine.service";

function isAuthorizedCronRequest(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : null;
  const headerSecret = request.headers.get("x-cron-secret")?.trim() ?? null;
  const isVercelCron = request.headers.get("x-vercel-cron") === "1";

  if (isVercelCron) return true;
  if (!cronSecret) return false;
  return bearerToken === cronSecret || headerSecret === cronSecret;
}

async function handleCron(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runManagedSubscriptionRenewals();
    return Response.json({ ok: true, result });
  } catch (error) {
    console.error("Billing renewal cron failed", error);
    return Response.json({ error: "Billing renewal cron failed" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return handleCron(request);
}

export async function POST(request: NextRequest) {
  return handleCron(request);
}
