import { NextResponse }             from "next/server";
import { exchangeCodeForTokens, saveTokens } from "@/lib/calendar/google";
import { ensureCorporateBlock, syncFromGoogle } from "@/lib/calendar/sync";
import { createServiceClient }       from "@/lib/supabase/server";

// Handles the OAuth redirect from Google after the user grants calendar access.
// Exchanges the auth code for tokens, stores them, creates the corporate block,
// runs an initial sync, then redirects to /today.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code  = searchParams.get("code");
  const error = searchParams.get("error");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  if (error || !code) {
    console.error("[calendar/callback] OAuth error:", error ?? "missing code");
    return NextResponse.redirect(`${appUrl}/settings?error=calendar_auth_denied`);
  }

  try {
    const supabase = createServiceClient();
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id")
      .limit(1)
      .single();

    if (userError || !user) {
      return NextResponse.redirect(`${appUrl}/settings?error=no_user`);
    }

    // Exchange code → tokens and persist
    const tokens = await exchangeCodeForTokens(code);
    await saveTokens(user.id, tokens);

    // Create recurring corporate block (7:30–15:30 SAST weekdays)
    await ensureCorporateBlock(user.id);

    // Pull the first batch of events from Google Calendar
    await syncFromGoogle(user.id);

    return NextResponse.redirect(`${appUrl}/today?connected=calendar`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[calendar/callback]", message);
    return NextResponse.redirect(`${appUrl}/settings?error=calendar_setup_failed`);
  }
}
