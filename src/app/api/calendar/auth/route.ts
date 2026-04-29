import { NextResponse } from "next/server";
import { getAuthUrl }   from "@/lib/calendar/google";

// Redirects the user to Google's OAuth consent screen.
// After granting access, Google redirects to GOOGLE_REDIRECT_URI (/api/calendar/callback).
export async function GET() {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.json(
      { error: "Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET." },
      { status: 503 },
    );
  }
  return NextResponse.redirect(getAuthUrl());
}
