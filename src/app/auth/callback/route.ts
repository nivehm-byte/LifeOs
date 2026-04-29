import { NextResponse }    from "next/server";
import { createClient }    from "@/lib/supabase/server";

// Supabase redirects here after the user clicks the magic-link email.
// The code is exchanged for a session, then the user is forwarded to /today.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code  = searchParams.get("code");
  const next  = searchParams.get("next") ?? "/today";

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Something went wrong — send back to login with an error hint
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
