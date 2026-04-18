import { NextRequest } from "next/server";
import {
  listActiveNewsUpdateSlides,
  NEWS_UPDATE_AUDIENCES,
  type NewsUpdateAudience,
} from "@/lib/services/news-updates.service";

function parseAudience(value: string | null): NewsUpdateAudience {
  if (value && NEWS_UPDATE_AUDIENCES.includes(value as NewsUpdateAudience)) {
    return value as NewsUpdateAudience;
  }
  return "ALL";
}

export async function GET(request: NextRequest) {
  const audience = parseAudience(request.nextUrl.searchParams.get("audience"));
  const slides = await listActiveNewsUpdateSlides(audience);

  return Response.json({ slides });
}
