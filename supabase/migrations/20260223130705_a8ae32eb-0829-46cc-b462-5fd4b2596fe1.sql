
-- Table for domain restriction settings per video
CREATE TABLE public.video_embed_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE UNIQUE,
  restrict_domain boolean NOT NULL DEFAULT false,
  allowed_domains text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.video_embed_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read embed settings"
  ON public.video_embed_settings FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert embed settings"
  ON public.video_embed_settings FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update embed settings"
  ON public.video_embed_settings FOR UPDATE
  USING (true);

CREATE TRIGGER update_video_embed_settings_updated_at
  BEFORE UPDATE ON public.video_embed_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
