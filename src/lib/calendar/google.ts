import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import type { Credentials } from "google-auth-library";
import { createServiceClient } from "@/lib/supabase/server";

const SCOPES = ["https://www.googleapis.com/auth/calendar"];

export function getOAuthClient(): OAuth2Client {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );
}

export function getAuthUrl(): string {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",   // force refresh_token on every auth
    scope: SCOPES,
  });
}

export async function exchangeCodeForTokens(code: string): Promise<Credentials> {
  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);
  return tokens;
}

// Full upsert — used on initial OAuth connect (has both access + refresh token).
export async function saveTokens(userId: string, tokens: Credentials): Promise<void> {
  if (!tokens.access_token) throw new Error("access_token missing from Google response");

  const supabase = createServiceClient();
  const expiry = tokens.expiry_date
    ? new Date(tokens.expiry_date).toISOString()
    : new Date(Date.now() + 3_600_000).toISOString();

  if (tokens.refresh_token) {
    const { error } = await supabase.from("google_tokens").upsert(
      {
        user_id:       userId,
        access_token:  tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expiry:  expiry,
        updated_at:    new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(`Failed to save tokens: ${error.message}`);
  } else {
    // Token refresh — preserve existing refresh_token, only update access fields
    const { error } = await supabase
      .from("google_tokens")
      .update({
        access_token: tokens.access_token,
        token_expiry: expiry,
        updated_at:   new Date().toISOString(),
      })
      .eq("user_id", userId);
    if (error) throw new Error(`Failed to update access token: ${error.message}`);
  }
}

// Store the Google event ID of the recurring corporate block.
export async function setCorporateEventId(userId: string, eventId: string): Promise<void> {
  const supabase = createServiceClient();
  await supabase
    .from("google_tokens")
    .update({ corporate_event_id: eventId, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
}

// Returns a fully-authorized OAuth2Client with auto-refresh wired up.
export async function getAuthorizedClient(userId: string): Promise<OAuth2Client> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("google_tokens")
    .select("access_token, refresh_token, token_expiry")
    .eq("user_id", userId)
    .single();

  if (error || !data) throw new Error("Google Calendar not connected. Visit /api/calendar/auth to connect.");

  const client = getOAuthClient();
  client.setCredentials({
    access_token:  data.access_token,
    refresh_token: data.refresh_token,
    expiry_date:   new Date(data.token_expiry).getTime(),
  });

  // Persist new tokens whenever the library silently refreshes them
  client.on("tokens", async (newTokens) => {
    await saveTokens(userId, newTokens).catch((err) =>
      console.error("[calendar/google] token refresh persist failed:", err)
    );
  });

  return client;
}

// Returns the stored token row, or null if not connected.
export async function getStoredTokenRow(userId: string) {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("google_tokens")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}
