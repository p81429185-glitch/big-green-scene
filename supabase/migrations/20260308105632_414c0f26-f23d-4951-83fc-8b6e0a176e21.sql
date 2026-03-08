-- Add video processing status columns
ALTER TABLE public.videos 
ADD COLUMN IF NOT EXISTS is_processed boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS processing_status text NOT NULL DEFAULT 'pending';

-- Add comment for clarity
COMMENT ON COLUMN public.videos.is_processed IS 'Whether the video has been processed with faststart for instant playback';
COMMENT ON COLUMN public.videos.processing_status IS 'Processing status: pending, processing, ready, failed';