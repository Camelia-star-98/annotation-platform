-- Supabase Storage CORS 和权限配置

-- 1. 允许所有用户上传到 videos bucket
CREATE POLICY "Allow public uploads to videos bucket"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (bucket_id = 'videos');

-- 2. 允许所有用户读取 videos bucket
CREATE POLICY "Allow public access to videos bucket"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'videos');

-- 3. 确保 videos bucket 是公开的
UPDATE storage.buckets
SET public = true
WHERE id = 'videos';

