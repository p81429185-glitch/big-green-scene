
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS audio_track_path text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('audio-tracks', 'audio-tracks', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload audio tracks"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'audio-tracks');

CREATE POLICY "Public read access to audio tracks"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'audio-tracks');

CREATE POLICY "Authenticated users can update audio tracks"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'audio-tracks');

CREATE POLICY "Authenticated users can delete audio tracks"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'audio-tracks');
