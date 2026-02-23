
CREATE TABLE public.video_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  viewer_session text NOT NULL,
  watch_duration_seconds integer NOT NULL DEFAULT 0,
  video_duration_seconds integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint for upsert
CREATE UNIQUE INDEX video_views_video_session_idx ON public.video_views (video_id, viewer_session);

ALTER TABLE public.video_views ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read analytics
CREATE POLICY "Authenticated users can read video_views"
ON public.video_views FOR SELECT
TO authenticated
USING (true);

-- Anyone (anon + authenticated) can insert/update views for tracking
CREATE POLICY "Anyone can insert video_views"
ON public.video_views FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Anyone can update video_views"
ON public.video_views FOR UPDATE
TO anon, authenticated
USING (true);
