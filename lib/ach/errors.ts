import { NextResponse } from "next/server";

export class AchServiceError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "AchServiceError";
    this.status = status;
  }
}

export function toAchErrorResponse(
  error: unknown,
  fallback = "Something went wrong while processing the ACH request.",
) {
  if (error instanceof AchServiceError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  console.error(error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}
