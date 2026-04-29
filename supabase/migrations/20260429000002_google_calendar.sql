-- google_tokens: stores OAuth credentials and metadata per user.
-- One row per user; updated on every token refresh.
CREATE TABLE public.google_tokens (
  user_id              uuid        PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  access_token         text        NOT NULL,
  refresh_token        text        NOT NULL,
  token_expiry         timestamptz NOT NULL,
  calendar_id          text        NOT NULL DEFAULT 'primary',
  corporate_event_id   text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.google_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own google tokens"
  ON public.google_tokens FOR ALL
  USING (auth.uid() = user_id);

-- Track whether a calendar_events row originated in LifeOS or was imported from Google.
-- Prevents re-pushing Google-imported events back to Google on syncToGoogle.
ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'lifeos'
    CHECK (source IN ('lifeos', 'google'));
