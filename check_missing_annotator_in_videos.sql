-- =========================================
-- 检查特定视频的标注人缺失问题
-- =========================================

-- 1. 检查第七批第一次改写_语文01.mp4 的标注数据
SELECT 
  '第七批第一次改写_语文01.mp4' as video_name,
  a.id,
  a.sentence_no,
  a.annotator,
  LENGTH(a.annotator) as annotator_length,
  a.annotator IS NULL as annotator_is_null,
  a.annotator = '' as annotator_is_empty,
  a.status,
  a.is_qualified,
  a.inspector,
  a.created_at,
  a.updated_at
FROM annotations a
JOIN videos v ON a.video_id = v.id
WHERE v.name LIKE '%第七批第一次改写_语文01%'
ORDER BY a.sentence_no;

-- 2. 检查第5批第一轮-语文-1.mp4 的标注数据
SELECT 
  '第5批第一轮-语文-1.mp4' as video_name,
  a.id,
  a.sentence_no,
  a.annotator,
  LENGTH(a.annotator) as annotator_length,
  a.annotator IS NULL as annotator_is_null,
  a.annotator = '' as annotator_is_empty,
  a.status,
  a.is_qualified,
  a.inspector,
  a.created_at,
  a.updated_at
FROM annotations a
JOIN videos v ON a.video_id = v.id
WHERE v.name LIKE '%第5批第一轮-语文-1%'
ORDER BY a.sentence_no;

-- 3. 统计所有标注人为空的情况
SELECT 
  'annotations表中标注人为空的统计' as summary,
  COUNT(*) as total_count,
  COUNT(CASE WHEN annotator IS NULL THEN 1 END) as null_count,
  COUNT(CASE WHEN annotator = '' THEN 1 END) as empty_count,
  COUNT(CASE WHEN annotator IS NULL OR annotator = '' THEN 1 END) as missing_annotator_count
FROM annotations;

-- 4. 找出所有标注人缺失的视频
SELECT 
  v.name as video_name,
  v.subject,
  v.batch,
  COUNT(a.id) as annotation_count,
  COUNT(CASE WHEN a.annotator IS NULL OR a.annotator = '' THEN 1 END) as missing_annotator_count,
  STRING_AGG(DISTINCT a.annotator, ', ') as annotators
FROM videos v
LEFT JOIN annotations a ON v.id = a.video_id
GROUP BY v.id, v.name, v.subject, v.batch
HAVING COUNT(CASE WHEN a.annotator IS NULL OR a.annotator = '' THEN 1 END) > 0
ORDER BY missing_annotator_count DESC;

-- 5. 检查这些记录是如何创建的（通过时间戳分析）
SELECT 
  v.name as video_name,
  a.sentence_no,
  a.annotator,
  a.status,
  a.human_annotated_text,
  a.created_at,
  a.updated_at,
  EXTRACT(EPOCH FROM (a.updated_at - a.created_at)) as seconds_between_create_and_update
FROM annotations a
JOIN videos v ON a.video_id = v.id
WHERE (v.name LIKE '%第七批第一次改写_语文01%' OR v.name LIKE '%第5批第一轮-语文-1%')
  AND (a.annotator IS NULL OR a.annotator = '')
ORDER BY v.name, a.sentence_no;

