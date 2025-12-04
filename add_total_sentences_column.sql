-- 为 videos 表添加 total_sentences 字段
-- 用于存储上传的标注文件中的句子总数

-- 1. 添加列
ALTER TABLE videos 
ADD COLUMN IF NOT EXISTS total_sentences INTEGER DEFAULT 0;

-- 2. 添加注释
COMMENT ON COLUMN videos.total_sentences IS '视频总句数（上传的标注文件中的句子总数）';

-- 3. 为已有视频更新 total_sentences（从 annotations 表统计）
UPDATE videos v
SET total_sentences = (
  SELECT COUNT(DISTINCT sentence_no)
  FROM annotations
  WHERE video_id = v.id
)
WHERE total_sentences = 0 OR total_sentences IS NULL;

-- 4. 验证更新结果
SELECT 
  id,
  name,
  total_sentences,
  (SELECT COUNT(DISTINCT sentence_no) FROM annotations WHERE video_id = videos.id) as actual_count
FROM videos
ORDER BY created_at DESC
LIMIT 10;

