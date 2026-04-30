import { type NextRequest } from "next/server";
import { getEventsByRange } from "@/lib/calendar/queries";
import { ok, handleError } from "@/lib/utils/api";

export async function GET(request: NextRequest) {
  try {
    const from = request.nextUrl.searchParams.get("from") ?? "";
    const to   = request.nextUrl.searchParams.get("to")   ?? "";
    if (!from || !to) throw new Error("from and to query params are required");
    const events = await getEventsByRange(from, to);
    return ok(events);
  } catch (e) {
    return handleError(e);
  }
}
