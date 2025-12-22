-- 检查视频 "1030-语文-2.mp4" 的标注数据
-- 2024-12-12

-- 1. 查找这个视频的基本信息
SELECT 
  '=== 视频基本信息 ===' as info;

SELECT 
  id,
  name,
  subject,
  total_sentences,
  is_published,
  is_completed
FROM videos
WHERE name LIKE '%1030-语文-2%'
   OR name LIKE '%语文-2%';

-- 2. 查看这个视频在 annotations 表中的所有原始句子（去重）
SELECT 
  '=== annotations 表中的所有不同句子（按 sentence_no 去重）===' as info;

SELECT 
  video_id,
  sentence_no,
  original_text,
  COUNT(DISTINCT annotator) as annotator_count,
  MIN(created_at) as first_created_at
FROM annotations
WHERE video_id IN (
  SELECT id FROM videos WHERE name LIKE '%1030-语文-2%' OR name LIKE '%语文-2%'
)
  AND annotator IS NOT NULL
  AND annotator != ''
GROUP BY video_id, sentence_no, original_text
ORDER BY sentence_no
LIMIT 120;

-- 3. 统计这个视频的句子总数
SELECT 
  '=== 句子总数统计 ===' as info;

SELECT 
  video_id,
  COUNT(DISTINCT sentence_no) as unique_sentence_count,
  MAX(sentence_no) as max_sentence_no,
  MIN(sentence_no) as min_sentence_no
FROM annotations
WHERE video_id IN (
  SELECT id FROM videos WHERE name LIKE '%1030-语文-2%' OR name LIKE '%语文-2%'
)
  AND annotator IS NOT NULL
  AND annotator != ''
GROUP BY video_id;

-- 4. 查看标注人"郭其其"的标注数据
SELECT 
  '=== 郭其其的标注数据 ===' as info;

SELECT 
  video_id,
  sentence_no,
  annotator,
  status,
  human_annotated_text,
  created_at
FROM annotations
WHERE video_id IN (
  SELECT id FROM videos WHERE name LIKE '%1030-语文-2%' OR name LIKE '%语文-2%'
)
  AND annotator = '郭其其'
ORDER BY sentence_no
LIMIT 120;

-- 5. 检查是否有原始模板数据（annotator 为空）
SELECT 
  '=== 原始模板数据（annotator 为空或 null）===' as info;

SELECT 
  video_id,
  sentence_no,
  annotator,
  original_text,
  created_at
FROM annotations
WHERE video_id IN (
  SELECT id FROM videos WHERE name LIKE '%1030-语文-2%' OR name LIKE '%语文-2%'
)
  AND (annotator IS NULL OR annotator = '')
ORDER BY sentence_no
LIMIT 120;

-- 6. 查看所有标注人的数据统计
SELECT 
  '=== 所有标注人的数据统计 ===' as info;

SELECT 
  annotator,
  COUNT(*) as total_records,
  COUNT(DISTINCT sentence_no) as unique_sentences,
  SUM(CASE WHEN status = true THEN 1 ELSE 0 END) as completed_count
FROM annotations
WHERE video_id IN (
  SELECT id FROM videos WHERE name LIKE '%1030-语文-2%' OR name LIKE '%语文-2%'
)
  AND annotator IS NOT NULL
  AND annotator != ''
GROUP BY annotator
ORDER BY annotator;


