-- ========================================
-- 诊断待质检数据的SQL查询
-- ========================================

-- 1. 【最关键】统计 status=true 的数据分布
SELECT 
  '总数 (status=true)' as 类别,
  COUNT(*) as 数量
FROM annotations 
WHERE status = true

UNION ALL

SELECT 
  '有标注内容 (human_annotated_text不为空)' as 类别,
  COUNT(*) as 数量
FROM annotations 
WHERE status = true 
  AND human_annotated_text IS NOT NULL 
  AND TRIM(human_annotated_text) != ''

UNION ALL

SELECT 
  '无标注内容 (但status=true)' as 类别,
  COUNT(*) as 数量
FROM annotations 
WHERE status = true 
  AND (human_annotated_text IS NULL OR TRIM(human_annotated_text) = '')

UNION ALL

SELECT 
  '待质检 (有标注内容 + 无质检员)' as 类别,
  COUNT(*) as 数量
FROM annotations 
WHERE status = true 
  AND human_annotated_text IS NOT NULL 
  AND TRIM(human_annotated_text) != ''
  AND (inspector IS NULL OR inspector = '')

UNION ALL

SELECT 
  '已质检 (有标注内容 + 有质检员)' as 类别,
  COUNT(*) as 数量
FROM annotations 
WHERE status = true 
  AND human_annotated_text IS NOT NULL 
  AND TRIM(human_annotated_text) != ''
  AND inspector IS NOT NULL 
  AND inspector != '';


-- ========================================
-- 2. 去重后的统计（按 video_id + sentence_no）
-- ========================================
WITH deduplicated AS (
  SELECT DISTINCT ON (video_id, sentence_no)
    id,
    video_id,
    sentence_no,
    human_annotated_text,
    inspector
  FROM annotations
  WHERE status = true
    AND human_annotated_text IS NOT NULL
    AND TRIM(human_annotated_text) != ''
  ORDER BY video_id, sentence_no, updated_at DESC
)
SELECT 
  '去重后总数' as 类别,
  COUNT(*) as 数量
FROM deduplicated

UNION ALL

SELECT 
  '去重后待质检' as 类别,
  COUNT(*) as 数量
FROM deduplicated
WHERE inspector IS NULL OR inspector = ''

UNION ALL

SELECT 
  '去重后已质检' as 类别,
  COUNT(*) as 数量
FROM deduplicated
WHERE inspector IS NOT NULL AND inspector != '';


-- ========================================
-- 3. 查看各视频的待质检数量（前20个）
-- ========================================
SELECT 
  video_id as 视频ID,
  COUNT(*) as 总标注数,
  COUNT(CASE WHEN inspector IS NULL OR inspector = '' THEN 1 END) as 待质检数量,
  COUNT(CASE WHEN inspector IS NOT NULL AND inspector != '' THEN 1 END) as 已质检数量
FROM annotations
WHERE status = true
  AND human_annotated_text IS NOT NULL
  AND TRIM(human_annotated_text) != ''
GROUP BY video_id
ORDER BY 待质检数量 DESC
LIMIT 20;


-- ========================================
-- 4. 检查是否有问题数据（status=true但无标注内容）
-- ========================================
SELECT 
  video_id,
  sentence_no,
  annotator,
  status,
  human_annotated_text,
  LENGTH(human_annotated_text) as 文本长度,
  created_at
FROM annotations
WHERE status = true
  AND (human_annotated_text IS NULL OR TRIM(human_annotated_text) = '')
ORDER BY created_at DESC
LIMIT 50;


-- ========================================
-- 5. 查看重复标注的情况
-- ========================================
SELECT 
  video_id,
  sentence_no,
  COUNT(*) as 标注次数,
  STRING_AGG(annotator, ', ') as 标注人列表,
  STRING_AGG(CASE WHEN inspector IS NOT NULL AND inspector != '' THEN inspector ELSE '未质检' END, ', ') as 质检状态列表
FROM annotations
WHERE status = true
  AND human_annotated_text IS NOT NULL
  AND TRIM(human_annotated_text) != ''
GROUP BY video_id, sentence_no
HAVING COUNT(*) > 1
ORDER BY 标注次数 DESC
LIMIT 20;


-- ========================================
-- 6. 【关键】如果待质检数量=8216，找出具体是哪些数据
-- ========================================
-- 这个查询可以帮我们了解这8216条数据的来源
SELECT 
  annotator as 标注人,
  COUNT(*) as 待质检数量,
  MIN(created_at) as 最早时间,
  MAX(created_at) as 最晚时间
FROM annotations
WHERE status = true
  AND human_annotated_text IS NOT NULL
  AND TRIM(human_annotated_text) != ''
  AND (inspector IS NULL OR inspector = '')
GROUP BY annotator
ORDER BY 待质检数量 DESC;

