-- 查找 1030-语文-2 视频中郭其其缺失的句子
-- 2024-12-12

-- 1. 首先找出这个视频的所有不同句子编号（从所有标注人的数据中汇总）
SELECT 
  '=== 所有句子编号汇总 ===' as info;

WITH video_id_cte AS (
  SELECT id FROM videos WHERE name LIKE '%1030-语文-2%' OR name LIKE '%语文-2%' LIMIT 1
),
all_sentences AS (
  SELECT DISTINCT 
    sentence_no,
    MIN(original_text) as original_text,
    MIN(ai_rewritten_text) as ai_rewritten_text,
    MIN(time_range) as time_range,
    MIN(start_time) as start_time,
    MIN(end_time) as end_time
  FROM annotations
  WHERE video_id = (SELECT id FROM video_id_cte)
    AND sentence_no IS NOT NULL
  GROUP BY sentence_no
)
SELECT 
  COUNT(*) as total_unique_sentences,
  MIN(sentence_no) as min_sentence_no,
  MAX(sentence_no) as max_sentence_no
FROM all_sentences;

-- 2. 查看郭其其已有的句子编号
SELECT 
  '=== 郭其其已有的句子编号 ===' as info;

SELECT 
  sentence_no
FROM annotations
WHERE video_id = (SELECT id FROM videos WHERE name LIKE '%1030-语文-2%' OR name LIKE '%语文-2%' LIMIT 1)
  AND annotator = '郭其其'
ORDER BY sentence_no;

-- 3. 找出郭其其缺失的句子（完整句子列表 - 郭其其已有）
SELECT 
  '=== 郭其其缺失的句子 ===' as info;

WITH video_id_cte AS (
  SELECT id FROM videos WHERE name LIKE '%1030-语文-2%' OR name LIKE '%语文-2%' LIMIT 1
),
all_sentences AS (
  SELECT DISTINCT sentence_no
  FROM annotations
  WHERE video_id = (SELECT id FROM video_id_cte)
    AND sentence_no IS NOT NULL
),
guoqiqi_sentences AS (
  SELECT DISTINCT sentence_no
  FROM annotations
  WHERE video_id = (SELECT id FROM video_id_cte)
    AND annotator = '郭其其'
)
SELECT 
  a.sentence_no as missing_sentence_no
FROM all_sentences a
LEFT JOIN guoqiqi_sentences g ON a.sentence_no = g.sentence_no
WHERE g.sentence_no IS NULL
ORDER BY a.sentence_no;

-- 4. 查看缺失句子的详细信息（从其他标注人的数据中获取）
SELECT 
  '=== 缺失句子的详细信息（供补充用）===' as info;

WITH video_id_cte AS (
  SELECT id FROM videos WHERE name LIKE '%1030-语文-2%' OR name LIKE '%语文-2%' LIMIT 1
),
all_sentences AS (
  SELECT DISTINCT sentence_no
  FROM annotations
  WHERE video_id = (SELECT id FROM video_id_cte)
    AND sentence_no IS NOT NULL
),
guoqiqi_sentences AS (
  SELECT DISTINCT sentence_no
  FROM annotations
  WHERE video_id = (SELECT id FROM video_id_cte)
    AND annotator = '郭其其'
),
missing_sentences AS (
  SELECT a.sentence_no
  FROM all_sentences a
  LEFT JOIN guoqiqi_sentences g ON a.sentence_no = g.sentence_no
  WHERE g.sentence_no IS NULL
)
SELECT DISTINCT
  a.sentence_no,
  a.original_text,
  a.ai_rewritten_text,
  a.time_range,
  a.start_time,
  a.end_time,
  a.annotator as source_annotator
FROM annotations a
INNER JOIN missing_sentences m ON a.sentence_no = m.sentence_no
WHERE a.video_id = (SELECT id FROM video_id_cte)
  AND a.sentence_no IS NOT NULL
ORDER BY a.sentence_no;

-- 5. 检查视频表中记录的 total_sentences
SELECT 
  '=== videos 表中的 total_sentences ===' as info;

SELECT 
  name,
  total_sentences,
  is_completed,
  is_published
FROM videos
WHERE name LIKE '%1030-语文-2%' OR name LIKE '%语文-2%';


