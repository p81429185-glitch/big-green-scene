
-- Tabela folders
CREATE TABLE public.folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to folders" ON public.folders FOR ALL USING (true) WITH CHECK (true);

-- Tabela videos
CREATE TABLE public.videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  file_name TEXT NOT NULL,
  size BIGINT NOT NULL DEFAULT 0,
  folder_id UUID REFERENCES public.folders(id) ON DELETE SET NULL,
  storage_path TEXT NOT NULL,
  thumbnail_url TEXT,
  plays INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to videos" ON public.videos FOR ALL USING (true) WITH CHECK (true);

-- Storage bucket for videos
INSERT INTO storage.buckets (id, name, public) VALUES ('videos', 'videos', true);

-- Storage bucket for thumbnails
INSERT INTO storage.buckets (id, name, public) VALUES ('thumbnails', 'thumbnails', true);

-- Storage policies for videos bucket
CREATE POLICY "Allow public read videos" ON storage.objects FOR SELECT USING (bucket_id = 'videos');
CREATE POLICY "Allow public upload videos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'videos');
CREATE POLICY "Allow public delete videos" ON storage.objects FOR DELETE USING (bucket_id = 'videos');

-- Storage policies for thumbnails bucket
CREATE POLICY "Allow public read thumbnails" ON storage.objects FOR SELECT USING (bucket_id = 'thumbnails');
CREATE POLICY "Allow public upload thumbnails" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'thumbnails');
CREATE POLICY "Allow public delete thumbnails" ON storage.objects FOR DELETE USING (bucket_id = 'thumbnails');
