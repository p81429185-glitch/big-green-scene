
-- 1. Make user_id nullable (no default needed)
ALTER TABLE public.brand_settings ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.brand_settings ALTER COLUMN user_id DROP DEFAULT;

-- 2. Create permissive RLS policy
CREATE POLICY "Allow all access to brand_settings"
ON public.brand_settings
FOR ALL
USING (true)
WITH CHECK (true);

-- 3. Create video_chapters table
CREATE TABLE public.video_chapters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  timestamp_seconds INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.video_chapters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to video_chapters"
ON public.video_chapters
FOR ALL
USING (true)
WITH CHECK (true);

-- 4. Add subtitles_srt column to videos
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS subtitles_srt TEXT;
