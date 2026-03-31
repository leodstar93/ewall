import { NextRequest } from "next/server";
import { DmvServiceError } from "@/services/dmv/shared";

export function toDmvRenewalErrorResponse(error: unknown, fallback: string) {
  if (error instanceof DmvServiceError) {
    return Response.json(
      { error: error.message, code: error.code, details: error.details },
      { status: error.status },
    );
  }

  console.error(fallback, error);
  return Response.json({ error: fallback }, { status: 500 });
}

export async function parseJsonBody<T>(request: NextRequest) {
  return (await request.json()) as T;
}

