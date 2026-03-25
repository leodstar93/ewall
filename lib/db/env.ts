import { cookies } from "next/headers";
import { isAppEnvironment, type AppEnvironment } from "@/lib/db/types";

export const APP_ENVIRONMENT_COOKIE = "app_environment";

export async function getCurrentEnvironment(): Promise<AppEnvironment> {
  const cookieStore = await cookies();
  const value = cookieStore.get(APP_ENVIRONMENT_COOKIE)?.value;

  if (isAppEnvironment(value)) {
    return value;
  }

  return "production";
}

export function getForcedSandboxEnvironment(): "sandbox" {
  return "sandbox";
}

export function isSandboxEnvironment(environment: AppEnvironment) {
  return environment === "sandbox";
}
