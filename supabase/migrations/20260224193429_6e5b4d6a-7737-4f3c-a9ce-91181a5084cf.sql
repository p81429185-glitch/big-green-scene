
-- Add UPDATE policy for videos bucket (needed for TUS resumable PATCH requests)
DROP POLICY IF EXISTS "Allow authenticated users to update videos" ON storage.objects;
CREATE POLICY "Allow authenticated users to update videos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'videos')
WITH CHECK (bucket_id = 'videos');

-- Add UPDATE policy for thumbnails bucket (needed for upsert operations)
DROP POLICY IF EXISTS "Allow authenticated users to update thumbnails" ON storage.objects;
CREATE POLICY "Allow authenticated users to update thumbnails"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'thumbnails')
WITH CHECK (bucket_id = 'thumbnails');
