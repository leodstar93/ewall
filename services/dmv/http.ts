import { DmvServiceError } from "@/services/dmv/shared";

export function toDmvErrorResponse(error: unknown, fallback: string) {
  if (error instanceof DmvServiceError) {
    return Response.json(
      { error: error.message, code: error.code, details: error.details },
      { status: error.status },
    );
  }

  console.error(fallback, error);
  return Response.json({ error: fallback }, { status: 500 });
}
